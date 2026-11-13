"""Etiquetas visibles; las claves históricas siguen siendo alias del contrato 2.0."""

ETIQUETAS = {
    "Valor intrínseco FCL": "Proxy FCL por acción",
    "Valor intrínseco EBIT": "Proxy NOPAT por acción",
    "Valor intrínseco EBITDA": "Proxy EBITDA ajustado por acción",
    "Valor intrínseco utilidad neta": "Proxy utilidad neta por acción",
    "Upside FCL": "Upside proxy FCL",
    "Upside EBIT": "Upside proxy NOPAT",
    "Upside EBITDA": "Upside proxy EBITDA ajustado",
    "Upside utilidad neta": "Upside proxy utilidad neta",
    "Mediana de modelos": "Mediana de proxies",
    "Upside mediana": "Upside mediana de proxies",
    "Años EBIT": "Años NOPAT",
    "Años EBITDA": "Años EBITDA ajustado",
    "PV flujos EBIT": "PV flujos proxy NOPAT",
    "PV terminal EBIT": "PV terminal proxy NOPAT",
    "PV flujos EBITDA": "PV flujos proxy EBITDA ajustado",
    "PV terminal EBITDA": "PV terminal proxy EBITDA ajustado",
    "CAGR histórico ingresos": "Crecimiento bruto utilizado",
}


def etiqueta(campo: str) -> str:
    return ETIQUETAS.get(campo, campo)
