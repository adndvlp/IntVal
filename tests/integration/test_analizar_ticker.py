"""A-01 a A-16: motor real, proveedor falso y cálculo completo independiente."""

from copy import deepcopy

import numpy as np
import pandas as pd
import pytest

import valoracion.servicio as motor
from valoracion.modelos import COLUMNAS_PRINCIPAL, COLUMNAS_DETALLE
from tests.fixtures.datos_sinteticos import TickerSintetico


def test_industrial_completa_concilia_cuatro_modelos(industrial, config_simple):
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    assert principal["Estado"] == "OK"
    assert principal["Moneda"] == "USD"
    assert principal["Precio de mercado"] == 40
    assert [principal[c] for c in ["Valor intrínseco FCL", "Valor intrínseco EBIT", "Valor intrínseco EBITDA", "Valor intrínseco utilidad neta"]] == pytest.approx([52, 44, 44, 48])
    assert principal["Mediana de modelos"] == pytest.approx(46)
    assert principal["Upside mediana"] == pytest.approx(0.15)
    assert principal["Upside analistas"] == pytest.approx(0.5)
    assert detalle["Tasa de impuestos"] == pytest.approx(0.2)
    assert detalle["Deuda neta"] == 200
    assert [detalle[c] for c in ["Base FCL", "Base NOPAT", "Base EBITDA ajustado", "Base utilidad neta"]] == pytest.approx([104, 128, 128, 96])
    assert detalle["PV flujos FCL"] == pytest.approx(312)
    assert detalle["PV terminal FCL"] == pytest.approx(208)
    assert list(principal) == COLUMNAS_PRINCIPAL
    assert list(detalle) == COLUMNAS_DETALLE


@pytest.mark.parametrize("extranjera", [False, True])
def test_empresa_mx_y_conversion_controlada(proveedor, config_simple, extranjera):
    ticker = TickerSintetico()
    ticker.datos["info"].update(currency="MXN", financialCurrency="USD" if extranjera else "MXN")
    proveedor[0]["TEST.MX"] = ticker
    proveedor[0]["USDMXN=X"] = TickerSintetico(history_result=pd.DataFrame({"Close": [20]}))
    principal, detalle = motor.analizar_ticker("TEST.MX", config_simple)
    factor = 20 if extranjera else 1
    assert principal["Mercado"] == "MX"
    assert principal["Moneda"] == "MXN"
    assert principal["Mediana de modelos"] == pytest.approx(46 * factor)
    assert detalle["Ingresos actuales"] == 1000 * factor
    assert detalle["Deuda neta"] == 200 * factor
    assert detalle["Tipo de cambio"] == factor
    assert ("USDMXN=X" in proveedor[1]) is extranjera


def test_f3_fx_ausente_bloquea_valoracion(industrial, proveedor, config_simple):
    industrial.datos["info"].update(currency="MXN", financialCurrency="USD")
    for simbolo in ["USDMXN=X", "MXNUSD=X"]:
        proveedor[0][simbolo] = TickerSintetico(history_result=pd.DataFrame())
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    assert detalle["Tipo de cambio"] is None
    assert principal["Mediana de modelos"] is None
    assert principal["Estado"] == "DATOS INCOMPLETOS"
    assert "FX USD/MXN no verificable" in principal["Notas"]


@pytest.mark.parametrize("falta", ["precio", "acciones", "ingresos"])
def test_datos_basicos_incompletos(industrial, config_simple, falta):
    if falta == "precio":
        industrial.datos["fast_info"] = {"shares": 10}
        industrial.datos["history_result"] = pd.DataFrame()
    elif falta == "acciones":
        industrial.datos["info"].pop("sharesOutstanding")
        industrial.datos["fast_info"] = {"last_price": 40}
        industrial.datos["shares_result"] = pd.Series(dtype=float)
    else:
        industrial.datos["income_stmt"] = industrial.income_stmt.drop(index="Total Revenue")
    principal, _ = motor.analizar_ticker("TEST", config_simple)
    assert principal["Estado"] == "DATOS INCOMPLETOS"
    assert principal["Upside mediana"] is None


@pytest.mark.parametrize("modelos", [0, 1, 2])
def test_modelos_parciales_excluyen_ausencias_de_mediana(industrial, config_simple, modelos):
    industrial.datos["income_stmt"] = industrial.income_stmt.loc[["Total Revenue", "Net Income"]]
    industrial.datos["cashflow"] = industrial.cashflow.loc[["Free Cash Flow"]] if modelos == 2 else pd.DataFrame()
    if modelos == 0:
        industrial.datos["income_stmt"] = industrial.income_stmt.loc[["Total Revenue"]]
    principal, _ = motor.analizar_ticker("TEST", config_simple)
    assert principal["Estado"] == ("OK" if modelos == 2 else "REVISAR")
    esperado = {0: None, 1: 48, 2: 50}[modelos]
    assert principal["Mediana de modelos"] == (pytest.approx(esperado) if esperado is not None else None)


@pytest.mark.parametrize("crecimiento, g1, g2", [(None, 0.0075, 0.00375), (0.1, 0.025, 0.0125), (0.5, 0.12, 0.06), (-0.2, -0.02, -0.01)])
def test_crecimiento_fallback_y_limites(industrial, config_simple, crecimiento, g1, g2):
    industrial.datos["income_stmt"] = industrial.income_stmt.iloc[:, -1:]
    if crecimiento is not None:
        industrial.datos["info"]["revenueGrowth"] = crecimiento
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    assert detalle["Crecimiento años 1-5"] == pytest.approx(g1)
    assert detalle["Crecimiento años 6-10"] == pytest.approx(g2)
    assert "CAGR no disponible" in principal["Notas"] if crecimiento is not None else "fallback" in principal["Notas"]


def test_balance_fallback_sector_y_nombre(industrial, config_simple):
    industrial.datos["balance_sheet"] = pd.DataFrame()
    industrial.datos["info"].update(totalDebt=300, totalCash=100, sector="Financial Services", longName="Banco sintético")
    industrial.datos["info"].pop("shortName")
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    assert principal["Empresa"] == "Banco sintético"
    assert detalle["Empresa financiera"] is True
    assert "Clase FINANCIERA" in principal["Notas"]
    assert detalle["Deuda neta"] == 200
    assert principal["Valor intrínseco EBIT"] is None
    assert principal["Modelos en mediana"] == 0


@pytest.mark.parametrize("campo", ["income_stmt", "cashflow", "balance_sheet"])
def test_estado_financiero_fallido_es_localizado(industrial, config_simple, campo):
    industrial.datos[campo] = RuntimeError("No disponible")
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    assert principal["Ticker"] == "TEST"
    assert principal["Estado"] in {"OK", "REVISAR", "DATOS INCOMPLETOS"}
    assert detalle["Ticker"] == "TEST"


def test_infinitos_en_datos_no_llegan_a_valoraciones(industrial, config_simple):
    industrial.datos["income_stmt"] = industrial.income_stmt.astype(float)
    industrial.datos["income_stmt"].loc["Total Revenue"] = np.inf
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    assert principal["Estado"] == "DATOS INCOMPLETOS"
    assert detalle["Ingresos actuales"] is None
    assert principal["Mediana de modelos"] is None


def test_analisis_no_muta_los_datos_de_entrada(industrial, config_simple):
    antes = deepcopy(industrial.datos)
    motor.analizar_ticker("TEST", config_simple)
    for campo in ["income_stmt", "cashflow", "balance_sheet"]:
        pd.testing.assert_frame_equal(industrial.datos[campo], antes[campo])
