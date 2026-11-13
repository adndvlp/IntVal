"""Escenarios de equivalencia contra el motor de F1, commit b9852e6."""

from dataclasses import replace

import pandas as pd

from tests.fixtures.datos_sinteticos import TickerSintetico
from valoracion.configuracion import Configuracion

CASOS = [
    "completa_default",
    "completa_simple",
    "sin_acciones",
    "sin_flujo",
    "financiera",
    "crecimiento_fallback",
    "solo_neta",
    "fx_ausente",
]


def escenario(caso):
    ticker = TickerSintetico()
    config = Configuracion()
    if caso == "completa_simple":
        config = replace(
            config,
            anos_proyeccion=3,
            tasa_descuento=0,
            multiplo_terminal_fcl=2,
            multiplo_terminal_ebit=2,
            multiplo_terminal_ebitda=2,
            multiplo_terminal_utilidad_neta=2,
        )
    elif caso == "sin_acciones":
        ticker.datos["info"].pop("sharesOutstanding")
        ticker.datos["fast_info"] = {"last_price": 40}
        ticker.datos["shares_result"] = pd.Series(dtype=float)
    elif caso == "sin_flujo":
        ticker.datos["cashflow"] = RuntimeError("Flujo no disponible")
    elif caso == "financiera":
        ticker.datos["info"]["sector"] = "Financial Services"
    elif caso == "crecimiento_fallback":
        ticker.datos["income_stmt"] = ticker.income_stmt.iloc[:, -1:]
    elif caso == "solo_neta":
        ticker.datos["income_stmt"] = ticker.income_stmt.loc[["Total Revenue", "Net Income"]]
        ticker.datos["cashflow"] = pd.DataFrame()
    elif caso == "fx_ausente":
        ticker.datos["info"].update(financialCurrency="USD", currency="MXN")
    return ticker, config
