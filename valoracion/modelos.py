"""Contrato tabular compartido de resultados y diagnósticos."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field

import pandas as pd

from .configuracion import Configuracion
from .metodologia import VERSION_CONTRATO, VERSION_METODOLOGIA
from .normalizacion import mercado_de_ticker


@dataclass(frozen=True)
class Diagnostico:
    mensaje: str
    ambito: str = "analisis"


@dataclass(frozen=True)
class TrazabilidadDatos:
    fuente: str | None = None
    obtenido_en: str | None = None
    fuente_precio: str | None = None
    fecha_precio: str | None = None
    fuente_objetivo: str | None = None
    estadistico_objetivo: str | None = None
    cobertura_analistas: int | None = None
    fecha_objetivo: str | None = None
    horizonte_objetivo: str | None = None
    fuente_acciones: str | None = None
    fecha_acciones: str | None = None
    fuente_fx: str | None = None
    fx_obtenido_en: str | None = None
    fecha_fx: str | None = None


@dataclass(frozen=True)
class DatosEmpresa:
    """Snapshot independiente del proveedor; nunca contiene un objeto de yfinance."""

    ticker: str
    info: dict = field(default_factory=dict)
    precio: float | None = None
    objetivo_analistas: float | None = None
    acciones: float | None = None
    resultados: pd.DataFrame = field(default_factory=pd.DataFrame)
    flujo: pd.DataFrame = field(default_factory=pd.DataFrame)
    balance: pd.DataFrame = field(default_factory=pd.DataFrame)
    moneda_financiera: str | None = None
    moneda_cotizacion: str | None = None
    tipo_cambio: float | None = None
    diagnosticos: tuple[Diagnostico, ...] = ()
    trazabilidad: TrazabilidadDatos = field(default_factory=TrazabilidadDatos)

    def __post_init__(self) -> None:
        object.__setattr__(self, "info", deepcopy(self.info))
        for nombre in ("resultados", "flujo", "balance"):
            object.__setattr__(self, nombre, getattr(self, nombre).copy(deep=True))
        object.__setattr__(self, "diagnosticos", tuple(self.diagnosticos))


@dataclass(frozen=True)
class ResultadoAnalisis:
    principal: dict
    detalle: dict
    configuracion: Configuracion
    diagnosticos: tuple[Diagnostico, ...] = ()
    trazabilidad: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "principal", deepcopy(self.principal))
        object.__setattr__(self, "detalle", deepcopy(self.detalle))
        object.__setattr__(self, "trazabilidad", deepcopy(self.trazabilidad))
        object.__setattr__(self, "diagnosticos", tuple(self.diagnosticos))

    def como_registros(self) -> tuple[dict, dict]:
        """Conserva la API de diccionarios y protege el snapshot del resultado."""
        return deepcopy(self.principal), deepcopy(self.detalle)


COLUMNAS_PRINCIPAL = [
    "Mercado",
    "Ticker",
    "Empresa",
    "Moneda",
    "Precio de mercado",
    "Valor intrínseco FCL",
    "Upside FCL",
    "Valor intrínseco EBIT",
    "Upside EBIT",
    "Valor intrínseco EBITDA",
    "Upside EBITDA",
    "Valor intrínseco utilidad neta",
    "Upside utilidad neta",
    "Mediana de modelos",
    "Upside mediana",
    "Precio objetivo analistas",
    "Upside analistas",
    "Estado",
    "Notas",
    "Versión metodología",
    "Versión contrato",
    "Modelos en mediana",
    "Modelos incluidos",
    "Clase de empresa",
]

COLUMNAS_DETALLE = [
    "Mercado",
    "Ticker",
    "Empresa",
    "Sector",
    "Industria",
    "Moneda estados",
    "Moneda cotización",
    "Tipo de cambio",
    "Ingresos actuales",
    "Acciones en circulación",
    "Deuda",
    "Efectivo",
    "Deuda neta",
    "Tasa de impuestos",
    "CAGR histórico ingresos",
    "Crecimiento años 1-5",
    "Crecimiento años 6-10",
    "Margen FCL mediano",
    "Margen FCL conservador",
    "Años FCL",
    "Fuente FCL",
    "Margen NOPAT mediano",
    "Margen NOPAT conservador",
    "Años EBIT",
    "Margen EBITDA ajustado mediano",
    "Margen EBITDA ajustado conservador",
    "Años EBITDA",
    "Fuente EBITDA ajustado",
    "Margen neto mediano",
    "Margen neto conservador",
    "Años utilidad neta",
    "Base FCL",
    "Base NOPAT",
    "Base EBITDA ajustado",
    "Base utilidad neta",
    "PV flujos FCL",
    "PV terminal FCL",
    "PV flujos EBIT",
    "PV terminal EBIT",
    "PV flujos EBITDA",
    "PV terminal EBITDA",
    "PV flujos utilidad neta",
    "PV terminal utilidad neta",
    "Empresa financiera",
    "Notas",
    "Versión metodología",
    "Versión contrato",
    "Fuente de datos",
    "Obtenido en UTC",
    "Fecha del precio",
    "Fuente del precio",
    "Fuente del objetivo",
    "Estadístico del objetivo",
    "Cobertura de analistas",
    "Fecha del objetivo",
    "Horizonte del objetivo",
    "Fuente FX",
    "Obtenido FX en UTC",
    "Fecha FX",
    "Período ingresos",
    "Período deuda",
    "Período efectivo",
    "Fuente deuda",
    "Fuente efectivo",
    "Períodos por modelo",
    "Fuentes por métrica",
    "Configuración efectiva",
    "Tasa descuento accionista",
    "Tasa descuento empresa",
    "Crecimiento utilizado",
    "Impuestos utilizados",
    "Modelos incluidos",
    "Modelos excluidos",
]


def crear_resultado_error(ticker: str, error: Exception) -> tuple[dict, dict]:
    """Conserva el contrato tabular aunque falle la adquisición de una empresa."""
    identidad = {
        "Mercado": mercado_de_ticker(ticker),
        "Ticker": ticker,
        "Empresa": ticker,
        "Notas": str(error),
    }
    principal = dict.fromkeys(COLUMNAS_PRINCIPAL)
    principal.update(identidad, Estado="ERROR")
    principal.update(
        {
            "Versión metodología": VERSION_METODOLOGIA,
            "Versión contrato": VERSION_CONTRATO,
            "Modelos en mediana": 0,
            "Modelos incluidos": "",
            "Clase de empresa": "NO_CLASIFICADA",
        }
    )
    detalle = dict.fromkeys(COLUMNAS_DETALLE)
    detalle.update(identidad)
    detalle.update(
        {"Versión metodología": VERSION_METODOLOGIA, "Versión contrato": VERSION_CONTRATO}
    )
    return principal, detalle
