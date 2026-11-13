"""Conversión explícita a JSON: nunca oculta números inválidos con cadenas."""

import math
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd


def a_json_seguro(valor):
    if valor is None or valor is pd.NA or valor is pd.NaT:
        return None
    if isinstance(valor, (str, bool, int)):
        return valor
    if isinstance(valor, np.bool_):
        return bool(valor)
    if isinstance(valor, np.integer):
        return int(valor)
    if isinstance(valor, (float, np.floating)):
        numero = float(valor)
        if not math.isfinite(numero):
            raise ValueError("El número debe ser finito para transportarlo como JSON.")
        return numero
    if isinstance(valor, datetime):
        if valor.tzinfo is None or valor.utcoffset() is None:
            raise ValueError("El instante requiere una zona horaria explícita.")
        return valor.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(valor, date):
        return valor.isoformat()
    if isinstance(valor, dict):
        if not all(isinstance(clave, str) for clave in valor):
            raise TypeError("JSON requiere claves de texto.")
        return {clave: a_json_seguro(dato) for clave, dato in valor.items()}
    if isinstance(valor, (list, tuple)):
        return [a_json_seguro(dato) for dato in valor]
    raise TypeError(f"Tipo no admitido en el transporte JSON: {type(valor).__name__}.")
