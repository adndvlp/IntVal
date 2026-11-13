"""F2-R06: catálogo local validado, independiente del directorio de ejecución."""

import json
from copy import deepcopy
from importlib import import_module

import pytest


def documento():
    return {
        "version": 1,
        "fecha_snapshot": "2026-11-12",
        "fecha_verificacion_fuentes": None,
        "descripcion": "Catálogo sintético para tests, no composición actual de un índice.",
        "mercados": {"USA": ["TEST"], "MX": ["TEST.MX"]},
        "fuentes": [
            {
                "Mercado": "MX",
                "Fuente": "Referencia sintética",
                "Descripción": "No se consulta durante la carga.",
                "URL": "https://example.com",
            }
        ],
    }


def cargar(tmp_path, datos):
    ruta = tmp_path / "universo.json"
    ruta.write_text(json.dumps(datos, ensure_ascii=False), encoding="utf-8")
    return import_module("valoracion.universo").cargar_universo(ruta)


def test_cargar_catalogo_local_valida_identidad_y_preserva_orden(tmp_path):
    datos = documento()
    datos["mercados"]["USA"] = ["Z", "A", "BRK-B"]
    catalogo = cargar(tmp_path, datos)
    assert catalogo.usa == ("Z", "A", "BRK-B")
    assert catalogo.mx == ("TEST.MX",)
    assert catalogo.todos == ("Z", "A", "BRK-B", "TEST.MX")
    assert catalogo.fecha_snapshot == "2026-11-12"
    assert catalogo.fecha_verificacion_fuentes is None
    assert dict(catalogo.fuentes[0]) == datos["fuentes"][0]


@pytest.mark.parametrize(
    "campo, valor",
    [
        ("version", 2),
        ("version", True),
        ("fecha_snapshot", "invalida"),
        ("fecha_verificacion_fuentes", "ayer"),
        ("descripcion", ""),
        ("mercados", []),
        ("mercados", {"OTRO": []}),
        ("fuentes", {}),
    ],
)
def test_rechazar_estructura_y_metadatos_invalidos(tmp_path, campo, valor):
    datos = documento()
    datos[campo] = valor
    with pytest.raises(ValueError):
        cargar(tmp_path, datos)


@pytest.mark.parametrize(
    "mercado, tickers",
    [
        ("USA", ["TEST", "TEST"]),
        ("MX", ["TEST.MX", "TEST.MX"]),
        ("USA", [""]),
        ("USA", [" test"]),
        ("USA", ["test"]),
        ("USA", [None]),
        ("MX", ["TEST"]),
        ("USA", ["TEST.MX"]),
        ("USA", "TEST"),
    ],
)
def test_rechazar_tickers_duplicados_o_inconsistentes(tmp_path, mercado, tickers):
    datos = documento()
    datos["mercados"][mercado] = tickers
    with pytest.raises(ValueError):
        cargar(tmp_path, datos)


@pytest.mark.parametrize("fuente", [{}, {"Mercado": "OTRO"}, None])
def test_rechazar_fuentes_sin_identidad(tmp_path, fuente):
    datos = documento()
    datos["fuentes"] = [fuente]
    with pytest.raises(ValueError):
        cargar(tmp_path, datos)


def test_catalogo_default_se_localiza_desde_otro_directorio(monkeypatch, tmp_path):
    universo = import_module("valoracion.universo")
    monkeypatch.chdir(tmp_path)
    catalogo = universo.cargar_universo()
    assert len(catalogo.usa) == 500
    assert len(catalogo.mx) == 104


def test_cargas_independientes_y_archivo_malformado(tmp_path):
    primero = cargar(tmp_path, documento())
    segundo = cargar(tmp_path, documento())
    assert primero is not segundo
    assert primero.fuentes[0] is not segundo.fuentes[0]
    ruta = tmp_path / "roto.json"
    ruta.write_text('{"incompleto":', encoding="utf-8")
    with pytest.raises(ValueError):
        import_module("valoracion.universo").cargar_universo(ruta)


def test_fuentes_y_catalogos_vacios_son_validos(tmp_path):
    datos = deepcopy(documento())
    datos["mercados"] = {"USA": [], "MX": []}
    datos["fuentes"] = []
    assert cargar(tmp_path, datos).todos == ()
