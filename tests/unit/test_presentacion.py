"""U-12/U-13/UI-18 y preparación de históricos en unidades conocidas."""

from dataclasses import asdict
from importlib import import_module

import numpy as np
import pandas as pd
import pytest


@pytest.fixture
def interfaz():
    return import_module("app")


@pytest.mark.parametrize("valor", [None, "invalido", np.nan, np.inf])
def test_ausencias_se_presentan_como_guion(interfaz, valor):
    assert interfaz.format_money(valor, "MXN") == "—"
    assert interfaz.format_percent(valor) == "—"


def test_formatos_numericos_y_tabla_no_mutan_entradas(interfaz):
    assert interfaz.format_money(1234.5, "MXN") == "$1,234.50 MXN"
    assert interfaz.format_money(12) == "$12.00"
    assert interfaz.format_percent(0.15) == "15.0%"
    entrada = pd.DataFrame([{"Ticker": "TEST", "Upside mediana": 0.15, "Campo privado": 5}])
    antes = entrada.copy(deep=True)
    tabla = interfaz.preparar_tabla(entrada)
    assert tabla.columns.tolist() == ["Ticker", "Upside mediana de proxies"]
    pd.testing.assert_frame_equal(entrada, antes)
    assert interfaz.preparar_tabla(pd.DataFrame()).empty


def test_grafica_conserva_solo_modelos_disponibles(interfaz):
    figura = interfaz.grafica_valoraciones(pd.Series({"Precio de mercado": 40, "Valor intrínseco FCL": 52, "Moneda": "MXN"}))
    assert figura.data[0].x.tolist() == ["Mercado", "Proxy FCL"]
    assert figura.data[0].y.tolist() == [40, 52]
    assert "MXN" in figura.layout.yaxis.title.text


def test_historicos_en_millones_margenes_y_fechas(interfaz, industrial, config_simple):
    historia = interfaz.precio_historico("TEST", "1y")
    assert historia.columns.tolist() == ["Fecha", "Cierre"]
    assert historia["Cierre"].tolist() == [38, 39, 40]
    assert historia["Fecha"].dt.tz is None
    financieros, margenes = interfaz.historicos_financieros("TEST", tuple(asdict(config_simple).items()))
    assert financieros.index.name == "Año"
    assert financieros.loc["2024", "Ingresos"] == pytest.approx(0.001)
    assert financieros.loc["2024", "FCL"] == pytest.approx(0.00013)
    assert margenes.loc["2024", "Margen FCL"] == pytest.approx(0.13)
    # F3: la etiqueta identifica la métrica efectivamente calculada.
    assert margenes.loc["2024", "Margen NOPAT"] == pytest.approx(0.16)


@pytest.mark.parametrize("historia", [None, pd.DataFrame()])
def test_precio_vacio_conserva_columnas(interfaz, industrial, historia):
    industrial.datos["history_result"] = historia
    resultado = interfaz.precio_historico("TEST", "1y")
    assert resultado.empty
    assert resultado.columns.tolist() == ["Fecha", "Cierre"]
