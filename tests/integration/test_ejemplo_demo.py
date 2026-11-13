"""F5: el material descargable usa el proveedor demo y la exportación del producto."""

import json
from dataclasses import replace
from importlib import import_module

import pandas as pd
import pytest
from openpyxl import load_workbook

from valoracion.configuracion import Configuracion


def test_generar_ejemplo_demo_concilia_csv_excel_y_procedencia(tmp_path):
    ejemplo = import_module("examples.analisis_demo")
    principales, detalles = ejemplo.generar(tmp_path)
    assert len(principales) == len(detalles) == 3
    resumen = pd.read_csv(tmp_path / "analisis_demo.csv").set_index("Ticker")
    assert resumen.loc["DEMO-USA", "Mediana de proxies"] == pytest.approx(116.1879930510067)
    assert resumen.loc["DEMO-MX.MX", "Mediana de proxies"] == pytest.approx(209.13838749181206)
    assert pd.isna(resumen.loc["DEMO-INCOMPLETA", "Mediana de proxies"])
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["datos_sinteticos"] is True
    assert manifest["version_datos"] == "demo-1.0"
    assert manifest["fecha_referencia"] == "2025-01-03"
    assert manifest["version_metodologia"] == "proxies-1.0"
    assert manifest["configuracion"]["tasa_descuento_empresa"] == 0.1
    libro = load_workbook(tmp_path / "analisis_demo.xlsx")
    try:
        assert len(libro.sheetnames) == 7
        assert libro["Resumen"].max_row == 6
        fuentes = [d["Fuente de datos"] for d in detalles]
        assert all("sintéticos" in fuente for fuente in fuentes)
    finally:
        libro.close()


def test_ejemplo_demo_acepta_otros_supuestos_del_mismo_motor(tmp_path):
    ejemplo = import_module("examples.analisis_demo")
    config = replace(Configuracion(), tasa_descuento=0.15, tasa_descuento_empresa=0.12)
    principales, _ = ejemplo.generar(tmp_path, config=config)
    assert principales[0]["Mediana de modelos"] != pytest.approx(116.1879930510067)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["configuracion"]["tasa_descuento"] == 0.15
