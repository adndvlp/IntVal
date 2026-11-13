"""P-01 a P-12: se ejecutan los adaptadores reales con respuestas sintéticas."""

import math

import pandas as pd
import pytest

import valoracion.proveedores.yahoo as motor
from tests.fixtures.datos_sinteticos import TickerSintetico


@pytest.mark.parametrize(
    "primario, secundario, esperado",
    [
        ({"ok": 1}, {"otro": 2}, {"ok": 1}),
        (RuntimeError("primario"), {"ok": 2}, {"ok": 2}),
        (RuntimeError("primario"), RuntimeError("secundario"), {}),
        ([1], {"otro": 2}, {}),
        (RuntimeError("primario"), [1], {}),
    ],
)
def test_info_y_fallback(primario, secundario, esperado):
    ticker = TickerSintetico(get_info_result=primario, info=secundario)
    assert motor.obtener_info_segura(ticker) == esperado


@pytest.mark.parametrize(
    "fast, historia, esperado",
    [
        ({"last_price": 20, "lastPrice": 30}, pd.DataFrame(), 20),
        ({"last_price": -2, "lastPrice": 30}, pd.DataFrame(), 30),
        (RuntimeError("fast"), pd.DataFrame({"Close": [10, None, 15]}), 15),
        ({}, pd.DataFrame(), None),
        ({}, RuntimeError("history"), None),
        ({}, pd.DataFrame({"Close": ["invalido"]}), None),
        ({"regular_market_price": 12}, pd.DataFrame(), 12),
    ],
)
def test_precio_prioridad_y_fallback(fast, historia, esperado):
    ticker = TickerSintetico(fast_info=fast, history_result=historia)
    assert motor.obtener_precio_actual(ticker) == esperado


@pytest.mark.parametrize(
    "objetivos, info, esperado",
    [
        ({"mean": 20, "median": 15}, {}, 20),
        ({"mean": math.nan, "median": 15}, {}, 15),
        (RuntimeError("analistas"), {"targetMeanPrice": 30}, 30),
        ({}, {"targetMeanPrice": 0, "targetMedianPrice": 25}, 25),
        ({"mean": -1}, {"targetMeanPrice": math.inf}, None),
        ([], {}, None),
    ],
)
def test_objetivos_analistas(objetivos, info, esperado):
    assert (
        motor.obtener_objetivo_analistas(TickerSintetico(analyst_price_targets=objetivos), info)
        == esperado
    )


@pytest.mark.parametrize(
    "info, fast, historial, precio, esperado",
    [
        ({"sharesOutstanding": 20}, {}, pd.Series(dtype=float), 10, 20),
        ({"impliedSharesOutstanding": 25}, {}, pd.Series(dtype=float), 10, 25),
        ({}, {"shares": 30}, pd.Series(dtype=float), 10, 30),
        ({}, {"shares_outstanding": 35}, pd.Series(dtype=float), 10, 35),
        ({"marketCap": 400}, RuntimeError("fast"), pd.Series(dtype=float), 10, 40),
        ({"marketCap": 400}, {}, pd.Series([50.0]), 0, 50),
        ({}, {}, pd.Series([60.0]), None, 60),
        ({"sharesOutstanding": -1}, {"shares": 0}, pd.Series(dtype=float), 10, None),
        ({}, RuntimeError("fast"), RuntimeError("shares"), 10, None),
        ({}, {}, pd.Series([math.nan]), 10, None),
    ],
)
def test_acciones_prioridad_y_limites(info, fast, historial, precio, esperado):
    ticker = TickerSintetico(fast_info=fast, shares_result=historial)
    assert motor.obtener_acciones(ticker, info, precio) == esperado


@pytest.mark.parametrize("origen, destino", [("USD", "USD"), ("mxn", "MXN")])
def test_fx_identidad_actual_sin_consultas(origen, destino):
    # F3: sólo monedas identificadas e iguales definen una identidad.
    assert motor.obtener_tipo_cambio(origen, destino) == 1


@pytest.mark.parametrize(
    "directo, inverso, esperado",
    [(20, None, 20), (None, 0.05, 20), (None, None, None), (-1, 0, None)],
)
def test_fx_directo_inverso_y_cache(monkeypatch, directo, inverso, esperado):
    llamadas = []

    def cierre(simbolo):
        llamadas.append(simbolo)
        return directo if simbolo == "USDMXN=X" else inverso

    monkeypatch.setattr(motor, "ultimo_cierre_simbolo", cierre)
    assert motor.obtener_tipo_cambio("USD", "MXN") == esperado
    cantidad = len(llamadas)
    assert motor.obtener_tipo_cambio("USD", "MXN") == esperado
    assert len(llamadas) == cantidad
    assert llamadas[0] == "USDMXN=X"
    motor.obtener_tipo_cambio("USD", "EUR")
    assert "USDEUR=X" in llamadas[cantidad:]


@pytest.mark.parametrize(
    "historia, esperado",
    [
        (pd.DataFrame(), None),
        (pd.DataFrame({"Close": [2, 3]}), 3),
        (pd.DataFrame({"Close": ["x"]}), None),
        (RuntimeError("historia"), None),
    ],
)
def test_ultimo_cierre(proveedor, historia, esperado):
    proveedor[0]["FX"] = TickerSintetico(history_result=historia)
    assert motor.ultimo_cierre_simbolo("FX") == esperado


@pytest.mark.parametrize("cierre", [0, -1, math.inf, -math.inf])
def test_precio_historico_no_positivo_o_no_finito_no_es_valido(cierre):
    ticker = TickerSintetico(fast_info={}, history_result=pd.DataFrame({"Close": [cierre]}))
    assert motor.obtener_precio_actual(ticker) is None


@pytest.mark.parametrize("origen, destino", [("", "USD"), (None, "USD"), ("USD", "")])
def test_f3_moneda_ausente_no_define_identidad(origen, destino):
    assert motor.obtener_tipo_cambio(origen, destino) is None
