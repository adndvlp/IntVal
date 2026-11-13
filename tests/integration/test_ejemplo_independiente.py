"""F3-R02: el ejemplo de documentación se ejecuta fuera de los fixtures de pytest."""

import csv
import importlib
from decimal import Decimal

import pytest
from openpyxl import load_workbook


def test_ejemplo_concilia_margenes_proyeccion_y_capital_y_exporta(tmp_path):
    ejemplo = importlib.import_module("examples.valoracion_independiente")
    resultado, comparacion = ejemplo.ejecutar(tmp_path)
    assert resultado.principal["Mediana de modelos"] == pytest.approx(46)
    assert resultado.principal["Modelos en mediana"] == 4
    assert resultado.detalle["Fuente de datos"] == "Datos sintéticos de examples/datos.csv"
    assert [c["modelo"] for c in comparacion] == [
        "FCL",
        "NOPAT",
        "EBITDA_AJUSTADO",
        "UTILIDAD_NETA",
    ]
    assert [Decimal(c["independiente"]) for c in comparacion] == [
        Decimal(52),
        Decimal(44),
        Decimal(44),
        Decimal(48),
    ]
    assert all(Decimal(c["diferencia_absoluta"]) < Decimal("1e-10") for c in comparacion)
    with (tmp_path / "conciliacion.csv").open() as f:
        assert len(list(csv.DictReader(f))) == 4
    libro = load_workbook(tmp_path / "valoracion_independiente.xlsx")
    try:
        assert len(libro.sheetnames) == 7
        assert libro["Resumen"].cell(4, 14).value == 46
    finally:
        libro.close()


def test_oraculo_decimal_descuenta_empresa_sin_modificar_flujo_accionista():
    ejemplo = importlib.import_module("examples.valoracion_independiente")
    valores = ejemplo.calculo_independiente(tasa_empresa=Decimal("0.10"))
    assert valores["FCL"]["por_accion"] == Decimal(52)
    assert valores["NOPAT"]["por_accion"] == pytest.approx(Decimal("31.06536438767844"))
