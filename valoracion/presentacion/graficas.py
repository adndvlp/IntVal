"""Gráficas a partir de resultados calculados; sin consultas ni estado de sesión."""

from __future__ import annotations

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go


def grafica_valoraciones(fila: pd.Series) -> go.Figure:
    datos = pd.DataFrame(
        {
            "Método": ["Mercado", "FCL", "EBIT", "EBITDA", "Utilidad neta", "Mediana", "Analistas"],
            "Valor": [
                fila.get("Precio de mercado"),
                fila.get("Valor intrínseco FCL"),
                fila.get("Valor intrínseco EBIT"),
                fila.get("Valor intrínseco EBITDA"),
                fila.get("Valor intrínseco utilidad neta"),
                fila.get("Mediana de modelos"),
                fila.get("Precio objetivo analistas"),
            ],
        }
    ).dropna()
    fig = px.bar(datos, x="Método", y="Valor", text_auto=".2f")
    fig.update_layout(
        title="Valor por acción según metodología",
        xaxis_title=None,
        yaxis_title=f"Precio por acción ({fila.get('Moneda', '')})",
        showlegend=False,
        margin=dict(l=20, r=20, t=55, b=20),
    )
    return fig
