"""Normalización de datos y utilidades sin adquisición ni escritura."""

from __future__ import annotations

import math
from typing import Iterable

import numpy as np
import pandas as pd


def mercado_de_ticker(ticker: str) -> str:
    return "MX" if ticker.upper().endswith(".MX") else "USA"


def eliminar_duplicados(items: Iterable[str]) -> list[str]:
    """Elimina duplicados sin cambiar el orden."""
    return list(dict.fromkeys(items))


def numero_valido(valor) -> float | None:
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return None
    return numero if math.isfinite(numero) else None


def normalizar_etiqueta(texto: object) -> str:
    return "".join(caracter.lower() for caracter in str(texto) if caracter.isalnum())


def obtener_fila(
    estado: pd.DataFrame | None,
    candidatos: list[str],
) -> pd.Series:
    """Busca una línea contable ignorando mayúsculas, espacios y signos."""
    if estado is None or estado.empty:
        return pd.Series(dtype=float)

    mapa = {normalizar_etiqueta(indice): indice for indice in estado.index}

    for candidato in candidatos:
        indice_real = mapa.get(normalizar_etiqueta(candidato))
        if indice_real is not None:
            fila = estado.loc[indice_real]
            if isinstance(fila, pd.DataFrame):
                fila = fila.iloc[0]
            fila = pd.to_numeric(fila, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
            return fila.sort_index()

    return pd.Series(dtype=float)


def ultimo_valor(serie: pd.Series) -> float | None:
    if serie is None or serie.empty:
        return None
    serie = pd.to_numeric(serie, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if serie.empty:
        return None
    return numero_valido(serie.iloc[-1])


def alinear_series(*series: pd.Series) -> pd.DataFrame:
    limpias = []
    for posicion, serie in enumerate(series):
        if serie is None:
            serie = pd.Series(dtype=float)
        limpia = pd.to_numeric(serie, errors="coerce").replace([np.inf, -np.inf], np.nan)
        limpias.append(limpia.rename(f"s{posicion}"))
    if not limpias:
        return pd.DataFrame()
    return pd.concat(limpias, axis=1, join="inner").dropna()


def convertir_serie(serie: pd.Series, fx: float) -> pd.Series:
    if fx is None:
        return pd.Series(dtype=float)
    return pd.to_numeric(serie, errors="coerce") * fx
