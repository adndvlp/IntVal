"""Selección de tickers y ejecución por terminal; comparte el servicio de análisis."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from .configuracion import CONFIG
from .exportacion.excel import escribir_excel
from .modelos import crear_resultado_error
from .normalizacion import eliminar_duplicados, mercado_de_ticker
from .servicio import analizar_ticker
from .universo import EMPRESAS, EMPRESAS_MX, EMPRESAS_USA


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Valora acciones de USA y México y genera un archivo Excel."
    )
    parser.add_argument(
        "--output",
        default="valoraciones_empresas.xlsx",
        help="Ruta del archivo .xlsx de salida.",
    )
    parser.add_argument(
        "--mercado",
        choices=["USA", "MX", "TODOS"],
        default="TODOS",
        help="Universo predeterminado cuando no se indican tickers.",
    )
    parser.add_argument(
        "--ticker",
        action="append",
        dest="tickers",
        help="Ticker específico. Puede repetirse.",
    )
    argumentos = parser.parse_args()

    if argumentos.tickers:
        tickers = eliminar_duplicados(argumentos.tickers)
    elif argumentos.mercado == "USA":
        tickers = EMPRESAS_USA
    elif argumentos.mercado == "MX":
        tickers = EMPRESAS_MX
    else:
        tickers = EMPRESAS

    salida = Path(argumentos.output).expanduser().resolve()
    principales: list[dict] = []
    detalles: list[dict] = []

    print(f"Analizando {len(tickers)} empresas...")
    for posicion, ticker in enumerate(tickers, start=1):
        print(f"[{posicion:02d}/{len(tickers):02d}] {ticker}...", end=" ", flush=True)
        mercado = mercado_de_ticker(ticker)
        try:
            principal, detalle = analizar_ticker(ticker, CONFIG, mercado)
            principales.append(principal)
            detalles.append(detalle)
            print(principal["Estado"])
        except Exception as exc:
            print(f"ERROR: {exc}")
            principal, detalle = crear_resultado_error(ticker, exc)
            principales.append(principal)
            detalles.append(detalle)
        time.sleep(CONFIG.pausa_entre_tickers)

    escribir_excel(principales, detalles, salida, CONFIG)
    print(f"\nArchivo generado: {salida}")
