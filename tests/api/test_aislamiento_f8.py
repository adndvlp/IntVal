"""El deadline destruye la adquisición bloqueada y permite trabajo posterior."""

import time
from functools import partial
from importlib import import_module

import pytest

from tests.fixtures.proveedores_f8 import fabrica_controlada
from valoracion.web.esquemas import ConfiguracionWeb


def test_timeout_recolecta_proceso_bloqueado_y_un_ejecutor_nuevo_procesa():
    modulo = import_module("valoracion.web.aislamiento")
    config = ConfiguracionWeb().a_dominio("demo")
    ejecutor = modulo.EjecutorAislado("demo", 2, fabrica_controlada)
    inicio = time.monotonic()
    with pytest.raises(modulo.ErrorInfraestructura):
        ejecutor.ejecutar("analysis", "BLOQUEADO", config)
    assert time.monotonic() - inicio < 6
    ejecutor.cerrar()
    assert not ejecutor.vivo
    with modulo.EjecutorAislado("demo", 5, fabrica_controlada) as nuevo:
        principal, _ = nuevo.ejecutar("analysis", "DEMO-USA", config)
        assert principal["Mediana de modelos"] == pytest.approx(116.1879930510067)
    assert not nuevo.vivo


def test_fallo_de_proveedor_no_filtra_excepcion_y_proceso_sigue_utilizable():
    modulo = import_module("valoracion.web.aislamiento")
    config = ConfiguracionWeb().a_dominio("demo")
    with modulo.EjecutorAislado("demo", 5, fabrica_controlada) as ejecutor:
        with pytest.raises(modulo.ErrorProveedor) as fallo:
            ejecutor.ejecutar("analysis", "FALLA", config)
        assert "privado" not in str(fallo.value)
        assert ejecutor.ejecutar("analysis", "DEMO-USA", config)[0]["Estado"] == "OK"


def test_worker_real_se_recupera_del_proceso_bloqueado_y_proveedor_es_por_lote():
    from tests.api.test_gestor_f8 import pedido
    from valoracion.web.ajustes import Ajustes
    from valoracion.web.trabajos import GestorTrabajos

    modulo = import_module("valoracion.web.aislamiento")
    gestor = GestorTrabajos(
        Ajustes(acquisition_timeout_seconds=2),
        ejecutor_factory=partial(modulo.EjecutorAislado, fabrica=fabrica_controlada),
    )
    gestor.iniciar()
    try:
        bloqueado = gestor.crear(pedido(["BLOQUEADO"], source="market"))["id"]
        fin = gestor.esperar_terminal(bloqueado, 6)
        assert (fin["state"], fin["processed"]) == ("failed", 0)
        siguiente = gestor.crear(pedido())["id"]
        assert gestor.esperar_terminal(siguiente, 5)["state"] == "completed"
        assert gestor.listo
    finally:
        gestor.cerrar()


def test_instancias_yahoo_no_comparten_cache_fx_entre_trabajos():
    from valoracion.proveedores.yahoo import CACHE_FX

    modulo = import_module("valoracion.web.aislamiento")
    primero, segundo = modulo.crear_proveedor("market"), modulo.crear_proveedor("market")
    primero._cache_fx["MXNUSD"] = 99
    assert "MXNUSD" not in segundo._cache_fx
    assert "MXNUSD" not in CACHE_FX
