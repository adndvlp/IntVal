"""Políticas de proxies-1.0. Justificación y límites en docs/methodology.md."""

from __future__ import annotations

from .normalizacion import numero_valido

VERSION_METODOLOGIA = "proxies-1.0"
VERSION_CONTRATO = "2.0"
MODELOS = {
    "FCL": "Valor intrínseco FCL",
    "NOPAT": "Valor intrínseco EBIT",
    "EBITDA_AJUSTADO": "Valor intrínseco EBITDA",
    "UTILIDAD_NETA": "Valor intrínseco utilidad neta",
}


def tipo_cambio_valido(origen: str | None, destino: str | None, valor) -> float | None:
    if not isinstance(origen, str) or not isinstance(destino, str):
        return None
    origen, destino = origen.strip().upper(), destino.strip().upper()
    if not origen or not destino:
        return None
    if origen == destino:
        return 1.0
    factor = numero_valido(valor)
    return factor if factor is not None and factor > 0 else None


def clasificar_empresa(info: dict) -> str:
    tipo = str(info.get("quoteType") or "").upper()
    if tipo in {"ETF", "MUTUALFUND", "INDEX", "CRYPTOCURRENCY", "CURRENCY", "FUTURE"}:
        return "NO_OPERATIVA"
    texto = " ".join(
        str(info.get(k) or "") for k in ("sector", "industry", "shortName", "longName")
    ).lower()
    if "reit" in texto or "fibra" in texto:
        return "REIT_FIBRA"
    if any(
        p in texto
        for p in (
            "financial",
            "bank",
            "insurance",
            "capital markets",
            "credit services",
            "asset management",
        )
    ):
        return "FINANCIERA"
    if info.get("sector") or tipo == "EQUITY":
        return "OPERATIVA"
    return "NO_CLASIFICADA"
