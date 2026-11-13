"""Orquestación del proveedor y cálculo; sin dependencias de interfaz o Excel."""

from __future__ import annotations

import pandas as pd

from .calculos import preparar_historicos_financieros, valorar_empresa
from .configuracion import Configuracion
from .modelos import ResultadoAnalisis
from .proveedores.base import ProveedorDatos


def _resolver_proveedor(proveedor: ProveedorDatos | None) -> ProveedorDatos:
    if proveedor is None:
        from .proveedores.yahoo import PROVEEDOR_YAHOO
        return PROVEEDOR_YAHOO
    return proveedor


def analizar_empresa(
    ticker: str,
    config: Configuracion,
    mercado: str | None = None,
    *,
    proveedor: ProveedorDatos | None = None,
) -> ResultadoAnalisis:
    datos = _resolver_proveedor(proveedor).obtener_empresa(ticker)
    return valorar_empresa(datos, config, mercado)


def analizar_ticker(
    ticker: str,
    config: Configuracion,
    mercado: str | None = None,
    *,
    proveedor: ProveedorDatos | None = None,
) -> tuple[dict, dict]:
    return analizar_empresa(ticker, config, mercado, proveedor=proveedor).como_registros()


def obtener_precio_historico(
    ticker: str, periodo: str, *, proveedor: ProveedorDatos | None = None,
) -> pd.DataFrame:
    return _resolver_proveedor(proveedor).obtener_precio_historico(ticker, periodo).copy(deep=True)


def obtener_historicos_financieros(
    ticker: str, config: Configuracion, *, proveedor: ProveedorDatos | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    datos = _resolver_proveedor(proveedor).obtener_estados_historicos(ticker)
    return preparar_historicos_financieros(datos, config)
