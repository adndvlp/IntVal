"""F3-R03 a R07: políticas explícitas, con números independientes de F1."""

import math
from dataclasses import replace

import pandas as pd
import pytest

from tests.fixtures.datos_sinteticos import TickerSintetico
from valoracion import calculos
from valoracion.modelos import DatosEmpresa


def datos(**cambios):
    ticker = TickerSintetico()
    valores = dict(
        ticker="TEST",
        info=ticker.info,
        precio=40,
        objetivo_analistas=60,
        acciones=10,
        resultados=ticker.income_stmt,
        flujo=ticker.cashflow,
        balance=ticker.balance_sheet,
        moneda_financiera="USD",
        moneda_cotizacion="USD",
        tipo_cambio=1,
    )
    valores.update(cambios)
    return DatosEmpresa(**valores)


@pytest.mark.parametrize(
    "origen,destino,fx",
    [
        ("USD", "MXN", None),
        ("USD", "MXN", 0),
        ("USD", "MXN", math.inf),
        (None, "USD", 1),
        ("USD", None, 1),
        ("", "", 1),
    ],
)
def test_fx_no_verificable_bloquea_valoracion_y_conserva_precio(config_simple, origen, destino, fx):
    resultado = calculos.valorar_empresa(
        datos(moneda_financiera=origen, moneda_cotizacion=destino, tipo_cambio=fx), config_simple
    )
    assert resultado.principal["Estado"] == "DATOS INCOMPLETOS"
    assert resultado.principal["Precio de mercado"] == 40
    assert resultado.principal["Precio objetivo analistas"] == 60
    assert resultado.principal["Mediana de modelos"] is None
    assert resultado.detalle["Tipo de cambio"] is None
    assert resultado.detalle["Ingresos actuales"] is None
    assert "FX" in resultado.principal["Notas"]
    financieros, margenes = calculos.preparar_historicos_financieros(
        datos(moneda_financiera=origen, moneda_cotizacion=destino, tipo_cambio=fx),
        config_simple,
    )
    assert financieros.empty and margenes.empty


def test_identidad_monetaria_conocida_no_necesita_cotizacion(config_simple):
    resultado = calculos.valorar_empresa(datos(tipo_cambio=None), config_simple)
    assert resultado.detalle["Tipo de cambio"] == 1
    assert resultado.principal["Mediana de modelos"] == pytest.approx(46)


@pytest.mark.parametrize("falta", ["Total Debt", "Cash And Cash Equivalents"])
def test_balance_desconocido_no_se_convierte_en_cero(config_simple, falta):
    base = datos()
    resultado = calculos.valorar_empresa(
        replace(base, balance=base.balance.drop(index=falta)), config_simple
    )
    nombre = "Deuda" if falta == "Total Debt" else "Efectivo"
    assert resultado.detalle[nombre] is None
    assert resultado.detalle["Deuda neta"] is None
    assert resultado.principal["Valor intrínseco EBIT"] is None
    assert resultado.principal["Valor intrínseco EBITDA"] is None
    assert resultado.principal["Valor intrínseco FCL"] == pytest.approx(52)
    assert resultado.principal["Valor intrínseco utilidad neta"] == pytest.approx(48)
    assert resultado.principal["Mediana de modelos"] == pytest.approx(50)
    assert resultado.principal["Estado"] == "REVISAR"


def test_balance_confirmado_en_cero_si_permite_modelos_empresa(config_simple):
    base = datos()
    balance = base.balance.copy()
    balance.loc[:, :] = 0
    resultado = calculos.valorar_empresa(replace(base, balance=balance), config_simple)
    assert resultado.detalle["Deuda neta"] == 0
    assert resultado.principal["Valor intrínseco EBIT"] == pytest.approx(64)
    assert resultado.principal["Mediana de modelos"] == pytest.approx(58)


@pytest.mark.parametrize(
    "info,clase",
    [
        ({"sector": "Financial Services", "industry": "Banks"}, "FINANCIERA"),
        ({"sector": "Financial Services", "industry": "Insurance"}, "FINANCIERA"),
        ({"sector": "Real Estate", "industry": "REIT - Retail"}, "REIT_FIBRA"),
        ({"shortName": "FIBRA sintética", "sector": "Real Estate"}, "REIT_FIBRA"),
        ({"quoteType": "ETF"}, "NO_OPERATIVA"),
        ({"quoteType": "MUTUALFUND"}, "NO_OPERATIVA"),
        ({}, "NO_CLASIFICADA"),
    ],
)
def test_modelos_no_aplicables_se_excluyen_de_mediana(config_simple, info, clase):
    resultado = calculos.valorar_empresa(datos(info=info), config_simple)
    assert resultado.principal["Clase de empresa"] == clase
    assert resultado.principal["Modelos en mediana"] == 0
    assert resultado.principal["Mediana de modelos"] is None
    assert resultado.principal["Estado"] == "REVISAR"
    for campo in [
        "Valor intrínseco FCL",
        "Valor intrínseco EBIT",
        "Valor intrínseco EBITDA",
        "Valor intrínseco utilidad neta",
    ]:
        assert resultado.principal[campo] is None


def test_version_y_conteo_describen_el_agregado(config_simple):
    resultado = calculos.valorar_empresa(datos(), config_simple)
    assert resultado.principal["Versión metodología"] == "proxies-1.0"
    assert resultado.principal["Versión contrato"] == "2.0"
    assert resultado.principal["Modelos en mediana"] == 4
    assert resultado.principal["Modelos incluidos"] == "FCL, NOPAT, EBITDA_AJUSTADO, UTILIDAD_NETA"


def test_un_solo_proxy_se_identifica_como_tal(config_simple):
    base = datos()
    resultado = calculos.valorar_empresa(
        replace(
            base,
            resultados=base.resultados.loc[["Total Revenue", "Net Income"]],
            flujo=pd.DataFrame(),
        ),
        config_simple,
    )
    assert resultado.principal["Modelos en mediana"] == 1
    assert resultado.principal["Mediana de modelos"] == pytest.approx(48)
    assert resultado.principal["Estado"] == "REVISAR"


def test_tasas_accionista_y_empresa_pueden_diferir(config_simple):
    config = replace(config_simple, tasa_descuento_empresa=0.10)
    resultado = calculos.valorar_empresa(datos(), config)
    # PV(128, tres años, terminal 2x, r=10%)=510.6536438768;
    # (510.6536438768-200)/10=31.0653643877. FCL y neta usan r=0.
    assert resultado.principal["Valor intrínseco FCL"] == pytest.approx(52)
    assert resultado.principal["Valor intrínseco utilidad neta"] == pytest.approx(48)
    assert resultado.principal["Valor intrínseco EBIT"] == pytest.approx(31.06536438767844)
    assert resultado.principal["Valor intrínseco EBITDA"] == pytest.approx(31.06536438767844)


@pytest.mark.parametrize("tasa", [-1, math.inf, math.nan])
def test_tasa_empresa_invalida_se_rechaza(config_simple, tasa):
    with pytest.raises(ValueError):
        replace(config_simple, tasa_descuento_empresa=tasa)
