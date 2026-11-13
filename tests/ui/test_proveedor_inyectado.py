"""La UI utiliza el mismo servicio de dominio para análisis e históricos."""

from importlib import import_module

import motor_valoracion as motor
from tests.integration.test_servicio_inyectado import ProveedorMemoria, datos_del_caso
from tests.ui.test_app import analizar, iniciar


def test_ui_consume_servicio_y_historicos_sin_acoplarse_a_yahoo(monkeypatch):
    servicio = import_module("valoracion.servicio")
    datos, _ = datos_del_caso("completa_default")
    proveedor = ProveedorMemoria(datos)
    monkeypatch.setattr(servicio, "_resolver_proveedor", lambda _: proveedor)

    def ruta_antigua(*args, **kwargs):
        raise RuntimeError("La UI todavía está acoplada a la fachada antigua")

    monkeypatch.setattr(motor, "analizar_ticker", ruta_antigua)
    app = analizar(iniciar())
    assert not app.exception
    assert app.session_state["principales"][0]["Estado"] == "OK"
    assert proveedor.llamadas == [
        ("empresa", "TEST"),
        ("precio", "TEST", "5y"),
        ("estados", "TEST"),
    ]
    assert len(app.get("download_button")) == 1
