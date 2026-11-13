"""CACHE-01 a CACHE-04: claves, copias y aislamiento sin esperar los TTL."""

from dataclasses import asdict, replace
from importlib import import_module

import motor_valoracion as motor


def test_cache_analisis_usa_ticker_y_configuracion_y_devuelve_copias(
    industrial, proveedor, config_simple
):
    interfaz = import_module("app")
    config = tuple(asdict(config_simple).items())
    primero, _ = interfaz.analizar_cached("TEST", config)
    primero["Precio de mercado"] = 999
    segundo, _ = interfaz.analizar_cached("TEST", config)
    assert segundo["Precio de mercado"] == 40
    assert proveedor[1] == ["TEST"]
    distinta = tuple(asdict(replace(config_simple, tasa_descuento=0.1)).items())
    tercero, _ = interfaz.analizar_cached("TEST", distinta)
    assert tercero["Mediana de modelos"] != segundo["Mediana de modelos"]
    assert proveedor[1] == ["TEST", "TEST"]
    proveedor[0]["OTRA"] = industrial
    interfaz.analizar_cached("OTRA", config)
    assert proveedor[1] == ["TEST", "TEST", "OTRA"]


def test_cache_historico_distingue_periodos_y_preserva_datos(industrial, proveedor):
    interfaz = import_module("app")
    primero = interfaz.precio_historico("TEST", "1y")
    primero.loc[0, "Cierre"] = 999
    segundo = interfaz.precio_historico("TEST", "1y")
    assert segundo["Cierre"].tolist() == [38, 39, 40]
    interfaz.precio_historico("TEST", "5y")
    assert proveedor[1] == ["TEST", "TEST"]
    assert [kwargs["period"] for nombre, kwargs in industrial.llamadas if nombre == "history"] == [
        "1y",
        "5y",
    ]


def test_caches_se_limpian_para_otra_prueba(industrial, proveedor, config_simple):
    interfaz = import_module("app")
    assert motor.CACHE_FX == {}
    interfaz.analizar_cached("TEST", tuple(asdict(config_simple).items()))
    assert proveedor[1] == ["TEST"]
