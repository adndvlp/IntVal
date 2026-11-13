"""Datos requeridos por el servicio; independiente de la API de cada proveedor."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

import pandas as pd

from ..modelos import DatosEmpresa


@runtime_checkable
class ProveedorDatos(Protocol):
    def obtener_empresa(self, ticker: str) -> DatosEmpresa: ...

    def obtener_precio_historico(self, ticker: str, periodo: str) -> pd.DataFrame: ...

    def obtener_estados_historicos(self, ticker: str) -> DatosEmpresa: ...
