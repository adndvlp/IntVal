"""P-01 a P-12: se ejecutan los adaptadores reales con respuestas sintéticas."""

import math
from types import SimpleNamespace

import pandas as pd
import pytest

import valoracion.proveedores.yahoo as motor
from tests.fixtures.datos_sinteticos import TickerSintetico


class ErrorHTTPPrueba(Exception):
    def __init__(self, status):
        self.response = SimpleNamespace(status_code=status)
        super().__init__("cookie=NO_PUBLICAR; https://privado/crumb=NO_PUBLICAR")


def test_yahoo_explica_y_registra_info_rechazada_sin_filtrar_secretos(caplog):
    ticker = TickerSintetico(get_info_result=ErrorHTTPPrueba(401), info={})
    datos = motor.ProveedorYahoo(ticker_factory=lambda _: ticker).obtener_empresa("AAPL")
    assert datos.precio == 40
    assert datos.moneda_financiera is None
    assert any("401" in d.mensaje for d in datos.diagnosticos)
    assert "YAHOO_UNAUTHORIZED" in caplog.text
    assert "stage=info" in caplog.text
    assert "NO_PUBLICAR" not in caplog.text
    assert all("NO_PUBLICAR" not in d.mensaje for d in datos.diagnosticos)


@pytest.mark.parametrize("error", [ErrorHTTPPrueba(503), TimeoutError(), ConnectionError()])
def test_yahoo_reintenta_info_transitoria_con_ticker_nuevo_y_conserva_monedas(error):
    fallido = TickerSintetico(get_info_result=error, info={})
    recuperado = TickerSintetico()
    llamadas = []

    def fabrica(simbolo):
        llamadas.append(simbolo)
        return fallido if len(llamadas) == 1 else recuperado

    datos = motor.ProveedorYahoo(ticker_factory=fabrica).obtener_empresa("AAPL")
    assert llamadas == ["AAPL", "AAPL"]
    assert datos.moneda_financiera == datos.moneda_cotizacion == "USD"
    assert datos.info["shortName"] == "Industrial sintética"
    assert not datos.diagnosticos


@pytest.mark.parametrize("status", [401, 403, 429])
def test_yahoo_no_insiste_automaticamente_ante_rechazo_o_limite(status):
    llamadas = []

    def fabrica(simbolo):
        llamadas.append(simbolo)
        return TickerSintetico(get_info_result=ErrorHTTPPrueba(status), info={})

    datos = motor.ProveedorYahoo(ticker_factory=fabrica).obtener_empresa("AAPL")
    assert llamadas == ["AAPL"]
    assert any(str(status) in d.mensaje for d in datos.diagnosticos)


def test_yahoo_limita_a_un_reintento_y_conserva_el_error_final():
    llamadas = []

    def fabrica(simbolo):
        llamadas.append(simbolo)
        return TickerSintetico(get_info_result=ErrorHTTPPrueba(503), info={})

    datos = motor.ProveedorYahoo(ticker_factory=fabrica).obtener_empresa("AAPL")
    assert llamadas == ["AAPL", "AAPL"]
    assert datos.moneda_financiera is None
    assert any("YAHOO_TEMPORARY_ERROR" in d.mensaje for d in datos.diagnosticos)


def test_yahoo_distingue_estados_vacios_de_errores_de_adquisicion(caplog):
    ticker = TickerSintetico(
        income_stmt=ErrorHTTPPrueba(429), cashflow=pd.DataFrame(), balance_sheet=pd.DataFrame()
    )
    datos = motor.ProveedorYahoo(ticker_factory=lambda _: ticker).obtener_empresa("AAPL")
    assert datos.resultados.empty and datos.flujo.empty and datos.balance.empty
    assert any("429" in d.mensaje for d in datos.diagnosticos)
    assert "stage=income_stmt" in caplog.text
    assert "YAHOO_RATE_LIMITED" in caplog.text
    assert "stage=cashflow" in caplog.text and "YAHOO_EMPTY_RESPONSE" in caplog.text
    assert "NO_PUBLICAR" not in caplog.text


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
