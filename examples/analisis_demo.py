"""Genera el ejemplo público con los mismos datos, motor y Excel de la demo UI."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

import pandas as pd

from valoracion.configuracion import Configuracion
from valoracion.exportacion.excel import escribir_excel
from valoracion.metodologia import VERSION_CONTRATO, VERSION_METODOLOGIA
from valoracion.presentacion.etiquetas import ETIQUETAS
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.servicio import analizar_empresa


def generar(destino: Path, *, config: Configuracion | None = None) -> tuple[list[dict], list[dict]]:
    destino = Path(destino)
    destino.mkdir(parents=True, exist_ok=True)
    config = config or Configuracion(tasa_descuento_empresa=0.1, pausa_entre_tickers=0)
    proveedor = ProveedorDemo()
    registros = [
        analizar_empresa(ticker, config, proveedor=proveedor).como_registros()
        for ticker in proveedor.tickers()
    ]
    principales = [principal for principal, _ in registros]
    detalles = [detalle for _, detalle in registros]
    pd.DataFrame(principales).rename(columns=ETIQUETAS).to_csv(
        destino / "analisis_demo.csv",
        index=False,
        encoding="utf-8",
        lineterminator="\n",
    )
    escribir_excel(principales, detalles, destino / "analisis_demo.xlsx", config)
    manifest = {
        "datos_sinteticos": True,
        "version_datos": proveedor.version,
        "fecha_referencia": proveedor.fecha_referencia,
        "version_metodologia": VERSION_METODOLOGIA,
        "version_contrato": VERSION_CONTRATO,
        "configuracion": asdict(config),
        "archivos": ["analisis_demo.csv", "analisis_demo.xlsx"],
    }
    (destino / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return principales, detalles


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=Path(__file__).resolve().parent / "salida/demo"
    )
    args = parser.parse_args()
    principales, _ = generar(args.output)
    print(f"{len(principales)} casos sintéticos exportados en {args.output}")


if __name__ == "__main__":
    main()
