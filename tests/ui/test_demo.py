"""F5: flujo público de demostración con red y proveedor de mercado bloqueados."""

from dataclasses import asdict
from importlib import import_module
from io import BytesIO

from openpyxl import load_workbook

from tests.fixtures.datos_sinteticos import TickerSintetico
from tests.ui.test_app import espiar_exportacion, iniciar, widget_por_etiqueta


def activar_demo(app):
    widget_por_etiqueta(app.sidebar.radio, "Fuente de datos").set_value("Demostración").run()
    return app


def test_demo_inicial_por_entorno_analiza_filtra_detalle_y_exporta_sin_red(monkeypatch):
    monkeypatch.setenv("VALORACION_DEMO", "1")
    exportaciones = espiar_exportacion(monkeypatch)
    app = iniciar()
    assert not app.exception
    assert len(app.session_state["principales"]) == 3
    assert {fila["Estado"] for fila in app.session_state["principales"]} == {
        "OK",
        "DATOS INCOMPLETOS",
    }
    assert any("sintéticos" in aviso.value and "2025-01-03" in aviso.value for aviso in app.info)
    assert len(app.get("plotly_chart")) == 4
    assert widget_por_etiqueta(app.sidebar.text_input, "Ticker adicional").disabled
    widget_por_etiqueta(app.multiselect, "Filtrar estado").set_value(["DATOS INCOMPLETOS"]).run()
    assert app.dataframe[0].value["Ticker"].tolist() == ["DEMO-INCOMPLETA"]
    assert len(exportaciones[-1][0]) == 3
    widget_por_etiqueta(app.selectbox, "Empresa").set_value("DEMO-MX.MX").run()
    assert not app.exception
    assert "MXN" in widget_por_etiqueta(app.metric, "Precio de mercado").value
    libro = load_workbook(BytesIO(exportaciones[-1][2]))
    try:
        assert len(libro.sheetnames) == 7
        detalle = libro["Detalle"]
        campos = {c.value: c.column for c in detalle[3]}
        for fila in range(4, 7):
            assert "sintéticos" in detalle.cell(fila, campos["Fuente de datos"]).value
            assert "2025-01-03" in detalle.cell(fila, campos["Notas"]).value
    finally:
        libro.close()


def test_cambiar_fuente_limpia_resultados_y_no_consulta_mercado():
    app = activar_demo(iniciar())
    assert not app.exception
    assert len(app.session_state["principales"]) == 3
    widget_por_etiqueta(app.sidebar.radio, "Fuente de datos").set_value("Mercado").run()
    assert not app.exception
    assert "principales" not in app.session_state
    assert not app.dataframe
    assert not widget_por_etiqueta(app.sidebar.text_input, "Ticker adicional").disabled
    activar_demo(app)
    assert not app.exception
    assert len(app.session_state["principales"]) == 3


def test_demo_limpiar_conserva_etiqueta_y_no_recarga_hasta_analizar(monkeypatch):
    monkeypatch.setenv("VALORACION_DEMO", "1")
    app = iniciar()
    widget_por_etiqueta(app.sidebar.button, "Limpiar resultados").click().run()
    assert not app.exception
    assert "principales" not in app.session_state
    assert not app.dataframe
    assert any("sintéticos" in aviso.value for aviso in app.info)
    widget_por_etiqueta(app.sidebar.button, "Analizar empresas").click().run()
    assert len(app.session_state["principales"]) == 3
    assert not app.exception


def test_demo_respeta_configuracion_del_resultado_hasta_reanalizar(monkeypatch):
    monkeypatch.setenv("VALORACION_DEMO", "1")
    app = iniciar()
    anteriores = app.session_state["principales"]
    widget_por_etiqueta(app.sidebar.slider, "Tasa descuento accionista (%)").set_value(15.0).run()
    assert app.session_state["principales"] == anteriores
    widget_por_etiqueta(app.sidebar.button, "Analizar empresas").click().run()
    assert not app.exception
    assert app.session_state["principales"] != anteriores
    assert dict(app.session_state["config"])["tasa_descuento"] == 0.15


def test_cache_separa_fuentes_incluso_con_el_mismo_ticker(proveedor, config_simple):
    proveedor[0]["DEMO-USA"] = TickerSintetico()
    app = import_module("app")
    config = tuple(asdict(config_simple).items())
    mercado, _ = app.analizar_cached("DEMO-USA", config, "Mercado")
    demo, _ = app.analizar_cached("DEMO-USA", config, "Demostración")
    assert mercado["Precio de mercado"] == 40
    assert demo["Precio de mercado"] == 100
    app.analizar_cached("DEMO-USA", config, "Mercado")
    app.analizar_cached("DEMO-USA", config, "Demostración")
    assert proveedor[1] == ["DEMO-USA"]
    assert app.precio_historico("DEMO-USA", "1y", "Mercado").iloc[-1]["Cierre"] == 40
    assert app.precio_historico("DEMO-USA", "1y", "Demostración").iloc[-1]["Cierre"] == 100
    assert len(proveedor[1]) == 2
