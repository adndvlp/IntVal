"""Industrial constante: todos los importes son sintéticos, no datos de bolsa."""

from copy import deepcopy

import pandas as pd
import pytest

FECHAS = pd.date_range("2020-01-01", periods=5, freq="YS")


def estado(filas):
    return pd.DataFrame({fecha: filas.copy() for fecha in FECHAS})


class TickerSintetico:
    def __init__(self, **cambios):
        self.datos = {
            "info": {
                "shortName": "Industrial sintética",
                "currency": "USD",
                "financialCurrency": "USD",
                "sharesOutstanding": 10,
                "sector": "Industrials",
                "industry": "Manufacturing",
            },
            "fast_info": {"last_price": 40, "shares": 10},
            "income_stmt": estado(
                {
                    "Total Revenue": 1000,
                    "EBIT": 200,
                    "Net Income": 120,
                    "Tax Provision": 40,
                    "Pretax Income": 200,
                    "EBITDA": 250,
                }
            ),
            "cashflow": estado(
                {
                    "Operating Cash Flow": 180,
                    "Capital Expenditure": -50,
                    "Free Cash Flow": 130,
                    "Depreciation And Amortization": 50,
                }
            ),
            "balance_sheet": estado({"Total Debt": 300, "Cash And Cash Equivalents": 100}),
            "analyst_price_targets": {"mean": 60, "median": 55},
            "history_result": pd.DataFrame(
                {"Close": [38.0, 39.0, 40.0]},
                index=pd.date_range("2025-01-01", periods=3, tz="UTC", name="Date"),
            ),
            "shares_result": pd.Series([10.0], index=[pd.Timestamp("2024-01-01")]),
        }
        self.datos.update(deepcopy(cambios))
        self.llamadas = []

    def __getattr__(self, nombre):
        if nombre not in self.datos:
            pytest.fail(f"Acceso al proveedor sintético no preparado: {nombre}")
        valor = self.datos[nombre]
        if isinstance(valor, Exception):
            raise valor
        return valor

    def get_info(self):
        return self.get_info_result if "get_info_result" in self.datos else self.info

    def history(self, **kwargs):
        self.llamadas.append(("history", kwargs))
        return self.history_result

    def get_shares_full(self):
        return self.shares_result
