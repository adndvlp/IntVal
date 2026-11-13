"""Supuestos y validación compartidos por todas las entradas."""

from __future__ import annotations

import math
from dataclasses import dataclass, fields


@dataclass(frozen=True)
class Configuracion:
    anos_proyeccion: int = 10
    tasa_descuento: float = 0.10

    # Replica la lógica conservadora del Excel:
    # crecimiento años 1-5 = CAGR histórico × 25 %
    # crecimiento años 6-10 = crecimiento inicial × 50 %
    factor_crecimiento_inicial: float = 0.25
    factor_crecimiento_final: float = 0.50
    crecimiento_minimo: float = -0.02
    crecimiento_maximo: float = 0.12
    crecimiento_fallback: float = 0.03

    # Margen histórico normalizado × 80 %
    factor_margen_conservador: float = 0.80
    max_anos_historicos: int = 5

    # Múltiplos terminales editables
    multiplo_terminal_fcl: float = 12.0
    multiplo_terminal_ebit: float = 12.0
    multiplo_terminal_ebitda: float = 12.0
    multiplo_terminal_utilidad_neta: float = 15.0

    tasa_impuestos_fallback: float = 0.21
    tasa_impuestos_minima: float = 0.00
    tasa_impuestos_maxima: float = 0.35

    pausa_entre_tickers: float = 0.35

    def __post_init__(self) -> None:
        for campo in fields(self):
            valor = getattr(self, campo.name)
            if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor):
                raise ValueError(f"{campo.name} debe ser un número finito.")
        for nombre in ("anos_proyeccion", "max_anos_historicos"):
            valor = getattr(self, nombre)
            if not isinstance(valor, int) or valor <= 0:
                raise ValueError(f"{nombre} debe ser un entero positivo.")
        if self.tasa_descuento <= -1:
            raise ValueError("La tasa de descuento debe ser mayor que -1.")
        for nombre in ("factor_crecimiento_inicial", "factor_crecimiento_final", "factor_margen_conservador"):
            if not 0 <= getattr(self, nombre) <= 1:
                raise ValueError(f"{nombre} debe estar entre 0 y 1.")
        if min(self.crecimiento_minimo, self.crecimiento_maximo, self.crecimiento_fallback) <= -1:
            raise ValueError("Las tasas de crecimiento deben ser mayores que -1.")
        if self.crecimiento_minimo > self.crecimiento_maximo:
            raise ValueError("El crecimiento mínimo no puede superar al máximo.")
        for nombre in ("multiplo_terminal_fcl", "multiplo_terminal_ebit", "multiplo_terminal_ebitda", "multiplo_terminal_utilidad_neta"):
            if getattr(self, nombre) <= 0:
                raise ValueError(f"{nombre} debe ser positivo.")
        if not 0 <= self.tasa_impuestos_minima <= self.tasa_impuestos_fallback <= self.tasa_impuestos_maxima <= 1:
            raise ValueError("Las tasas de impuestos deben tener límites coherentes entre 0 y 1.")
        if self.pausa_entre_tickers < 0:
            raise ValueError("La pausa entre tickers no puede ser negativa.")


CONFIG = Configuracion()
