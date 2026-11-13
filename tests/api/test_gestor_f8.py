"""Máquina de estados y límites con barreras, sin esperas arbitrarias ni Yahoo."""

import threading
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from importlib import import_module
from uuid import uuid4

import pytest

from valoracion.proveedores.demo import ProveedorDemo
from valoracion.servicio import analizar_empresa
from valoracion.web.ajustes import Ajustes
from valoracion.web.esquemas import SolicitudAnalisis


def pedido(tickers=None, **kwargs):
    return SolicitudAnalisis(
        **{
            "client_request_id": str(uuid4()),
            "source": "demo",
            "tickers": tickers or ["DEMO-USA"],
            **kwargs,
        }
    )


class Reloj:
    def __init__(self):
        self.t = 0

    def monotono(self):
        return self.t

    def utc(self):
        return datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(seconds=self.t)


class Fabrica:
    def __init__(self):
        self.entro = threading.Event()
        self.soltar = threading.Event()
        self.soltar.set()
        self.llamadas = []
        self.creados = []
        self.fallo = None

    def __call__(self, source, timeout):
        self.creados.append(source)
        return self

    def ejecutar(self, operacion, ticker, config):
        self.llamadas.append((operacion, ticker, config))
        self.entro.set()
        assert self.soltar.wait(5), "La prueba dejó una barrera sin liberar"
        if self.fallo:
            raise self.fallo
        return analizar_empresa(ticker, config, proveedor=ProveedorDemo()).como_registros()

    def cerrar(self):
        self.soltar.set()


@pytest.fixture
def entorno():
    modulo = import_module("valoracion.web.trabajos")
    fabrica, reloj = Fabrica(), Reloj()
    gestor = modulo.GestorTrabajos(
        Ajustes(), ejecutor_factory=fabrica, monotono=reloj.monotono, utc=reloj.utc
    )
    gestor.iniciar()
    yield gestor, fabrica, reloj, modulo.FalloWeb
    fabrica.soltar.set()
    gestor.cerrar()


def test_idempotencia_normalizada_snapshot_y_conflicto(entorno):
    gestor, fabrica, _, error = entorno
    fabrica.soltar.clear()
    p = pedido([" demo-usa ", "DEMO-USA"])
    primero = gestor.crear(p)
    assert fabrica.entro.wait(2)
    assert gestor.crear(deepcopy(p))["id"] == primero["id"]
    p.configuration.tasa_descuento = 0.2
    assert gestor.estado(primero["id"])["configuration"]["tasa_descuento"] == 0.1
    with pytest.raises(error) as fallo:
        gestor.crear(p)
    assert (fallo.value.status, fallo.value.code) == (409, "IDEMPOTENCY_CONFLICT")
    fabrica.soltar.set()
    assert gestor.esperar_terminal(primero["id"], 3)["state"] == "completed"
    assert len(fabrica.llamadas) == 1


def test_cola_acotada_cancelacion_en_cola_y_durante_empresa(entorno):
    gestor, fabrica, _, error = entorno
    fabrica.soltar.clear()
    activo = gestor.crear(pedido(["DEMO-USA", "DEMO-MX.MX"]))["id"]
    assert fabrica.entro.wait(2)
    segundo = gestor.crear(pedido())["id"]
    tercero = gestor.crear(pedido())["id"]
    with pytest.raises(error) as fallo:
        gestor.crear(pedido())
    assert fallo.value.status == 429
    assert gestor.cancelar(segundo)["state"] == "cancelled"
    assert segundo not in gestor._queue
    assert gestor.cancelar(segundo)["state"] == "cancelled"
    assert gestor.cancelar(activo)["state"] == "cancelling"
    fabrica.soltar.set()
    cancelado = gestor.esperar_terminal(activo, 3)
    assert (cancelado["state"], cancelado["processed"]) == ("cancelled", 1)
    assert [x[1] for x in fabrica.llamadas if x[1] == "DEMO-MX.MX"] == []
    assert gestor.esperar_terminal(tercero, 3)["state"] == "completed"
    assert gestor.cancelar(tercero)["state"] == "completed"


def test_cursores_inmutables_cache_conserva_tiempos_y_aisla_configuracion(entorno):
    gestor, fabrica, reloj, _ = entorno
    identificador = gestor.crear(pedido(["DEMO-USA", "DEMO-INCOMPLETA"]))["id"]
    fin = gestor.esperar_terminal(identificador, 3)
    assert fin["processed"] == 2
    assert fin["counts"] == {"OK": 1, "DATOS INCOMPLETOS": 1, "REVISAR": 0, "ERROR": 0}
    pagina = gestor.resultados(identificador, 0, 1)
    assert pagina["next_cursor"] == 1
    assert pagina["items"][0]["ticker"] == "DEMO-USA"
    pagina["items"][0]["notes"] = "alterado"
    assert gestor.resultados(identificador, 0, 1)["items"][0]["notes"] != "alterado"
    primero = gestor.resultados(identificador, 0, 1)["items"][0]["calculation"]
    reloj.t = 10
    nuevo = gestor.crear(pedido())["id"]
    gestor.esperar_terminal(nuevo, 3)
    segundo = gestor.resultados(nuevo, 0, 100)["items"][0]["calculation"]
    assert segundo == primero | {"cache_hit": True}
    assert len(fabrica.llamadas) == 2
    distinto = gestor.crear(pedido(configuration={"tasa_descuento": 0.15}))["id"]
    gestor.esperar_terminal(distinto, 3)
    assert len(fabrica.llamadas) == 3
    assert fabrica.llamadas[-1][2].tasa_descuento == 0.15
    assert gestor.resultados(identificador, 2, 100)["items"] == []
    assert gestor.estado(identificador)["revision"] == fin["revision"]


def test_expiracion_tombstone_y_reinicio_desconoce_ids(entorno):
    gestor, _, reloj, error = entorno
    identificador = gestor.crear(pedido())["id"]
    gestor.esperar_terminal(identificador, 3)
    reloj.t = 3601
    with pytest.raises(error) as fallo:
        gestor.estado(identificador)
    assert fallo.value.status == 410
    with pytest.raises(error) as fallo:
        gestor.estado(str(uuid4()))
    assert fallo.value.status == 404


def test_errores_financieros_no_fallan_lote_ni_se_cachean(entorno):
    gestor, fabrica, _, _ = entorno
    modulo = import_module("valoracion.web.aislamiento")
    fabrica.fallo = modulo.ErrorProveedor()
    for _ in range(2):
        identificador = gestor.crear(pedido())["id"]
        fin = gestor.esperar_terminal(identificador, 3)
        assert fin["state"] == "completed"
        assert fin["counts"]["ERROR"] == 1
        assert gestor.resultados(identificador, 0, 100)["items"][0]["status"] == "ERROR"
    assert len(fabrica.llamadas) == 2


def test_fallo_infraestructura_preserva_parciales_y_recupera_worker(entorno):
    gestor, fabrica, _, _ = entorno
    modulo = import_module("valoracion.web.aislamiento")
    original = fabrica.ejecutar

    def ejecutar(operacion, ticker, config):
        if ticker == "DEMO-MX.MX":
            raise modulo.ErrorInfraestructura()
        return original(operacion, ticker, config)

    fabrica.ejecutar = ejecutar
    identificador = gestor.crear(pedido(["DEMO-USA", "DEMO-MX.MX"]))["id"]
    fin = gestor.esperar_terminal(identificador, 3)
    assert (fin["state"], fin["processed"], fin["error"]["code"]) == (
        "failed",
        1,
        "ACQUISITION_FAILED",
    )
    nuevo = gestor.crear(pedido(["DEMO-INCOMPLETA"]))["id"]
    assert gestor.esperar_terminal(nuevo, 3)["state"] == "completed"


def test_ttl_cache_y_relojes_de_pared_no_controlan_retencion(entorno):
    gestor, fabrica, reloj, _ = entorno
    primero = gestor.crear(pedido())["id"]
    gestor.esperar_terminal(primero, 3)
    reloj.t = 3601
    nuevo = gestor.crear(pedido())["id"]
    gestor.esperar_terminal(nuevo, 3)
    assert len(fabrica.llamadas) == 2
    assert gestor.resultados(nuevo, 0, 1)["items"][0]["calculation"]["cache_hit"] is False


def test_limite_retencion_desaloja_antiguo_y_presupuesto_no_desaloja_activo():
    modulo = import_module("valoracion.web.trabajos")
    fabrica = Fabrica()
    gestor = modulo.GestorTrabajos(Ajustes(max_retained=1), ejecutor_factory=fabrica)
    gestor.iniciar()
    try:
        primero = gestor.crear(pedido())["id"]
        gestor.esperar_terminal(primero, 3)
        segundo = gestor.crear(pedido())["id"]
        gestor.esperar_terminal(segundo, 3)
        with pytest.raises(modulo.FalloWeb) as fallo:
            gestor.estado(primero)
        assert fallo.value.status == 410
        assert gestor.estado(segundo)["state"] == "completed"
    finally:
        gestor.cerrar()
    pequeno = modulo.GestorTrabajos(Ajustes(memory_budget_bytes=1), ejecutor_factory=fabrica)
    pequeno.iniciar()
    try:
        with pytest.raises(modulo.FalloWeb) as fallo:
            pequeno.crear(pedido())
        assert fallo.value.status == 429
        assert not pequeno._jobs
    finally:
        pequeno.cerrar()


def test_plazo_cooperativo_conserva_primera_fila_y_explica_causa(entorno):
    gestor, fabrica, reloj, _ = entorno
    original = fabrica.ejecutar

    def ejecutar(*args):
        resultado = original(*args)
        reloj.t = 1801
        return resultado

    fabrica.ejecutar = ejecutar
    identificador = gestor.crear(pedido(["DEMO-USA", "DEMO-MX.MX"]))["id"]
    fin = gestor.esperar_terminal(identificador, 3)
    assert (fin["state"], fin["processed"]) == ("failed", 1)
    assert fin["error"]["code"] == "JOB_DEADLINE_EXCEEDED"


def test_creaciones_concurrentes_comparten_un_solo_job_y_cancel_fin_es_terminal(entorno):
    gestor, fabrica, _, _ = entorno
    fabrica.soltar.clear()
    p = pedido()
    barrera = threading.Barrier(3)

    def crear():
        barrera.wait(timeout=3)
        return gestor.crear(p)["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        uno, dos = pool.submit(crear), pool.submit(crear)
        barrera.wait(timeout=3)
        identificador = uno.result(timeout=3)
        assert dos.result(timeout=3) == identificador
    assert fabrica.entro.wait(2)
    barrera = threading.Barrier(3)

    def cancelar():
        barrera.wait(timeout=3)
        return gestor.cancelar(identificador)

    def terminar():
        barrera.wait(timeout=3)
        fabrica.soltar.set()

    with ThreadPoolExecutor(max_workers=2) as pool:
        cancelacion, fin = pool.submit(cancelar), pool.submit(terminar)
        barrera.wait(timeout=3)
        cancelacion.result(timeout=3)
        fin.result(timeout=3)
    terminal = gestor.esperar_terminal(identificador, 3)
    assert terminal["state"] in {"completed", "cancelled"}
    assert terminal["processed"] == 1 and len(fabrica.llamadas) == 1
    assert gestor.cancelar(identificador) == terminal


def test_fuentes_aisladas_y_cada_lote_sin_cache_crea_su_proveedor(entorno):
    gestor, fabrica, _, _ = entorno
    for p in [pedido(), pedido(source="market"), pedido(configuration={"tasa_descuento": 0.15})]:
        identificador = gestor.crear(p)["id"]
        assert gestor.esperar_terminal(identificador, 3)["state"] == "completed"
        assert (
            gestor.resultados(identificador, 0, 1)["items"][0]["calculation"]["cache_hit"] is False
        )
    assert fabrica.creados == ["demo", "market", "demo"]


def test_presupuesto_insuficiente_para_fila_falla_explicito_sin_perder_job():
    modulo = import_module("valoracion.web.trabajos")
    gestor = modulo.GestorTrabajos(Ajustes(memory_budget_bytes=2000), ejecutor_factory=Fabrica())
    gestor.iniciar()
    try:
        identificador = gestor.crear(pedido())["id"]
        fin = gestor.esperar_terminal(identificador, 3)
        assert (fin["state"], fin["processed"], fin["error"]["code"]) == (
            "failed",
            0,
            "MEMORY_LIMIT_EXCEEDED",
        )
        assert gestor.resultados(identificador, 0, 1)["items"] == []
    finally:
        gestor.cerrar()


def test_logs_tienen_correlacion_duracion_y_conteos_sin_payload(entorno, caplog):
    gestor, _, _, _ = entorno
    caplog.set_level("INFO", logger="valoracion.web.trabajos")
    identificador = gestor.crear(pedido())["id"]
    gestor.esperar_terminal(identificador, 3)
    mensaje = next(r.message for r in caplog.records if "state=completed" in r.message)
    assert f"id={identificador}" in mensaje
    assert "duration_seconds=" in mensaje and "processed=1 total=1" in mensaje
    assert "DEMO-USA" not in mensaje and "tasa_descuento" not in mensaje


def test_retroceso_del_reloj_utc_no_desaloja_el_terminal_mas_reciente():
    modulo = import_module("valoracion.web.trabajos")
    reloj = Reloj()
    gestor = modulo.GestorTrabajos(
        Ajustes(max_retained=1), ejecutor_factory=Fabrica(), monotono=reloj.monotono, utc=reloj.utc
    )
    gestor.iniciar()
    try:
        anterior = gestor.crear(pedido())["id"]
        gestor.esperar_terminal(anterior, 3)
        reloj.t = 10
        gestor._utc = lambda: datetime(2025, 1, 1, tzinfo=timezone.utc)
        reciente = gestor.crear(pedido())["id"]
        gestor.esperar_terminal(reciente, 3)
        assert gestor.estado(reciente)["state"] == "completed"
        with pytest.raises(modulo.FalloWeb) as fallo:
            gestor.estado(anterior)
        assert fallo.value.status == 410
    finally:
        gestor.cerrar()
