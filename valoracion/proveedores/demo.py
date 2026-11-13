"""Proveedor determinista de archivos sintéticos; no importa clientes de mercado."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from ..modelos import DatosEmpresa, Diagnostico, TrazabilidadDatos
from ..normalizacion import mercado_de_ticker

DIRECTORIO_DEMO = Path(__file__).resolve().parents[2] / "data" / "demo"


class ProveedorDemo:
    def __init__(self, directorio: Path = DIRECTORIO_DEMO):
        self.directorio = Path(directorio)
        catalogo = json.loads((self.directorio / "empresas.json").read_text(encoding="utf-8"))
        self.version = catalogo["version"]
        self.fecha_referencia = catalogo["fecha_referencia"]
        self._empresas = {empresa["ticker"]: empresa for empresa in catalogo["empresas"]}
        self._estados = pd.read_csv(self.directorio / "estados.csv", parse_dates=["periodo"])
        self._precios = pd.read_csv(self.directorio / "precios.csv", parse_dates=["fecha"])

    def tickers(self, mercado: str | None = None) -> list[str]:
        return [
            ticker
            for ticker in self._empresas
            if mercado in (None, "Todos", mercado_de_ticker(ticker))
        ]

    def _empresa(self, ticker: str) -> dict:
        if ticker not in self._empresas:
            raise ValueError(f"Ticker no disponible en la demostración: {ticker}")
        return self._empresas[ticker]

    def obtener_empresa(self, ticker: str) -> DatosEmpresa:
        empresa = self._empresa(ticker)
        tabla = self._estados[self._estados["ticker"] == ticker].set_index("periodo").sort_index()

        def estado(campos):
            return tabla[list(campos)].rename(columns=campos).T

        fuente = (
            f"Datos sintéticos de demostración {self.version}; referencia {self.fecha_referencia}"
        )
        moneda = empresa["moneda"]
        return DatosEmpresa(
            ticker=ticker,
            info={
                "shortName": empresa["nombre"],
                "sector": "Industrials",
                "industry": "Manufacturing (demo)",
                "quoteType": "EQUITY",
            },
            precio=empresa["precio"],
            objetivo_analistas=empresa["objetivo"],
            acciones=empresa["acciones"],
            resultados=estado(
                {
                    "ingresos": "Total Revenue",
                    "ebit": "EBIT",
                    "utilidad_neta": "Net Income",
                    "impuestos": "Tax Provision",
                    "pretax": "Pretax Income",
                    "ebitda": "EBITDA",
                }
            ),
            flujo=estado(
                {
                    "cfo": "Operating Cash Flow",
                    "capex": "Capital Expenditure",
                    "fcl": "Free Cash Flow",
                }
            ),
            balance=estado({"deuda": "Total Debt", "efectivo": "Cash And Cash Equivalents"}),
            moneda_financiera=moneda,
            moneda_cotizacion=moneda,
            tipo_cambio=1,
            diagnosticos=(
                Diagnostico(
                    f"Demostración: {fuente}. No son cotizaciones ni empresas reales.", "demo"
                ),
            ),
            trazabilidad=TrazabilidadDatos(
                fuente=fuente,
                fuente_precio="data/demo/precios.csv (sintético)",
                fecha_precio=self.fecha_referencia,
                fuente_objetivo="data/demo/empresas.json (objetivo ficticio)",
                estadistico_objetivo="sintético",
                fuente_acciones="data/demo/empresas.json (acciones ficticias)",
                fecha_acciones=self.fecha_referencia,
                fuente_fx=f"Identidad {moneda}/{moneda} (datos sintéticos)",
            ),
        )

    def obtener_estados_historicos(self, ticker: str) -> DatosEmpresa:
        return self.obtener_empresa(ticker)

    def obtener_precio_historico(self, ticker: str, periodo: str) -> pd.DataFrame:
        self._empresa(ticker)
        anos = {"1y": 1, "2y": 2, "5y": 5, "10y": 10}
        if periodo not in anos:
            raise ValueError(f"Periodo de demostración no disponible: {periodo}")
        inicio = pd.Timestamp(self.fecha_referencia) - pd.DateOffset(years=anos[periodo])
        precios = self._precios[
            (self._precios["ticker"] == ticker) & (self._precios["fecha"] >= inicio)
        ]
        return (
            precios[["fecha", "cierre"]]
            .rename(columns={"fecha": "Fecha", "cierre": "Cierre"})
            .reset_index(drop=True)
            .copy(deep=True)
        )
