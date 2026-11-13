"""F5: datos versionados y motor real, sin consultas al proveedor de mercado."""

from importlib import import_module

import pandas as pd
import pytest

from valoracion.proveedores.base import ProveedorDatos
from valoracion.servicio import analizar_empresa, obtener_historicos_financieros


def proveedor_demo():
    return import_module("valoracion.proveedores.demo").ProveedorDemo()


def test_catalogo_demo_distingue_mercados_y_fecha_de_referencia():
    proveedor = proveedor_demo()
    assert isinstance(proveedor, ProveedorDatos)
    assert proveedor.version == "demo-1.0"
    assert proveedor.fecha_referencia == "2025-01-03"
    assert proveedor.tickers() == ["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"]
    assert proveedor.tickers("MX") == ["DEMO-MX.MX"]
    assert proveedor.tickers("USA") == ["DEMO-USA", "DEMO-INCOMPLETA"]


@pytest.mark.parametrize(
    "ticker, factor, moneda", [("DEMO-USA", 1, "USD"), ("DEMO-MX.MX", 1.8, "MXN")]
)
def test_demo_concilia_los_cuatro_proxies_con_esperados_conocidos(
    config_simple, ticker, factor, moneda
):
    resultado = analizar_empresa(ticker, config_simple, proveedor=proveedor_demo())
    assert resultado.principal["Estado"] == "OK"
    assert resultado.principal["Moneda"] == moneda
    campos = [
        "Valor intrínseco FCL",
        "Valor intrínseco EBIT",
        "Valor intrínseco EBITDA",
        "Valor intrínseco utilidad neta",
    ]
    assert [resultado.principal[c] for c in campos] == pytest.approx(
        [v * factor for v in (52, 44, 44, 48)]
    )
    assert resultado.principal["Mediana de modelos"] == pytest.approx(46 * factor)
    assert resultado.principal["Modelos en mediana"] == 4
    assert "sintéticos" in resultado.detalle["Fuente de datos"]
    assert "demo-1.0" in resultado.detalle["Fuente de datos"]
    assert "2025-01-03" in resultado.principal["Notas"]
    assert resultado.detalle["Obtenido en UTC"] is None
    assert resultado.detalle["Período ingresos"] == "2024-12-31"


def test_demo_incompleta_mantiene_ausencias_y_diagnostico(config_simple):
    resultado = analizar_empresa("DEMO-INCOMPLETA", config_simple, proveedor=proveedor_demo())
    assert resultado.principal["Estado"] == "DATOS INCOMPLETOS"
    assert resultado.principal["Mediana de modelos"] is None
    assert resultado.principal["Modelos en mediana"] == 0
    assert resultado.detalle["Acciones en circulación"] is None
    assert "demostración" in resultado.principal["Notas"].lower()


def test_datos_y_resultados_demo_son_deterministas_y_no_comparten_mutaciones(config_simple):
    proveedor = proveedor_demo()
    primero = analizar_empresa("DEMO-USA", config_simple, proveedor=proveedor)
    datos = proveedor.obtener_empresa("DEMO-USA")
    resultados = datos.resultados
    resultados.iloc[0, 0] = 999999
    assert datos.resultados.iloc[0, 0] == 999999
    historia = proveedor.obtener_precio_historico("DEMO-USA", "5y")
    historia.loc[historia.index[-1], "Cierre"] = 999999
    segundo = analizar_empresa("DEMO-USA", config_simple, proveedor=proveedor)
    assert primero.como_registros() == segundo.como_registros()
    assert proveedor.obtener_precio_historico("DEMO-USA", "5y").iloc[-1]["Cierre"] == 100


def test_historicos_demo_usan_fecha_fija_y_las_vistas_del_motor(config_simple):
    proveedor = proveedor_demo()
    anual = proveedor.obtener_precio_historico("DEMO-USA", "1y")
    completo = proveedor.obtener_precio_historico("DEMO-USA", "5y")
    assert 1 < len(anual) < len(completo)
    assert anual.iloc[-1]["Fecha"] == pd.Timestamp("2025-01-03")
    assert anual.iloc[-1]["Cierre"] == 100
    financieros, margenes = obtener_historicos_financieros(
        "DEMO-USA", config_simple, proveedor=proveedor
    )
    assert financieros.loc["2024", "Ingresos"] == pytest.approx(0.001)
    assert margenes.loc["2024", "Margen NOPAT"] == pytest.approx(0.16)


@pytest.mark.parametrize(
    "metodo, args",
    [
        ("obtener_empresa", ("AAPL",)),
        ("obtener_estados_historicos", ("AAPL",)),
        ("obtener_precio_historico", ("AAPL", "1y")),
        ("obtener_precio_historico", ("DEMO-USA", "invalido")),
    ],
)
def test_fuera_del_catalogo_o_periodo_demo_falla_sin_fallback_de_red(metodo, args):
    with pytest.raises(ValueError):
        getattr(proveedor_demo(), metodo)(*args)


def test_demo_resuelve_archivos_desde_otra_carpeta(monkeypatch, tmp_path, config_simple):
    monkeypatch.chdir(tmp_path)
    resultado = analizar_empresa("DEMO-USA", config_simple, proveedor=proveedor_demo())
    assert resultado.principal["Mediana de modelos"] == pytest.approx(46)
