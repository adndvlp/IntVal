"""Métricas y proyecciones puras; no conocen proveedor, UI ni exportación."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .configuracion import Configuracion
from .modelos import DatosEmpresa, Diagnostico, ResultadoAnalisis
from .normalizacion import (alinear_series, convertir_serie, mercado_de_ticker, numero_valido, obtener_fila, ultimo_valor)


def calcular_cagr(serie: pd.Series) -> float | None:
    valores = pd.to_numeric(serie, errors="coerce").dropna()
    valores = valores[valores > 0]
    if len(valores) < 2:
        return None

    primero = float(valores.iloc[0])
    ultimo = float(valores.iloc[-1])

    try:
        fechas = pd.to_datetime(valores.index)
        anos = (fechas[-1] - fechas[0]).days / 365.25
    except Exception:
        anos = len(valores) - 1

    if anos <= 0 or primero <= 0 or ultimo <= 0:
        return None

    return (ultimo / primero) ** (1.0 / anos) - 1.0

def estimar_tasa_impuestos(
    provision_impuestos: pd.Series,
    utilidad_antes_impuestos: pd.Series,
    config: Configuracion,
) -> float:
    alineado = alinear_series(provision_impuestos, utilidad_antes_impuestos)
    if alineado.empty:
        return config.tasa_impuestos_fallback

    alineado.columns = ["impuestos", "pretax"]
    alineado = alineado[alineado["pretax"] > 0]
    tasas = alineado["impuestos"] / alineado["pretax"]
    tasas = tasas.replace([np.inf, -np.inf], np.nan).dropna()
    tasas = tasas[(tasas >= -0.05) & (tasas <= 0.60)]

    if tasas.empty:
        return config.tasa_impuestos_fallback

    tasa = float(tasas.tail(config.max_anos_historicos).median())
    return float(np.clip(
        tasa,
        config.tasa_impuestos_minima,
        config.tasa_impuestos_maxima,
    ))

def construir_fcl(flujo: pd.DataFrame) -> tuple[pd.Series, str]:
    fcl = obtener_fila(flujo, ["Free Cash Flow"])
    if not fcl.empty:
        return fcl, "Yahoo: Free Cash Flow"

    cfo = obtener_fila(
        flujo,
        [
            "Operating Cash Flow",
            "Total Cash From Operating Activities",
            "Cash Flow From Continuing Operating Activities",
        ],
    )
    capex = obtener_fila(
        flujo,
        [
            "Capital Expenditure",
            "Capital Expenditures",
            "Purchase Of PPE",
            "Investments In Property Plant And Equipment",
        ],
    )

    alineado = alinear_series(cfo, capex)
    if alineado.empty:
        return pd.Series(dtype=float), "No disponible"

    alineado.columns = ["cfo", "capex"]
    fcl_calculado = alineado["cfo"] - alineado["capex"].abs()
    return fcl_calculado, "Calculado: CFO - |CapEx|"

def construir_ebitda(
    resultados: pd.DataFrame,
    flujo: pd.DataFrame,
    ebit: pd.Series,
) -> tuple[pd.Series, str]:
    ebitda = obtener_fila(resultados, ["EBITDA", "Normalized EBITDA"])
    if not ebitda.empty:
        return ebitda, "Yahoo: EBITDA"

    depreciacion = obtener_fila(
        flujo,
        [
            "Depreciation And Amortization",
            "Depreciation Amortization Depletion",
            "Depreciation",
        ],
    )
    alineado = alinear_series(ebit, depreciacion)
    if alineado.empty:
        return pd.Series(dtype=float), "No disponible"

    alineado.columns = ["ebit", "da"]
    return alineado["ebit"] + alineado["da"].abs(), "Calculado: EBIT + D&A"

def margen_normalizado(
    metrica: pd.Series,
    ingresos: pd.Series,
    config: Configuracion,
) -> tuple[float | None, int, float | None]:
    alineado = alinear_series(metrica, ingresos)
    if alineado.empty:
        return None, 0, None

    alineado.columns = ["metrica", "ingresos"]
    alineado = alineado[alineado["ingresos"] > 0]
    margenes = alineado["metrica"] / alineado["ingresos"]
    margenes = margenes.replace([np.inf, -np.inf], np.nan).dropna()
    margenes = margenes[(margenes > -2.0) & (margenes < 2.0)]
    margenes = margenes.tail(config.max_anos_historicos)

    if margenes.empty:
        return None, 0, None

    mediana = float(margenes.median())
    conservador = (
        mediana * config.factor_margen_conservador
        if mediana > 0
        else mediana
    )
    return conservador, len(margenes), mediana

def proyectar_valor(
    metrica_base: float | None,
    crecimiento_1_5: float,
    crecimiento_6_10: float,
    tasa_descuento: float,
    anos: int,
    multiplo_terminal: float,
) -> tuple[float | None, float | None, float | None]:
    if isinstance(anos, bool) or not isinstance(anos, int) or anos <= 0:
        raise ValueError("El horizonte en años debe ser un entero positivo.")
    parametros = [numero_valido(valor) for valor in (
        metrica_base, crecimiento_1_5, crecimiento_6_10, tasa_descuento, multiplo_terminal,
    )]
    if any(valor is None for valor in parametros):
        return None, None, None
    metrica_base, crecimiento_1_5, crecimiento_6_10, tasa_descuento, multiplo_terminal = parametros
    if metrica_base <= 0 or tasa_descuento <= -1:
        return None, None, None

    metrica = metrica_base
    pv_flujos = 0.0

    try:
        for ano in range(1, anos + 1):
            crecimiento = crecimiento_1_5 if ano <= 5 else crecimiento_6_10
            metrica *= 1.0 + crecimiento
            pv_flujos += metrica / ((1.0 + tasa_descuento) ** ano)
            if not math.isfinite(pv_flujos):
                return None, None, None

        pv_terminal = (
            metrica * multiplo_terminal
            / ((1.0 + tasa_descuento) ** anos)
        )
    except (OverflowError, ZeroDivisionError):
        return None, None, None
    total = pv_flujos + pv_terminal
    if not all(math.isfinite(valor) for valor in (total, pv_flujos, pv_terminal)):
        return None, None, None
    return total, pv_flujos, pv_terminal

def por_accion(valor_total: float | None, acciones: float | None) -> float | None:
    if valor_total is None or acciones is None or acciones <= 0:
        return None
    resultado = valor_total / acciones
    return resultado if math.isfinite(resultado) and resultado > 0 else None

def rendimiento(valor: float | None, precio: float | None) -> float | None:
    valor, precio = numero_valido(valor), numero_valido(precio)
    if valor is None or precio is None or precio <= 0:
        return None
    resultado = valor / precio - 1.0
    return resultado if math.isfinite(resultado) else None

def es_financiera(info: dict) -> bool:
    texto = " ".join(
        str(info.get(clave, ""))
        for clave in ("sector", "industry", "quoteType")
    ).lower()
    palabras = (
        "financial", "bank", "insurance", "capital markets",
        "credit services", "asset management",
    )
    return any(palabra in texto for palabra in palabras)


def valorar_empresa(
    datos: DatosEmpresa,
    config: Configuracion,
    mercado: str | None = None,
) -> ResultadoAnalisis:
    ticker = datos.ticker
    mercado = mercado or mercado_de_ticker(ticker)
    notas = [diagnostico.mensaje for diagnostico in datos.diagnosticos]
    info = datos.info
    precio = datos.precio
    objetivo = datos.objetivo_analistas
    acciones = datos.acciones
    resultados = datos.resultados
    flujo = datos.flujo
    balance = datos.balance

    ingresos = obtener_fila(
        resultados,
        ["Total Revenue", "Operating Revenue", "Revenue"],
    )
    ebit = obtener_fila(
        resultados,
        ["EBIT", "Operating Income", "Operating Income Loss"],
    )
    utilidad_neta = obtener_fila(
        resultados,
        [
            "Net Income Common Stockholders",
            "Net Income",
            "Net Income Including Noncontrolling Interests",
        ],
    )
    impuestos = obtener_fila(
        resultados,
        ["Tax Provision", "Income Tax Expense"],
    )
    pretax = obtener_fila(
        resultados,
        ["Pretax Income", "Income Before Tax", "Earnings Before Tax"],
    )

    fcl, fuente_fcl = construir_fcl(flujo)
    ebitda, fuente_ebitda = construir_ebitda(resultados, flujo, ebit)

    capex = obtener_fila(
        flujo,
        [
            "Capital Expenditure",
            "Capital Expenditures",
            "Purchase Of PPE",
            "Investments In Property Plant And Equipment",
        ],
    )

    deuda = obtener_fila(
        balance,
        ["Total Debt", "Long Term Debt And Capital Lease Obligation"],
    )
    efectivo = obtener_fila(
        balance,
        [
            "Cash Cash Equivalents And Short Term Investments",
            "Cash And Short Term Investments",
            "Cash And Cash Equivalents",
        ],
    )

    moneda_financiera = datos.moneda_financiera
    moneda_cotizacion = datos.moneda_cotizacion
    fx = datos.tipo_cambio

    if fx is None:
        fx = 1.0
        notas.append(
            f"No se encontró FX {moneda_financiera}/{moneda_cotizacion}; "
            "se usó 1.0."
        )
    elif moneda_financiera != moneda_cotizacion:
        notas.append(
            f"Estados convertidos de {moneda_financiera} a "
            f"{moneda_cotizacion} con FX {fx:.6f}."
        )

    # Convertir estados a la moneda en la que cotiza la acción.
    ingresos = convertir_serie(ingresos, fx)
    ebit = convertir_serie(ebit, fx)
    utilidad_neta = convertir_serie(utilidad_neta, fx)
    impuestos = convertir_serie(impuestos, fx)
    pretax = convertir_serie(pretax, fx)
    fcl = convertir_serie(fcl, fx)
    ebitda = convertir_serie(ebitda, fx)
    capex = convertir_serie(capex, fx)
    deuda = convertir_serie(deuda, fx)
    efectivo = convertir_serie(efectivo, fx)

    tasa_impuestos = estimar_tasa_impuestos(impuestos, pretax, config)

    # EBIT se transforma a NOPAT.
    nopat = ebit * (1.0 - tasa_impuestos)

    # Proxy de caja basado en EBITDA:
    # EBITDA - impuestos sobre EBIT - mantenimiento (aprox. CapEx).
    alineado_ebitda = alinear_series(ebitda, ebit, capex)
    if not alineado_ebitda.empty:
        alineado_ebitda.columns = ["ebitda", "ebit", "capex"]
        ebitda_ajustado = (
            alineado_ebitda["ebitda"]
            - alineado_ebitda["ebit"].clip(lower=0) * tasa_impuestos
            - alineado_ebitda["capex"].abs()
        )
        fuente_ebitda_ajustado = (
            f"{fuente_ebitda}; EBITDA - impuestos EBIT - |CapEx|"
        )
    else:
        ebitda_ajustado = pd.Series(dtype=float)
        fuente_ebitda_ajustado = "No disponible"

    ingreso_actual = ultimo_valor(ingresos)

    cagr = calcular_cagr(ingresos)
    if cagr is None:
        crecimiento_info = numero_valido(info.get("revenueGrowth"))
        if crecimiento_info is not None:
            cagr = crecimiento_info
            notas.append("CAGR no disponible; se usó revenueGrowth de Yahoo.")
        else:
            cagr = config.crecimiento_fallback
            notas.append("Crecimiento no disponible; se usó fallback de 3 %.")

    crecimiento_1_5 = float(np.clip(
        cagr * config.factor_crecimiento_inicial,
        config.crecimiento_minimo,
        config.crecimiento_maximo,
    ))
    crecimiento_6_10 = crecimiento_1_5 * config.factor_crecimiento_final

    margen_fcl, anos_fcl, margen_fcl_sin_descuento = margen_normalizado(
        fcl, ingresos, config
    )
    margen_ebit, anos_ebit, margen_ebit_sin_descuento = margen_normalizado(
        nopat, ingresos, config
    )
    margen_ebitda, anos_ebitda, margen_ebitda_sin_descuento = margen_normalizado(
        ebitda_ajustado, ingresos, config
    )
    margen_neto, anos_neto, margen_neto_sin_descuento = margen_normalizado(
        utilidad_neta, ingresos, config
    )

    base_fcl = ingreso_actual * margen_fcl if ingreso_actual and margen_fcl else None
    base_ebit = ingreso_actual * margen_ebit if ingreso_actual and margen_ebit else None
    base_ebitda = (
        ingreso_actual * margen_ebitda
        if ingreso_actual and margen_ebitda
        else None
    )
    base_neto = (
        ingreso_actual * margen_neto
        if ingreso_actual and margen_neto
        else None
    )

    deuda_actual = ultimo_valor(deuda)
    efectivo_actual = ultimo_valor(efectivo)

    if deuda_actual is None:
        deuda_actual = numero_valido(info.get("totalDebt"))
        if deuda_actual is not None:
            deuda_actual *= fx

    if efectivo_actual is None:
        efectivo_actual = numero_valido(info.get("totalCash"))
        if efectivo_actual is not None:
            efectivo_actual *= fx

    deuda_actual = deuda_actual or 0.0
    efectivo_actual = efectivo_actual or 0.0
    deuda_neta = deuda_actual - efectivo_actual

    valor_fcl_total, pv_fcl, terminal_fcl = proyectar_valor(
        base_fcl,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_fcl,
    )

    valor_ebit_empresa, pv_ebit, terminal_ebit = proyectar_valor(
        base_ebit,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_ebit,
    )

    valor_ebitda_empresa, pv_ebitda, terminal_ebitda = proyectar_valor(
        base_ebitda,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_ebitda,
    )

    valor_neto_total, pv_neto, terminal_neto = proyectar_valor(
        base_neto,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_utilidad_neta,
    )

    financiera = es_financiera(info)

    # FCL y utilidad neta se consideran flujos del accionista.
    # EBIT/NOPAT y EBITDA ajustado se consideran valores de empresa.
    valor_ebit_capital = (
        valor_ebit_empresa - deuda_neta
        if valor_ebit_empresa is not None
        else None
    )
    valor_ebitda_capital = (
        valor_ebitda_empresa - deuda_neta
        if valor_ebitda_empresa is not None
        else None
    )

    if financiera:
        notas.append(
            "Empresa financiera: deuda, FCL, EBIT y EBITDA no son directamente "
            "comparables con compañías industriales; priorizar utilidad neta."
        )

    valor_fcl_accion = por_accion(valor_fcl_total, acciones)
    valor_ebit_accion = por_accion(valor_ebit_capital, acciones)
    valor_ebitda_accion = por_accion(valor_ebitda_capital, acciones)
    valor_neto_accion = por_accion(valor_neto_total, acciones)

    valores_modelos = [
        valor for valor in (
            valor_fcl_accion,
            valor_ebit_accion,
            valor_ebitda_accion,
            valor_neto_accion,
        )
        if valor is not None
    ]
    mediana_modelos = (
        float(np.median(valores_modelos))
        if valores_modelos
        else None
    )

    if ingreso_actual is None:
        notas.append("Ingresos no disponibles.")
    if acciones is None:
        notas.append("Acciones en circulación no disponibles.")
    if precio is None:
        notas.append("Precio de mercado no disponible.")
    if margen_fcl is None or margen_fcl <= 0:
        notas.append("FCL normalizado no positivo o no disponible.")
    if margen_ebit is None or margen_ebit <= 0:
        notas.append("NOPAT normalizado no positivo o no disponible.")
    if margen_ebitda is None or margen_ebitda <= 0:
        notas.append("EBITDA ajustado no positivo o no disponible.")
    if margen_neto is None or margen_neto <= 0:
        notas.append("Utilidad neta normalizada no positiva o no disponible.")
    if objetivo is None:
        notas.append("Precio objetivo de analistas no disponible.")

    estado = "OK"
    if precio is None or acciones is None or ingreso_actual is None:
        estado = "DATOS INCOMPLETOS"
    elif len(valores_modelos) < 2:
        estado = "REVISAR"

    nombre = (
        info.get("shortName")
        or info.get("longName")
        or ticker
    )

    principal = {
        "Mercado": mercado,
        "Ticker": ticker,
        "Empresa": nombre,
        "Moneda": moneda_cotizacion,
        "Precio de mercado": precio,
        "Valor intrínseco FCL": valor_fcl_accion,
        "Upside FCL": rendimiento(valor_fcl_accion, precio),
        "Valor intrínseco EBIT": valor_ebit_accion,
        "Upside EBIT": rendimiento(valor_ebit_accion, precio),
        "Valor intrínseco EBITDA": valor_ebitda_accion,
        "Upside EBITDA": rendimiento(valor_ebitda_accion, precio),
        "Valor intrínseco utilidad neta": valor_neto_accion,
        "Upside utilidad neta": rendimiento(valor_neto_accion, precio),
        "Mediana de modelos": mediana_modelos,
        "Upside mediana": rendimiento(mediana_modelos, precio),
        "Precio objetivo analistas": objetivo,
        "Upside analistas": rendimiento(objetivo, precio),
        "Estado": estado,
        "Notas": " ".join(notas),
    }

    detalle = {
        "Mercado": mercado,
        "Ticker": ticker,
        "Empresa": nombre,
        "Sector": info.get("sector"),
        "Industria": info.get("industry"),
        "Moneda estados": moneda_financiera,
        "Moneda cotización": moneda_cotizacion,
        "Tipo de cambio": fx,
        "Ingresos actuales": ingreso_actual,
        "Acciones en circulación": acciones,
        "Deuda": deuda_actual,
        "Efectivo": efectivo_actual,
        "Deuda neta": deuda_neta,
        "Tasa de impuestos": tasa_impuestos,
        "CAGR histórico ingresos": cagr,
        "Crecimiento años 1-5": crecimiento_1_5,
        "Crecimiento años 6-10": crecimiento_6_10,
        "Margen FCL mediano": margen_fcl_sin_descuento,
        "Margen FCL conservador": margen_fcl,
        "Años FCL": anos_fcl,
        "Fuente FCL": fuente_fcl,
        "Margen NOPAT mediano": margen_ebit_sin_descuento,
        "Margen NOPAT conservador": margen_ebit,
        "Años EBIT": anos_ebit,
        "Margen EBITDA ajustado mediano": margen_ebitda_sin_descuento,
        "Margen EBITDA ajustado conservador": margen_ebitda,
        "Años EBITDA": anos_ebitda,
        "Fuente EBITDA ajustado": fuente_ebitda_ajustado,
        "Margen neto mediano": margen_neto_sin_descuento,
        "Margen neto conservador": margen_neto,
        "Años utilidad neta": anos_neto,
        "Base FCL": base_fcl,
        "Base NOPAT": base_ebit,
        "Base EBITDA ajustado": base_ebitda,
        "Base utilidad neta": base_neto,
        "PV flujos FCL": pv_fcl,
        "PV terminal FCL": terminal_fcl,
        "PV flujos EBIT": pv_ebit,
        "PV terminal EBIT": terminal_ebit,
        "PV flujos EBITDA": pv_ebitda,
        "PV terminal EBITDA": terminal_ebitda,
        "PV flujos utilidad neta": pv_neto,
        "PV terminal utilidad neta": terminal_neto,
        "Empresa financiera": financiera,
        "Notas": " ".join(notas),
    }

    return ResultadoAnalisis(
        principal, detalle, config,
        tuple(Diagnostico(nota) for nota in notas),
    )


def preparar_historicos_financieros(
    datos: DatosEmpresa, config: Configuracion,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    resultados = datos.resultados
    flujo = datos.flujo

    ingresos = obtener_fila(resultados, ["Total Revenue", "Operating Revenue", "Revenue"])
    ebit = obtener_fila(resultados, ["EBIT", "Operating Income", "Operating Income Loss"])
    utilidad = obtener_fila(
        resultados,
        ["Net Income Common Stockholders", "Net Income", "Net Income Including Noncontrolling Interests"],
    )
    impuestos = obtener_fila(resultados, ["Tax Provision", "Income Tax Expense"])
    pretax = obtener_fila(resultados, ["Pretax Income", "Income Before Tax", "Earnings Before Tax"])
    fcl, _ = construir_fcl(flujo)
    ebitda, _ = construir_ebitda(resultados, flujo, ebit)

    fx = datos.tipo_cambio or 1.0

    series = {
        "Ingresos": convertir_serie(ingresos, fx),
        "FCL": convertir_serie(fcl, fx),
        "EBIT": convertir_serie(ebit, fx),
        "EBITDA": convertir_serie(ebitda, fx),
        "Utilidad neta": convertir_serie(utilidad, fx),
    }

    marco = pd.concat(series, axis=1).sort_index()
    if marco.empty:
        return pd.DataFrame(), pd.DataFrame()

    indice = pd.to_datetime(marco.index, errors="coerce")
    marco = marco.loc[~indice.isna()].copy()
    indice = pd.to_datetime(marco.index)
    marco.index = indice.year.astype(str)
    marco = marco.groupby(level=0).last().sort_index()
    marco = marco / 1_000_000.0
    marco.index.name = "Año"

    tasa = estimar_tasa_impuestos(
        convertir_serie(impuestos, fx),
        convertir_serie(pretax, fx),
        config,
    )
    ingresos_base = series["Ingresos"]
    nopat = series["EBIT"] * (1.0 - tasa)

    margenes = {}
    for nombre, serie in {
        "Margen FCL": series["FCL"],
        "Margen EBIT": nopat,
        "Margen EBITDA": series["EBITDA"],
        "Margen neto": series["Utilidad neta"],
    }.items():
        alineado = alinear_series(serie, ingresos_base)
        if alineado.empty:
            continue
        alineado.columns = ["metrica", "ingresos"]
        valor = alineado["metrica"] / alineado["ingresos"].replace(0, np.nan)
        margenes[nombre] = valor

    df_margenes = pd.concat(margenes, axis=1).sort_index() if margenes else pd.DataFrame()
    if not df_margenes.empty:
        idx = pd.to_datetime(df_margenes.index, errors="coerce")
        df_margenes = df_margenes.loc[~idx.isna()].copy()
        df_margenes.index = pd.to_datetime(df_margenes.index).year.astype(str)
        df_margenes = df_margenes.groupby(level=0).last().sort_index()
        df_margenes.index.name = "Año"

    return marco, df_margenes
