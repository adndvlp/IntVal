"""UI-05: regresión de un lote enteramente fallido."""

from dataclasses import asdict
from io import BytesIO
from pathlib import Path

import pandas as pd
import pytest
from openpyxl import load_workbook
from streamlit.testing.v1 import AppTest

from valoracion import servicio, universo
from valoracion.proveedores import yahoo
from valoracion.exportacion import excel
from tests.fixtures.datos_sinteticos import TickerSintetico


RUTA_APP = Path(__file__).resolve().parents[2] / "app.py"


def widget_por_etiqueta(elementos, etiqueta):
    return next(elemento for elemento in elementos if elemento.label == etiqueta)


def iniciar():
    return AppTest.from_file(RUTA_APP, default_timeout=20).run()


def analizar(app, texto="TEST"):
    widget_por_etiqueta(app.sidebar.multiselect, "Tickers").set_value([])
    widget_por_etiqueta(app.sidebar.text_input, "Ticker adicional").set_value(texto)
    widget_por_etiqueta(app.sidebar.button, "Analizar empresas").click().run()
    return app


def espiar_exportacion(monkeypatch):
    original = excel.escribir_excel
    exportaciones = []
    def escribir(principales, detalles, ruta, config):
        original(principales, detalles, ruta, config)
        exportaciones.append((principales, config, ruta.read_bytes()))
    monkeypatch.setattr(excel, "escribir_excel", escribir)
    return exportaciones


def test_todos_los_analisis_fallan_sin_romper_la_interfaz(monkeypatch):
    def fallar(*args, **kwargs):
        raise RuntimeError("Fallo simulado del proveedor")

    monkeypatch.setattr(servicio, "analizar_ticker", fallar)
    app = iniciar()
    widget_por_etiqueta(app.sidebar.multiselect, "Tickers").set_value(["A"])
    widget_por_etiqueta(app.sidebar.button, "Analizar empresas").click().run()

    assert not app.exception
    assert app.session_state["principales"][0]["Estado"] == "ERROR"
    assert len(app.dataframe[0].value) == 1
    assert app.dataframe[0].value.iloc[0]["Ticker"] == "A"
    assert not app.success
    assert any("Fallo simulado" in str(elemento.value) for elemento in app.get("warning"))


def test_arranque_no_consulta_el_proveedor(proveedor):
    app = iniciar()
    assert not app.exception
    assert proveedor[1] == []
    assert app.info


@pytest.mark.parametrize("con_app_ajena", [False, True])
def test_arranque_encuentra_la_app_del_repositorio_desde_otro_directorio(
    monkeypatch, tmp_path, proveedor, con_app_ajena,
):
    if con_app_ajena:
        (tmp_path / "app.py").write_text(
            "import streamlit as st\nst.error('Esta no es la aplicación del repositorio')\n",
            encoding="utf-8",
        )
    monkeypatch.chdir(tmp_path)

    app = iniciar()

    assert not app.exception
    assert app.title[0].value == "Valoración de acciones · USA y México"
    assert app.info
    assert proveedor[1] == []


def test_flujo_completo_con_motor_real_y_excel(monkeypatch, industrial):
    exportaciones = espiar_exportacion(monkeypatch)
    app = analizar(iniciar())
    assert not app.exception
    assert app.success
    assert app.dataframe[0].value.iloc[0]["Empresa"] == "Industrial sintética"
    assert len(app.get("download_button")) == 1
    libro = load_workbook(BytesIO(exportaciones[-1][2]))
    assert libro["Resumen"].cell(4, 2).value == "TEST"
    assert libro["Resumen"].cell(4, 5).value == 40
    libro.close()


def test_seleccion_vacia_advierte_y_conserva_analisis_anterior(industrial, proveedor):
    app = analizar(iniciar())
    anteriores = app.session_state["principales"]
    consultas = len(proveedor[1])
    analizar(app, "")
    assert not app.exception
    assert app.session_state["principales"] == anteriores
    assert len(proveedor[1]) == consultas
    assert any("al menos un ticker" in aviso.value for aviso in app.warning)


def test_extras_normalizados_sin_duplicados(industrial, proveedor):
    proveedor[0]["TEST.MX"] = TickerSintetico()
    app = analizar(iniciar(), " test, TEST, test.mx, ")
    assert not app.exception
    assert [r["Ticker"] for r in app.session_state["principales"]] == ["TEST", "TEST.MX"]


def test_solo_datos_incompletos_sigue_funcionando(industrial):
    industrial.datos["income_stmt"] = pd.DataFrame()
    industrial.datos["cashflow"] = pd.DataFrame()
    app = analizar(iniciar())
    assert not app.exception
    assert app.session_state["principales"][0]["Estado"] == "DATOS INCOMPLETOS"
    assert len(app.dataframe[0].value) == 1
    assert any("suficientes" in aviso.value for aviso in app.info)


def test_lote_mixto_filtros_y_descarga_completa(monkeypatch, industrial, proveedor):
    proveedor[0]["ERROR"] = RuntimeError("Fallo deliberado")
    proveedor[0]["TEST.MX"] = TickerSintetico()
    exportaciones = espiar_exportacion(monkeypatch)
    app = analizar(iniciar(), "TEST, ERROR, TEST.MX")
    assert not app.exception
    assert len(app.dataframe[0].value) == 3
    assert not app.success
    assert any("ERROR: 1" in aviso.value for aviso in app.warning)
    widget_por_etiqueta(app.multiselect, "Filtrar estado").set_value(["ERROR"]).run()
    assert app.dataframe[0].value["Ticker"].tolist() == ["ERROR"]
    assert len(exportaciones[-1][0]) == 3
    widget_por_etiqueta(app.multiselect, "Filtrar mercado").set_value(["MX"]).run()
    assert app.dataframe[0].value.empty
    assert widget_por_etiqueta(app.metric, "Empresas mostradas").value == "0"
    assert widget_por_etiqueta(app.metric, "Upside mediano").value == "—"
    assert not app.exception


def test_filtro_upside_conserva_ausencias_y_excluye_numeros_bajos(industrial, proveedor):
    proveedor[0]["ERROR"] = RuntimeError("Fallo deliberado")
    app = analizar(iniciar(), "TEST, ERROR")
    widget_por_etiqueta(app.slider, "Upside mínimo de la mediana").set_value(200).run()
    assert not app.exception
    assert app.dataframe[0].value["Ticker"].tolist() == ["ERROR"]


def test_limpiar_devuelve_a_pantalla_inicial(industrial):
    app = analizar(iniciar())
    widget_por_etiqueta(app.sidebar.button, "Limpiar resultados").click().run()
    assert not app.exception
    assert "principales" not in app.session_state
    assert "config" not in app.session_state
    assert len(app.dataframe) == 0


def test_configuracion_exportada_no_cambia_hasta_reanalizar(monkeypatch, industrial, proveedor):
    exportaciones = espiar_exportacion(monkeypatch)
    app = analizar(iniciar())
    originales = app.session_state["principales"]
    consultas = len(proveedor[1])
    widget_por_etiqueta(app.sidebar.slider, "Tasa descuento accionista (%)").set_value(15.0).run()
    assert not app.exception
    assert app.session_state["principales"] == originales
    assert exportaciones[-1][1].tasa_descuento == 0.1
    assert len(proveedor[1]) == consultas
    widget_por_etiqueta(app.sidebar.button, "Analizar empresas").click().run()
    assert exportaciones[-1][1].tasa_descuento == 0.15
    assert app.session_state["principales"][0]["Mediana de modelos"] != originales[0]["Mediana de modelos"]


def test_nuevo_lote_restablece_selector_de_empresa(industrial, proveedor):
    proveedor[0]["NUEVO"] = TickerSintetico()
    app = analizar(iniciar())
    analizar(app, "NUEVO")
    assert not app.exception
    assert widget_por_etiqueta(app.selectbox, "Empresa").value == "NUEVO"


@pytest.mark.parametrize("historia", [pd.DataFrame(), RuntimeError("Histórico simulado"), pd.DataFrame({"Incorrecto": [1]})])
def test_historico_vacio_o_fallido_no_rompe_resumen(industrial, historia):
    industrial.datos["history_result"] = historia
    app = analizar(iniciar())
    assert not app.exception
    assert len(app.dataframe[0].value) == 1
    assert len(app.get("download_button")) == 1
    assert any("historial" in mensaje.value.lower() or "histórico" in mensaje.value.lower() for mensaje in [*app.info, *app.warning])


def test_fallo_al_obtener_estados_del_detalle_es_localizado(monkeypatch, industrial):
    llamadas = []
    def ticker(_):
        llamadas.append(1)
        if len(llamadas) >= 3:
            raise RuntimeError("Estados simulados no disponibles")
        return industrial
    monkeypatch.setattr(yahoo.yf, "Ticker", ticker)
    app = analizar(iniciar())
    assert not app.exception
    assert len(app.get("download_button")) == 1
    assert any("Estados simulados" in mensaje.value for mensaje in app.warning)


def test_error_exportacion_conserva_resultados(monkeypatch, industrial):
    def fallar(*args, **kwargs):
        raise PermissionError("No se puede escribir el Excel")
    monkeypatch.setattr(excel, "escribir_excel", fallar)
    app = analizar(iniciar())
    assert not app.exception
    assert app.session_state["principales"][0]["Ticker"] == "TEST"
    assert len(app.dataframe[0].value) == 1
    assert not app.get("download_button")
    assert any("Excel" in mensaje.value for mensaje in app.warning)


def test_analisis_almacenado_vacio_no_selecciona_filas_inexistentes(config_simple):
    app = iniciar()
    app.session_state["principales"] = []
    app.session_state["detalles"] = []
    app.session_state["config"] = tuple(asdict(config_simple).items())
    app.run()
    assert not app.exception
    assert widget_por_etiqueta(app.metric, "Empresas mostradas").value == "0"
    assert any("empresa" in mensaje.value.lower() for mensaje in app.info)


def test_todos_los_mercados_y_seleccion_completa(monkeypatch, industrial, proveedor):
    monkeypatch.setattr(universo, "EMPRESAS_USA", ["TEST"])
    monkeypatch.setattr(universo, "EMPRESAS_MX", ["TEST.MX"])
    proveedor[0]["TEST.MX"] = TickerSintetico()
    app = iniciar()
    widget_por_etiqueta(app.sidebar.radio, "Mercado").set_value("Todos").run()
    widget_por_etiqueta(app.sidebar.checkbox, "Seleccionar todo el mercado").check().run()
    widget_por_etiqueta(app.sidebar.button, "Analizar empresas").click().run()
    assert not app.exception
    assert [fila["Ticker"] for fila in app.session_state["principales"]] == ["TEST", "TEST.MX"]
    widget_por_etiqueta(app.sidebar.radio, "Mercado").set_value("MX").run()
    widget_por_etiqueta(app.sidebar.button, "Analizar empresas").click().run()
    assert not app.exception
    assert [fila["Ticker"] for fila in app.session_state["principales"]] == ["TEST.MX"]


def test_advertencia_de_empresa_financiera(industrial):
    industrial.datos["info"]["sector"] = "Financial Services"
    app = analizar(iniciar())
    assert not app.exception
    assert any("empresa financiera" in aviso.value.lower() for aviso in app.warning)
