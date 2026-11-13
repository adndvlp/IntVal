"""Carga y validación del catálogo local; no consulta proveedores externos."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from types import MappingProxyType
from typing import Mapping

from .normalizacion import mercado_de_ticker


@dataclass(frozen=True)
class CatalogoEmpresas:
    usa: tuple[str, ...]
    mx: tuple[str, ...]
    fuentes: tuple[Mapping[str, str], ...]
    fecha_snapshot: str
    fecha_verificacion_fuentes: str | None
    descripcion: str

    @property
    def todos(self) -> tuple[str, ...]:
        return self.usa + self.mx


def cargar_universo(ruta: Path | None = None) -> CatalogoEmpresas:
    ruta = (
        Path(ruta)
        if ruta is not None
        else Path(__file__).resolve().parent.parent / "data" / "universo.json"
    )
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    if (
        not isinstance(datos, dict)
        or type(datos.get("version")) is not int
        or datos["version"] != 1
    ):
        raise ValueError("El catálogo debe declarar la versión 1.")
    for campo in ("fecha_snapshot", "fecha_verificacion_fuentes"):
        valor = datos.get(campo)
        if valor is None and campo == "fecha_verificacion_fuentes":
            continue
        try:
            date.fromisoformat(valor)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{campo} debe ser una fecha ISO válida.") from exc
    descripcion = datos.get("descripcion")
    if not isinstance(descripcion, str) or not descripcion.strip():
        raise ValueError("El catálogo debe describir el significado de su snapshot.")
    mercados = datos.get("mercados")
    if not isinstance(mercados, dict) or set(mercados) != {"USA", "MX"}:
        raise ValueError("El catálogo debe declarar los mercados USA y MX.")
    vistos: set[str] = set()
    for mercado, tickers in mercados.items():
        if not isinstance(tickers, list):
            raise ValueError(f"Los tickers de {mercado} deben formar una lista.")
        for ticker in tickers:
            if (
                not isinstance(ticker, str)
                or not ticker
                or ticker != ticker.strip().upper()
                or any(c.isspace() for c in ticker)
            ):
                raise ValueError(f"Identidad de ticker inválida en {mercado}: {ticker!r}")
            if mercado_de_ticker(ticker) != mercado:
                raise ValueError(f"El ticker {ticker} no corresponde al mercado {mercado}.")
            if ticker in vistos:
                raise ValueError(f"Ticker duplicado: {ticker}")
            vistos.add(ticker)
    fuentes = datos.get("fuentes")
    if not isinstance(fuentes, list):
        raise ValueError("Las fuentes del catálogo deben formar una lista.")
    for fuente in fuentes:
        if not isinstance(fuente, dict) or fuente.get("Mercado") not in mercados:
            raise ValueError("Cada fuente debe identificar su mercado.")
        for campo in ("Fuente", "Descripción", "URL"):
            if not isinstance(fuente.get(campo), str) or not fuente[campo].strip():
                raise ValueError(f"Falta {campo} en una fuente del catálogo.")
    return CatalogoEmpresas(
        usa=tuple(mercados["USA"]),
        mx=tuple(mercados["MX"]),
        fuentes=tuple(MappingProxyType(dict(fuente)) for fuente in fuentes),
        fecha_snapshot=datos["fecha_snapshot"],
        fecha_verificacion_fuentes=datos.get("fecha_verificacion_fuentes"),
        descripcion=descripcion,
    )


CATALOGO = cargar_universo()
# Listas heredadas para conservar la API; el snapshot interno es inmutable.
EMPRESAS_USA = list(CATALOGO.usa)
EMPRESAS_MX = list(CATALOGO.mx)
EMPRESAS = list(CATALOGO.todos)
FUENTES_UNIVERSO = [dict(fuente) for fuente in CATALOGO.fuentes]
