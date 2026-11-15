"""Oráculo del XLSX descargado por Playwright; no ejecuta el motor."""

import argparse
import json
from contextlib import closing
from pathlib import Path

from export_contract import verificar_libro
from openpyxl import load_workbook


def verificar(archivo: Path):
    with closing(load_workbook(archivo, data_only=True)) as libro:
        assert libro.sheetnames == [
            "Resumen",
            "USA",
            "MX",
            "Detalle",
            "Supuestos",
            "Universo",
            "Fuentes",
        ]
        resumen = libro["Resumen"]
        encabezados = [celda.value for celda in resumen[3]]
        filas = {
            fila[encabezados.index("Ticker")]: dict(zip(encabezados, fila, strict=True))
            for fila in resumen.iter_rows(min_row=4, values_only=True)
        }
        assert set(filas) == {"DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"}
        assert abs(filas["DEMO-USA"]["Mediana de proxies"] - 116.1879930510067) < 1e-9
        assert abs(filas["DEMO-MX.MX"]["Mediana de proxies"] - 209.138387491812) < 1e-9
        assert filas["DEMO-INCOMPLETA"]["Mediana de proxies"] is None
        assert filas["DEMO-INCOMPLETA"]["Estado"] == "DATOS INCOMPLETOS"
        supuestos = {
            fila[0]: fila[1] for fila in libro["Supuestos"].iter_rows(min_row=4, values_only=True)
        }
        assert supuestos["Tasa descuento accionista"] == 0.1
        detalle = libro["Detalle"]
        assert detalle.max_column == 73
        fuentes = [celda.column for celda in detalle[3] if celda.value == "Fuente de datos"]
        assert len(fuentes) == 1
        for fila in range(4, detalle.max_row + 1):
            assert "sintéticos" in detalle.cell(fila, fuentes[0]).value
    print("Excel real: siete hojas, tres empresas, cifras/ausencias y supuestos conciliados.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archivo", type=Path)
    parser.add_argument("--snapshot", type=Path)
    args = parser.parse_args()
    if args.snapshot:
        verificar_libro(args.archivo, json.loads(args.snapshot.read_text(encoding="utf-8")))
        print("Excel y snapshot conciliados: siete hojas y lote completo.")
    else:
        verificar(args.archivo)
