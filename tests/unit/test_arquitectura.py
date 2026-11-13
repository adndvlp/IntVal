"""F2-R01/R03: cálculo y normalización se pueden usar sin las capas de I/O."""

import ast
from configparser import ConfigParser
from importlib import import_module
from pathlib import Path

import pytest


@pytest.mark.parametrize("modulo", ["calculos", "normalizacion", "configuracion"])
def test_modulos_puros_no_dependen_de_ui_proveedor_o_excel(modulo):
    ruta = Path("valoracion") / f"{modulo}.py"
    arbol = ast.parse(ruta.read_text())
    prohibidos = {"streamlit", "yfinance", "openpyxl", "requests", "httpx", "urllib", "subprocess"}
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            assert not {alias.name.split('.')[0] for alias in nodo.names} & prohibidos
        elif isinstance(nodo, ast.ImportFrom):
            assert (nodo.module or '').split('.')[0] not in prohibidos
            assert not any(parte in (nodo.module or '').split('.') for parte in ['proveedores', 'exportacion', 'presentacion'])
        elif isinstance(nodo, ast.Call):
            if isinstance(nodo.func, ast.Name):
                assert nodo.func.id not in {"open", "input"}
            elif isinstance(nodo.func, ast.Attribute):
                assert nodo.func.attr not in {"write_text", "write_bytes", "read_text", "read_bytes", "to_excel", "to_csv"}


def test_calculos_extraidos_conservan_oraculo_y_configuracion():
    calculos = import_module("valoracion.calculos")
    configuracion = import_module("valoracion.configuracion")
    normalizacion = import_module("valoracion.normalizacion")
    assert calculos.proyectar_valor(100, 0.1, 0, 0, 6, 2) == pytest.approx((1154.714, 832.612, 322.102))
    assert configuracion.Configuracion().tasa_descuento == 0.1
    assert normalizacion.mercado_de_ticker("test.mx") == "MX"


def test_fachada_comparte_configuracion_y_calculos_sin_duplicarlos():
    import motor_valoracion as motor
    calculos = import_module("valoracion.calculos")
    configuracion = import_module("valoracion.configuracion")
    assert motor.Configuracion is configuracion.Configuracion
    assert motor.proyectar_valor is calculos.proyectar_valor
    assert motor.margen_normalizado is calculos.margen_normalizado


@pytest.mark.parametrize("ruta", ["app.py", "valoracion/cli.py", "valoracion/exportacion/excel.py"])
def test_entradas_y_exportacion_no_importan_el_proveedor_concreto(ruta):
    arbol = ast.parse(Path(ruta).read_text())
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Import):
            assert not any(alias.name == 'yfinance' for alias in nodo.names)
        elif isinstance(nodo, ast.ImportFrom):
            assert nodo.module != 'motor_valoracion'
            assert 'proveedores.yahoo' not in (nodo.module or '')


def test_fachada_delega_servicio_excel_y_cli_a_sus_modulos():
    import motor_valoracion as motor
    servicio = import_module('valoracion.servicio')
    excel = import_module('valoracion.exportacion.excel')
    cli = import_module('valoracion.cli')
    assert motor.analizar_ticker is servicio.analizar_ticker
    assert motor.escribir_excel is excel.escribir_excel
    assert motor.main is cli.main


def test_cobertura_incluye_el_codigo_movido_al_paquete():
    pytest_config = ConfigParser()
    pytest_config.read('pytest.ini')
    assert '--cov=valoracion' in pytest_config['pytest']['addopts'].split()
    cobertura = ConfigParser()
    cobertura.read('.coveragerc')
    assert 'valoracion' in [nombre.strip() for nombre in cobertura['run']['source'].split(',')]
