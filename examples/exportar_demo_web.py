"""Deriva el ejemplo del hero desde los artefactos públicos, sin ejecutar el motor."""

import argparse
import csv
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
DESTINO = RAIZ / "frontend/src/data/demo.json"


def contenido() -> str:
    manifest = json.loads((RAIZ / "examples/demo/manifest.json").read_text(encoding="utf-8"))
    with (RAIZ / "examples/demo/analisis_demo.csv").open(encoding="utf-8", newline="") as archivo:
        fila = next(fila for fila in csv.DictReader(archivo) if fila["Ticker"] == "DEMO-USA")
    columnas = {
        "FCL": "Proxy FCL por acción",
        "NOPAT": "Proxy NOPAT por acción",
        "EBITDA ajustado": "Proxy EBITDA ajustado por acción",
        "Utilidad neta": "Proxy utilidad neta por acción",
    }
    datos = {
        "synthetic": manifest["datos_sinteticos"],
        "dataset_version": manifest["version_datos"],
        "reference_date": manifest["fecha_referencia"],
        "methodology_version": manifest["version_metodologia"],
        "configuration": manifest["configuracion"],
        "ticker": fila["Ticker"],
        "company": fila["Empresa"],
        "currency": fila["Moneda"],
        "price": float(fila["Precio de mercado"]),
        "median": float(fila["Mediana de proxies"]),
        "upside": float(fila["Upside mediana de proxies"]),
        "proxies": [
            {"label": nombre, "value": float(fila[columna])} for nombre, columna in columnas.items()
        ],
    }
    return json.dumps(datos, ensure_ascii=False, indent=2, allow_nan=False) + "\n"


def exportar(destino: Path = DESTINO) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(contenido(), encoding="utf-8")


def comprobar(destino: Path = DESTINO) -> bool:
    return destino.is_file() and destino.read_text(encoding="utf-8") == contenido()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        if not comprobar():
            print("Demo web desactualizada: ejecuta python -m examples.exportar_demo_web.")
            return 1
    else:
        exportar()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
