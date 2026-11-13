"""Transformaciones históricas y Excel de snapshots; sin fórmulas nuevas."""

import tempfile
from pathlib import Path

import pandas as pd

from valoracion.exportacion.excel import escribir_excel

from .adaptadores import a_json_seguro
from .errores import FalloWeb


def _fecha(valor):
    fecha = pd.Timestamp(valor)
    if pd.isna(fecha):
        raise ValueError("La observación no tiene fecha.")
    return fecha.date().isoformat()


def precios_a_items(frame):
    if frame.empty:
        return []
    # NaN en una observación ausente se representa como null; Infinity se rechaza.
    tabla = frame.sort_values("Fecha").astype(object).where(frame.notna(), None)
    return a_json_seguro(
        [
            {"date": _fecha(fila["Fecha"]), "value": fila["Cierre"]}
            for fila in tabla.to_dict(orient="records")
        ]
    )


def financieros_a_items(frames):
    def convertir(frame, columnas):
        if frame.empty:
            return []
        tabla = frame.sort_index().astype(object).where(frame.notna(), None)
        return a_json_seguro(
            [
                {
                    "year": int(fecha),
                    **{clave: fila.get(columna) for clave, columna in columnas.items()},
                }
                for fecha, fila in tabla.iterrows()
            ]
        )

    historicos, margenes = frames
    items = convertir(
        historicos,
        {
            "revenue": "Ingresos",
            "fcl": "FCL",
            "ebit": "EBIT",
            "ebitda": "EBITDA",
            "net_income": "Utilidad neta",
        },
    )
    ratios = convertir(
        margenes,
        {
            "fcl": "Margen FCL",
            "nopat": "Margen NOPAT",
            "ebitda": "Margen EBITDA bruto",
            "net_income": "Margen neto",
        },
    )
    return items, {"unit": "ratio", "items": ratios}


def exportar_snapshot(principales, detalles, config, source):
    try:
        with tempfile.TemporaryDirectory(prefix="intval-export-") as carpeta:
            archivo = Path(carpeta) / "valoraciones.xlsx"
            escribir_excel(principales, detalles, archivo, config)
            contenido = archivo.read_bytes()
        # El temporal ya está eliminado antes de comenzar la transmisión HTTP.
        nombre = "demo_valoraciones_USA_MX.xlsx" if source == "demo" else "valoraciones_USA_MX.xlsx"
        return contenido, nombre
    except Exception:
        raise FalloWeb(
            500,
            "EXPORT_FAILED",
            "No se pudo preparar el Excel. Reintenta la descarga.",
            retryable=True,
        ) from None
