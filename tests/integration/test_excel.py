"""X-03/X-04: regresiones del contrato de exportación."""

from contextlib import closing
from copy import deepcopy

import numpy as np
import pytest
from openpyxl import load_workbook

import motor_valoracion as motor


HOJAS = ["Resumen", "USA", "MX", "Detalle", "Supuestos", "Universo", "Fuentes"]
COLUMNAS_PRINCIPAL = [
    "Mercado", "Ticker", "Empresa", "Moneda", "Precio de mercado",
    "Valor intrínseco FCL", "Upside FCL", "Valor intrínseco EBIT", "Upside EBIT",
    "Valor intrínseco EBITDA", "Upside EBITDA", "Valor intrínseco utilidad neta",
    "Upside utilidad neta", "Mediana de modelos", "Upside mediana",
    "Precio objetivo analistas", "Upside analistas", "Estado", "Notas",
]


@pytest.mark.parametrize("con_error", [True, False], ids=["solo_errores", "vacio"])
def test_excel_con_errores_o_vacio_conserva_el_esquema(tmp_path, con_error):
    principal = {
        "Mercado": "USA", "Ticker": "TEST", "Empresa": "TEST",
        "Estado": "ERROR", "Notas": "Fallo simulado",
    }
    detalle = {"Mercado": "USA", "Ticker": "TEST", "Notas": "Fallo simulado"}
    ruta = tmp_path / "salida.xlsx"

    motor.escribir_excel(
        [principal] if con_error else [],
        [detalle] if con_error else [],
        ruta,
        motor.Configuracion(),
    )

    with closing(load_workbook(ruta)) as libro:
        assert libro.sheetnames == HOJAS
        for nombre in ["Resumen", "USA", "MX"]:
            assert [celda.value for celda in libro[nombre][3]] == COLUMNAS_PRINCIPAL
        assert libro["Detalle"].cell(3, 1).value == "Mercado"
        if con_error:
            assert libro["Resumen"].cell(4, 2).value == "TEST"
            assert libro["Resumen"].cell(4, 18).value == "ERROR"
            assert libro["Resumen"].cell(4, 15).value is None


def test_excel_particion_orden_valores_formatos_y_supuestos(tmp_path, industrial, config_simple):
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    mx = {**principal, "Mercado": "MX", "Ticker": "TEST.MX", "Empresa": "Compañía México", "Estado": "REVISAR"}
    incompleto = {**principal, "Ticker": "INCOMPLETO", "Estado": "DATOS INCOMPLETOS", "Upside mediana": None}
    error = {"Mercado": "USA", "Ticker": "ERROR", "Estado": "ERROR", "Notas": "No disponible"}
    registros = [incompleto, error, principal, mx]
    antes = deepcopy(registros)
    ruta = tmp_path / "directorio nuevo" / "libro.xlsx"
    motor.escribir_excel(registros, [detalle], ruta, config_simple)
    assert registros == antes
    with closing(load_workbook(ruta)) as libro:
        resumen = libro["Resumen"]
        assert libro.sheetnames == HOJAS
        assert [fila[1] for fila in resumen.iter_rows(min_row=4, values_only=True)] == ["TEST.MX", "TEST", "INCOMPLETO", "ERROR"]
        assert libro["MX"].cell(4, 3).value == "Compañía México"
        assert libro["MX"].max_row == 4
        assert libro["USA"].max_row == 6
        assert resumen.freeze_panes == "D4"
        assert libro["Detalle"].freeze_panes == "A4"
        assert "generado" in resumen["A1"].value
        assert len(resumen.tables) == 1
        assert len(resumen.conditional_formatting) > 0
        assert isinstance(resumen.cell(4, 5).value, (float, int))
        assert resumen.cell(4, 15).value == pytest.approx(0.15)
        assert "$" in resumen.cell(4, 5).number_format
        assert "%" in resumen.cell(4, 15).number_format
        assert resumen.cell(4, 18).fill.fgColor.rgb.endswith("FFF2CC")
        assert resumen.cell(5, 18).fill.fgColor.rgb.endswith("E2F0D9")
        assert resumen.cell(6, 18).fill.fgColor.rgb.endswith("FCE4D6")
        assert resumen.cell(7, 15).value is None
        supuestos = {fila[0]: fila[1] for fila in libro["Supuestos"].iter_rows(min_row=4, values_only=True)}
        assert supuestos["Años de proyección"] == 3
        assert supuestos["Tasa de descuento"] == 0
        assert supuestos["Múltiplo terminal FCL"] == 2
        assert libro["Detalle"].cell(4, 9).value == 1000


@pytest.mark.parametrize("invalido", [np.nan, np.inf, -np.inf])
def test_excel_escribe_no_finitos_como_celdas_vacias(tmp_path, industrial, config_simple, invalido):
    principal, detalle = motor.analizar_ticker("TEST", config_simple)
    principal["Precio de mercado"] = invalido
    detalle["Ingresos actuales"] = invalido
    ruta = tmp_path / "ausencias.xlsx"
    motor.escribir_excel([principal], [detalle], ruta, config_simple)
    with closing(load_workbook(ruta)) as libro:
        assert libro["Resumen"].cell(4, 5).value is None
        assert libro["Detalle"].cell(4, 9).value is None


def test_error_de_escritura_se_propaga_sin_afirmar_exito(monkeypatch, tmp_path):
    def fallar(*args, **kwargs):
        raise PermissionError("Permiso de prueba")
    monkeypatch.setattr(motor.pd, "ExcelWriter", fallar)
    with pytest.raises(PermissionError, match="Permiso de prueba"):
        motor.escribir_excel([], [], tmp_path / "salida.xlsx", motor.Configuracion())
