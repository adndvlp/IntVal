"""Conversión explícita a JSON: nunca oculta números inválidos con cadenas."""

import json
import math
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd

from valoracion.presentacion.etiquetas import etiqueta

# Mapeo explícito del contrato financiero 2.0 a identificadores de transporte.
CAMPOS_AUDITORIA = {
    "market": "Mercado",
    "ticker": "Ticker",
    "company_name": "Empresa",
    "sector": "Sector",
    "industry": "Industria",
    "reporting_currency": "Moneda estados",
    "quote_currency": "Moneda cotización",
    "fx_rate": "Tipo de cambio",
    "current_revenue": "Ingresos actuales",
    "shares_outstanding": "Acciones en circulación",
    "debt": "Deuda",
    "cash": "Efectivo",
    "net_debt": "Deuda neta",
    "tax_rate": "Tasa de impuestos",
    "historical_revenue_cagr": "CAGR histórico ingresos",
    "growth_years_1_5": "Crecimiento años 1-5",
    "growth_years_6_10": "Crecimiento años 6-10",
    "median_fcl_margin": "Margen FCL mediano",
    "conservative_fcl_margin": "Margen FCL conservador",
    "fcl_years": "Años FCL",
    "fcl_source": "Fuente FCL",
    "median_nopat_margin": "Margen NOPAT mediano",
    "conservative_nopat_margin": "Margen NOPAT conservador",
    "nopat_years": "Años EBIT",
    "median_adjusted_ebitda_margin": "Margen EBITDA ajustado mediano",
    "conservative_adjusted_ebitda_margin": "Margen EBITDA ajustado conservador",
    "adjusted_ebitda_years": "Años EBITDA",
    "adjusted_ebitda_source": "Fuente EBITDA ajustado",
    "median_net_margin": "Margen neto mediano",
    "conservative_net_margin": "Margen neto conservador",
    "net_income_years": "Años utilidad neta",
    "fcl_base": "Base FCL",
    "nopat_base": "Base NOPAT",
    "adjusted_ebitda_base": "Base EBITDA ajustado",
    "net_income_base": "Base utilidad neta",
    "fcl_cash_flows_pv": "PV flujos FCL",
    "fcl_terminal_pv": "PV terminal FCL",
    "nopat_cash_flows_pv": "PV flujos EBIT",
    "nopat_terminal_pv": "PV terminal EBIT",
    "adjusted_ebitda_cash_flows_pv": "PV flujos EBITDA",
    "adjusted_ebitda_terminal_pv": "PV terminal EBITDA",
    "net_income_cash_flows_pv": "PV flujos utilidad neta",
    "net_income_terminal_pv": "PV terminal utilidad neta",
    "financial_company": "Empresa financiera",
    "notes": "Notas",
    "methodology_version": "Versión metodología",
    "financial_contract_version": "Versión contrato",
    "data_source": "Fuente de datos",
    "fetched_at": "Obtenido en UTC",
    "price_date": "Fecha del precio",
    "price_source": "Fuente del precio",
    "target_source": "Fuente del objetivo",
    "target_statistic": "Estadístico del objetivo",
    "analyst_coverage": "Cobertura de analistas",
    "target_date": "Fecha del objetivo",
    "target_horizon": "Horizonte del objetivo",
    "fx_source": "Fuente FX",
    "fx_fetched_at": "Obtenido FX en UTC",
    "fx_date": "Fecha FX",
    "revenue_period": "Período ingresos",
    "debt_period": "Período deuda",
    "cash_period": "Período efectivo",
    "debt_source": "Fuente deuda",
    "cash_source": "Fuente efectivo",
    "model_periods": "Períodos por modelo",
    "metric_sources": "Fuentes por métrica",
    "effective_configuration": "Configuración efectiva",
    "equity_discount_rate": "Tasa descuento accionista",
    "enterprise_discount_rate": "Tasa descuento empresa",
    "growth_used": "Crecimiento utilizado",
    "taxes_used": "Impuestos utilizados",
    "included_models": "Modelos incluidos",
    "excluded_models": "Modelos excluidos",
}

MODELOS = (
    ("fcl", "FCL", "FCL"),
    ("nopat", "NOPAT", "EBIT"),
    ("ebitda_adjusted", "EBITDA_AJUSTADO", "EBITDA"),
    ("net_income", "UTILIDAD_NETA", "utilidad neta"),
)


def empresa_a_dto(principal: dict, detalle: dict) -> dict:
    incluidos = {m.strip() for m in (principal["Modelos incluidos"] or "").split(",")}
    excluidos = json.loads(detalle["Modelos excluidos"] or "{}")
    trazas = {
        "source": "Fuente de datos",
        "fetched_at": "Obtenido en UTC",
        "price_date": "Fecha del precio",
        "price_source": "Fuente del precio",
        "reporting_currency": "Moneda estados",
        "quote_currency": "Moneda cotización",
        "fx_rate": "Tipo de cambio",
        "fx_source": "Fuente FX",
        "fx_fetched_at": "Obtenido FX en UTC",
        "fx_date": "Fecha FX",
        "revenue_period": "Período ingresos",
        "debt_period": "Período deuda",
        "cash_period": "Período efectivo",
    }
    return a_json_seguro(
        {
            "ticker": principal["Ticker"],
            "market": principal["Mercado"],
            "company_name": principal["Empresa"],
            "currency": principal["Moneda"],
            "market_price": principal["Precio de mercado"],
            "proxies": [
                {
                    "id": identificador,
                    "value_per_share": principal[f"Valor intrínseco {alias}"],
                    "upside": principal[f"Upside {alias}"],
                    "included": dominio in incluidos,
                    "exclusion_reason": excluidos.get(dominio),
                }
                for identificador, dominio, alias in MODELOS
            ],
            "median": {
                "value_per_share": principal["Mediana de modelos"],
                "upside": principal["Upside mediana"],
                "count": principal["Modelos en mediana"],
                "included_models": [i for i, d, _ in MODELOS if d in incluidos],
            },
            "analyst_target": {
                "value": principal["Precio objetivo analistas"],
                "upside": principal["Upside analistas"],
                "statistic": detalle["Estadístico del objetivo"],
                "coverage": detalle["Cobertura de analistas"],
                "date": detalle["Fecha del objetivo"],
                "horizon": detalle["Horizonte del objetivo"],
                "source": detalle["Fuente del objetivo"],
            },
            "status": principal["Estado"],
            "notes": principal["Notas"],
            "company_class": principal["Clase de empresa"],
            "traceability": {k: detalle[v] for k, v in trazas.items()},
            "audit_fields": [
                {"key": k, "domain_key": v, "label": etiqueta(v), "value": detalle[v]}
                for k, v in CAMPOS_AUDITORIA.items()
            ],
        }
    )


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
