"""Oráculo de paridad API/XLSX; no importa ni ejecuta fórmulas del motor."""

import json
import math
from contextlib import closing
from pathlib import Path

from openpyxl import load_workbook

HOJAS = ["Resumen", "USA", "MX", "Detalle", "Supuestos", "Universo", "Fuentes"]
MODELOS = [
    ("fcl", "FCL", "Proxy FCL por acción", "Upside proxy FCL"),
    ("nopat", "NOPAT", "Proxy NOPAT por acción", "Upside proxy NOPAT"),
    (
        "ebitda_adjusted",
        "EBITDA_AJUSTADO",
        "Proxy EBITDA ajustado por acción",
        "Upside proxy EBITDA ajustado",
    ),
    ("net_income", "UTILIDAD_NETA", "Proxy utilidad neta por acción", "Upside proxy utilidad neta"),
]
SUPUESTOS = {
    "Años de proyección": "anos_proyeccion",
    "Tasa descuento accionista": "tasa_descuento",
    "Tasa descuento empresa": "tasa_descuento_empresa",
    "Factor crecimiento años 1-5": "factor_crecimiento_inicial",
    "Factor crecimiento años 6-10": "factor_crecimiento_final",
    "Crecimiento mínimo": "crecimiento_minimo",
    "Crecimiento máximo": "crecimiento_maximo",
    "Crecimiento fallback": "crecimiento_fallback",
    "Factor margen conservador": "factor_margen_conservador",
    "Múltiplo terminal FCL": "multiplo_terminal_fcl",
    "Múltiplo terminal EBIT/NOPAT": "multiplo_terminal_ebit",
    "Múltiplo terminal EBITDA ajustado": "multiplo_terminal_ebitda",
    "Múltiplo terminal utilidad neta": "multiplo_terminal_utilidad_neta",
}
TRAZAS = {
    "source": "data_source",
    "fetched_at": "fetched_at",
    "price_date": "price_date",
    "price_source": "price_source",
    "reporting_currency": "reporting_currency",
    "quote_currency": "quote_currency",
    "fx_rate": "fx_rate",
    "fx_source": "fx_source",
    "fx_fetched_at": "fx_fetched_at",
    "fx_date": "fx_date",
    "revenue_period": "revenue_period",
    "debt_period": "debt_period",
    "cash_period": "cash_period",
}
TRATAMIENTOS = {
    "Tratamiento FCL": "Proxy del accionista; no es FCFE conciliado; no se resta deuda neta",
    "Tratamiento EBIT": "Proxy NOPAT sin reinversión completa; se resta deuda neta",
    "Tratamiento EBITDA": "EBITDA - impuestos sobre EBIT - |CapEx|; se resta deuda neta",
    "Tratamiento utilidad neta": "Proxy de utilidad contable, no caja distribuible; no se resta deuda neta",
}


def iguales(actual, esperado, contexto):
    if isinstance(esperado, (int, float)) and not isinstance(esperado, bool):
        assert isinstance(actual, (int, float)) and not isinstance(actual, bool), contexto
        assert math.isfinite(actual) and math.isfinite(esperado), contexto
        assert math.isclose(actual, esperado, rel_tol=1e-12, abs_tol=1e-9), contexto
    else:
        assert actual == (None if esperado == "" else esperado), contexto


def tabla(hoja):
    headers = [c.value for c in hoja[3]]
    assert len(headers) == len(set(headers)), f"{hoja.title}: encabezados duplicados"
    return [
        dict(zip(headers, values, strict=True))
        for values in hoja.iter_rows(min_row=4, values_only=True)
    ]


def por_ticker(filas):
    result = {r["Ticker"]: r for r in filas}
    assert len(result) == len(filas), "Empresas duplicadas"
    return result


def resumen_esperado(company, job):
    included = company["median"]["included_models"]
    assert len(included) == len(set(included)) == company["median"]["count"]
    values = {
        "Mercado": company["market"],
        "Ticker": company["ticker"],
        "Empresa": company["company_name"],
        "Moneda": company["currency"],
        "Precio de mercado": company["market_price"],
        "Mediana de proxies": company["median"]["value_per_share"],
        "Upside mediana de proxies": company["median"]["upside"],
        "Precio objetivo analistas": company["analyst_target"]["value"],
        "Upside analistas": company["analyst_target"]["upside"],
        "Estado": company["status"],
        "Notas": company["notes"],
        "Versión metodología": job["methodology_version"],
        "Versión contrato": job["financial_contract_version"],
        "Modelos en mediana": company["median"]["count"],
        "Modelos incluidos": ", ".join(domain for key, domain, _, _ in MODELOS if key in included),
        "Clase de empresa": company["company_class"],
    }
    models = {p["id"]: p for p in company["proxies"]}
    assert len(models) == len(company["proxies"]) == 4
    for key, _, label, upside in MODELOS:
        values[label] = models[key]["value_per_share"]
        values[upside] = models[key]["upside"]
        assert models[key]["included"] == (key in included)
    return values


def verificar_libro(archivo: Path, snapshot: dict):
    """Contrasta todas las empresas; el orden/página de la UI no interviene."""
    job, rows = snapshot["job"], snapshot["rows"]
    assert job["state"] == "completed"
    assert len(rows) == job["processed"] == job["total"]
    expected = {c["ticker"]: resumen_esperado(c, job) for c in rows}
    assert len(expected) == len(rows), "Snapshot con símbolos duplicados"
    with closing(load_workbook(archivo, data_only=True)) as book:
        assert book.sheetnames == HOJAS
        for name in ["Resumen", "USA", "MX"]:
            actual = por_ticker(tabla(book[name]))
            subset = {
                t: r for t, r in expected.items() if name == "Resumen" or r["Mercado"] == name
            }
            assert set(actual) == set(subset), f"{name}: lote o partición distintos"
            assert set(c.value for c in book[name][3]) == set(next(iter(expected.values())))
            for ticker, values in subset.items():
                for key, value in values.items():
                    iguales(actual[ticker][key], value, f"{name}/{ticker}/{key}")
        audit = por_ticker(tabla(book["Detalle"]))
        assert set(audit) == set(expected)
        assert book["Detalle"].max_column == 73
        for company in rows:
            ticker = company["ticker"]
            fields = company["audit_fields"]
            assert len(fields) == len({f["key"] for f in fields}) == 73
            assert set(audit[ticker]) == {f["label"] for f in fields}
            for field in fields:
                iguales(
                    audit[ticker][field["label"]],
                    field["value"],
                    f"Detalle/{ticker}/{field['key']}",
                )
            by_key = {f["key"]: f["value"] for f in fields}
            for key, audit_key in TRAZAS.items():
                iguales(
                    company["traceability"][key], by_key[audit_key], f"Trazabilidad/{ticker}/{key}"
                )
            if by_key["effective_configuration"] is not None:
                effective = json.loads(by_key["effective_configuration"])
                for key, value in job["configuration"].items():
                    iguales(effective[key], value, f"Configuración/{ticker}/{key}")
        assumptions = {r["Supuesto"]: r["Valor"] for r in tabla(book["Supuestos"])}
        for label, key in SUPUESTOS.items():
            iguales(assumptions[label], job["configuration"][key], f"Supuestos/{key}")
        assert assumptions["Versión metodología"] == job["methodology_version"]
        assert assumptions["Versión contrato"] == job["financial_contract_version"]
        assert set(assumptions) == set(SUPUESTOS) | set(TRATAMIENTOS) | {
            "Versión metodología",
            "Versión contrato",
        }
        for key, value in TRATAMIENTOS.items():
            assert assumptions[key] == value, f"Supuestos/{key}"
        universe = tabla(book["Universo"])
        assert universe and set(universe[0]) == {"Mercado", "Orden", "Ticker"}
        assert len(por_ticker(universe)) == len(universe)
        assert tabla(book["Fuentes"]), "Fuentes del universo ausentes"
        if "universe_sources" in snapshot:
            assert tabla(book["Fuentes"]) == snapshot["universe_sources"]
        if "universe" in snapshot:
            assert {(r["Ticker"], r["Mercado"]) for r in universe} == {
                (r["ticker"], r["market"]) for r in snapshot["universe"]
            }
    return {"sheets": 7, "companies": len(rows), "summary_fields": 24, "audit_fields": 73}
