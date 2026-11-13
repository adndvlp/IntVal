"""Formatos legibles para valores disponibles y ausentes."""

from __future__ import annotations

import math


def format_money(value: object, currency: str | None = None) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "—"
    if not math.isfinite(number):
        return "—"
    symbol = "$"
    suffix = f" {currency}" if currency else ""
    return f"{symbol}{number:,.2f}{suffix}"


def format_percent(value: object) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "—"
    if not math.isfinite(number):
        return "—"
    return f"{number:.1%}"
