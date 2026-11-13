"""El hero usa el ejemplo versionado, nunca un cálculo o una cotización nueva."""

import csv
import json
from importlib import import_module
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


def test_derivado_web_concilia_todos_los_importes_y_su_procedencia(tmp_path, monkeypatch):
    modulo = import_module("examples.exportar_demo_web")
    destino = tmp_path / "demo.json"
    monkeypatch.chdir(tmp_path)
    modulo.exportar(destino)
    datos = json.loads(destino.read_text())
    with (RAIZ / "examples/demo/analisis_demo.csv").open() as archivo:
        fila = next(f for f in csv.DictReader(archivo) if f["Ticker"] == "DEMO-USA")
    assert datos["ticker"] == "DEMO-USA"
    assert datos["currency"] == "USD"
    assert datos["price"] == float(fila["Precio de mercado"]) == 100
    assert datos["median"] == float(fila["Mediana de proxies"])
    assert datos["upside"] == float(fila["Upside mediana de proxies"])
    assert [p["value"] for p in datos["proxies"]] == [
        float(fila[c])
        for c in [
            "Proxy FCL por acción",
            "Proxy NOPAT por acción",
            "Proxy EBITDA ajustado por acción",
            "Proxy utilidad neta por acción",
        ]
    ]
    manifest = json.loads((RAIZ / "examples/demo/manifest.json").read_text())
    assert datos["synthetic"] is True
    assert datos["reference_date"] == manifest["fecha_referencia"] == "2025-01-03"
    assert datos["methodology_version"] == manifest["version_metodologia"]
    assert datos["configuration"] == manifest["configuracion"]


def test_derivado_versionado_es_reproducible_y_detecta_drift(tmp_path):
    modulo = import_module("examples.exportar_demo_web")
    destino = tmp_path / "demo.json"
    assert modulo.comprobar(destino) is False
    modulo.exportar(destino)
    assert modulo.comprobar(destino) is True
    assert destino.read_bytes() == (RAIZ / "frontend/src/data/demo.json").read_bytes()
    destino.write_text("{}\n")
    assert modulo.comprobar(destino) is False
