"""F3-R03/R08: un mismo significado en datos, gráficas y libro exportado."""

import json
from dataclasses import replace

import pandas as pd
import pytest
from openpyxl import load_workbook

from tests.integration.test_metodologia import datos
from valoracion.calculos import preparar_historicos_financieros, valorar_empresa
from valoracion.exportacion.excel import escribir_excel
from valoracion.presentacion.graficas import grafica_valoraciones


def test_grafica_nombra_las_aproximaciones_y_nopat(config_simple):
    resultado = valorar_empresa(datos(), config_simple)
    figura = grafica_valoraciones(pd.Series(resultado.principal))
    assert list(figura.data[0].x) == [
        "Mercado",
        "Proxy FCL",
        "Proxy NOPAT",
        "Proxy EBITDA ajustado",
        "Proxy utilidad neta",
        "Mediana de proxies",
        "Analistas",
    ]
    assert list(figura.data[0].y) == pytest.approx([40, 52, 44, 44, 48, 46, 60])


def test_historicos_no_confunden_nopat_con_ebit(config_simple):
    _, margenes = preparar_historicos_financieros(datos(), config_simple)
    assert margenes.iloc[-1]["Margen NOPAT"] == 0.16
    assert margenes.iloc[-1]["Margen EBITDA bruto"] == 0.25


def test_excel_concilia_etiquetas_versiones_tasas_y_trazabilidad(tmp_path, config_simple):
    config = replace(config_simple, tasa_descuento_empresa=0.1)
    resultado = valorar_empresa(datos(), config)
    ruta = tmp_path / "metodologia.xlsx"
    escribir_excel([resultado.principal], [resultado.detalle], ruta, config)
    libro = load_workbook(ruta)
    try:
        assert len(libro.sheetnames) == 7
        resumen = dict(
            zip((c.value for c in libro["Resumen"][3]), (c.value for c in libro["Resumen"][4]))
        )
        assert resumen["Proxy NOPAT por acción"] == pytest.approx(
            resultado.principal["Valor intrínseco EBIT"]
        )
        assert resumen["Mediana de proxies"] == pytest.approx(
            resultado.principal["Mediana de modelos"]
        )
        assert resumen["Modelos en mediana"] == 4
        assert resumen["Versión metodología"] == "proxies-1.0"
        sup = {f[0]: f[1] for f in libro["Supuestos"].iter_rows(min_row=4, values_only=True)}
        assert sup["Tasa descuento accionista"] == 0
        assert sup["Tasa descuento empresa"] == 0.1
        assert sup["Versión metodología"] == "proxies-1.0"
        assert "proxy" in sup["Tratamiento FCL"].lower()
        detalle = dict(
            zip((c.value for c in libro["Detalle"][3]), (c.value for c in libro["Detalle"][4]))
        )
        assert json.loads(detalle["Configuración efectiva"])["tasa_descuento_empresa"] == 0.1
        assert json.loads(detalle["Períodos por modelo"])["FCL"][-1] == "2024-01-01"
    finally:
        libro.close()
