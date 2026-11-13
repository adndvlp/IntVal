"""Ajustes operativos leídos al crear cada instancia de la API."""

import os
from dataclasses import dataclass
from urllib.parse import urlsplit


def _bandera(nombre: str, defecto: str) -> bool:
    valor = os.environ.get(nombre, defecto)
    if valor not in {"0", "1"}:
        raise ValueError(f"{nombre} debe ser 0 o 1.")
    return valor == "1"


def _origenes() -> tuple[str, ...]:
    nombre = "VALORACION_CORS_ORIGINS"
    texto = os.environ.get(nombre, "")
    if not texto.strip():
        return ()
    valores = tuple(dict.fromkeys(origen.strip() for origen in texto.split(",")))
    for origen in valores:
        try:
            partes = urlsplit(origen)
            valido = (
                partes.scheme in {"http", "https"}
                and partes.hostname
                and partes.hostname != "*"
                and not partes.username
                and not partes.password
                and not partes.path
                and not partes.query
                and not partes.fragment
                and not any(c.isspace() for c in origen)
            )
            partes.port  # También valida puertos fuera de rango o no numéricos.
        except ValueError:
            valido = False
        if not valido:
            raise ValueError(f"{nombre} requiere orígenes HTTP(S) explícitos, sin rutas.")
    return valores


@dataclass(frozen=True)
class Ajustes:
    demo: bool = False
    mercado_habilitado: bool = True
    max_tickers: int = 650
    origenes_cors: tuple[str, ...] = ()

    @property
    def fuente_default(self) -> str:
        return "demo" if self.demo or not self.mercado_habilitado else "market"

    @classmethod
    def del_entorno(cls) -> "Ajustes":
        nombre = "VALORACION_MAX_TICKERS"
        texto = os.environ.get(nombre, "650")
        if not texto.isascii() or not texto.isdecimal() or int(texto) <= 0:
            raise ValueError(f"{nombre} debe ser un entero positivo.")
        return cls(
            demo=_bandera("VALORACION_DEMO", "0"),
            mercado_habilitado=_bandera("VALORACION_MARKET_ENABLED", "1"),
            max_tickers=int(texto),
            origenes_cors=_origenes(),
        )
