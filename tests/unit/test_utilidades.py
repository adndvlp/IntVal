"""U-01 a U-13 y defensas de la suite contra red accidental."""

import socket

import numpy as np
import pandas as pd
import pytest

import valoracion.normalizacion as motor
from valoracion.proveedores import yahoo


@pytest.mark.parametrize(
    "ticker, esperado", [("TEST.MX", "MX"), ("test.mx", "MX"), ("TEST", "USA")]
)
def test_mercado(ticker, esperado):
    assert motor.mercado_de_ticker(ticker) == esperado


def test_duplicados_conservan_orden():
    assert motor.eliminar_duplicados(["B", "A", "B", "C", "A"]) == ["B", "A", "C"]


@pytest.mark.parametrize(
    "valor, esperado",
    [
        (3, 3),
        ("2.5", 2.5),
        (None, None),
        ("x", None),
        (np.nan, None),
        (np.inf, None),
        (-np.inf, None),
    ],
)
def test_numero_valido(valor, esperado):
    assert motor.numero_valido(valor) == esperado


def test_fila_normaliza_prioriza_ordena_y_no_muta():
    fechas = pd.to_datetime(["2024-01-01", "2020-01-01"])
    datos = pd.DataFrame([[2, 1], [8, 9]], index=["TOTAL Revenue!", "Revenue"], columns=fechas)
    antes = datos.copy(deep=True)
    salida = motor.obtener_fila(datos, ["Total Revenue", "Revenue"])
    assert salida.tolist() == [1, 2]
    pd.testing.assert_frame_equal(datos, antes)
    repetido = pd.DataFrame([[1], [2]], index=["Revenue", "Revenue"], columns=[fechas[0]])
    assert motor.obtener_fila(repetido, ["Revenue"]).tolist() == [1]


@pytest.mark.parametrize("datos", [None, pd.DataFrame(), pd.DataFrame([[1]], index=["Otro"])])
def test_fila_ausente(datos):
    assert motor.obtener_fila(datos, ["Revenue"]).empty


def test_alinear_conserva_fechas_comunes_y_limpia_ausencias():
    a = pd.Series([1, 2, None], index=["a", "b", "c"])
    b = pd.Series([4, 5, 6], index=["b", "c", "d"])
    resultado = motor.alinear_series(a, b)
    assert resultado.index.tolist() == ["b"]
    assert resultado.iloc[0].tolist() == [2, 4]
    assert motor.alinear_series().empty
    assert motor.alinear_series(a, None).empty
    assert motor.alinear_series(a, pd.Series([9], index=["z"])).empty


@pytest.mark.parametrize(
    "serie, esperado",
    [
        (None, None),
        (pd.Series(dtype=float), None),
        (pd.Series([None]), None),
        (pd.Series([1, None, 2]), 2),
    ],
)
def test_ultimo_valor(serie, esperado):
    assert motor.ultimo_valor(serie) == esperado


def test_conversion_conserva_indice_y_entrada():
    serie = pd.Series([100, 200], index=["a", "b"])
    antes = serie.copy()
    assert motor.convertir_serie(serie, 20).tolist() == [2000, 4000]
    pd.testing.assert_series_equal(serie, antes)


def test_no_se_admiten_consultas_o_sockets_sin_preparar():
    with pytest.raises(pytest.fail.Exception, match="sin fixture"):
        yahoo.yf.Ticker("NO_PREPARADO")
    with pytest.raises(pytest.fail.Exception, match="Socket de red"):
        socket.socket()
    with pytest.raises(pytest.fail.Exception, match="DNS"):
        socket.getaddrinfo("example.com", 443)


def test_normalizacion_descarta_infinitos():
    fechas = pd.date_range("2020-01-01", periods=3, freq="YS")
    datos = pd.DataFrame([[1, np.inf, 3]], index=["Revenue"], columns=fechas)
    assert motor.obtener_fila(datos, ["Revenue"]).tolist() == [1, 3]
    assert motor.alinear_series(pd.Series([1, np.inf]), pd.Series([2, 3])).shape == (1, 2)
    assert motor.ultimo_valor(pd.Series([1, np.inf])) == 1
