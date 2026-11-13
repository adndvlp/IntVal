"""F3: el usuario puede reconocer proxies, tasas y exclusiones sin abrir el código."""

from tests.ui.test_app import analizar, iniciar, widget_por_etiqueta


def test_ui_expone_proxies_tasas_y_procedencia(industrial):
    app = iniciar()
    widget_por_etiqueta(app.sidebar.slider, "Tasa descuento empresa (%)").set_value(12.0)
    app = analizar(app)
    assert not app.exception
    assert "Proxy NOPAT por acción" in app.dataframe[0].value.columns
    assert app.session_state["config"][-1] == ("tasa_descuento_empresa", 0.12)
    assert widget_por_etiqueta(app.metric, "Mediana de proxies")
    assert any("proxies-1.0" in str(c.value) and "4" in str(c.value) for c in app.caption)
    assert any(
        "Fuente de datos" in df.value.get("Campo", []).tolist()
        for df in app.dataframe
        if "Campo" in df.value
    )


def test_financiera_comunica_exclusion_y_cero_modelos(industrial):
    industrial.datos["info"]["sector"] = "Financial Services"
    app = analizar(iniciar())
    assert not app.exception
    assert app.session_state["principales"][0]["Modelos en mediana"] == 0
    assert any("sin modelo" in aviso.value.lower() for aviso in app.warning)
