"""Trabajos efímeros de una instancia: un worker serial, snapshots y TTL.

El presupuesto mide bytes de payload JSON administrado, no RSS del intérprete.
El RLock protege admisión, transiciones, publicación y cursores; nunca abarca I/O.
"""

import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict, deque
from copy import deepcopy
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from valoracion.metodologia import VERSION_CONTRATO, VERSION_METODOLOGIA
from valoracion.modelos import crear_resultado_error
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.universo import cargar_universo

from .adaptadores import a_json_seguro, empresa_a_dto
from .aislamiento import EjecutorAislado, ErrorInfraestructura, ErrorProveedor
from .errores import FalloWeb
from .esquemas import EmpresaResultado

LOG = logging.getLogger(__name__)
TERMINALES = {"completed", "cancelled", "failed"}
ESTADOS_FINANCIEROS = ("OK", "DATOS INCOMPLETOS", "REVISAR", "ERROR")


def _tamano(valor):
    return len(
        json.dumps(a_json_seguro(valor), ensure_ascii=False, allow_nan=False).encode("utf-8")
    )


@dataclass
class Trabajo:
    id: str
    request_id: str
    fingerprint: str
    source: str
    tickers: tuple[str, ...]
    config: object
    dataset_version: str
    created_at: datetime
    bytes: int
    state: str = "queued"
    revision: int = 1
    started_at: datetime | None = None
    started_mono: float | None = None
    finished_at: datetime | None = None
    expires_at: datetime | None = None
    expires_mono: float | None = None
    current_ticker: str | None = None
    error: dict | None = None
    rows: list = field(default_factory=list)


class GestorTrabajos:
    def __init__(
        self,
        ajustes,
        *,
        ejecutor_factory=EjecutorAislado,
        monotono=time.monotonic,
        utc=lambda: datetime.now(timezone.utc),
    ):
        self.ajustes = ajustes
        self._ejecutor_factory = ejecutor_factory
        self._monotono, self._utc = monotono, utc
        self._condicion = threading.Condition(threading.RLock())
        self._jobs = OrderedDict()
        self._requests = {}
        self._tombstones = OrderedDict()
        self._cache = OrderedDict()
        self._queue = deque()
        self._worker = None
        self._stopping = False
        self._ejecutor = None
        self._historicos_activos = set()
        self._lanes = {s: threading.BoundedSemaphore(1) for s in ("demo", "market")}
        self._export_lane = threading.BoundedSemaphore(1)
        demo = ProveedorDemo()
        self._demo_tickers = frozenset(demo.tickers())
        self._datasets = {
            "demo": demo.version,
            "market": f"universe-{cargar_universo().fecha_snapshot}",
        }

    @property
    def listo(self):
        return self._worker is not None and self._worker.is_alive() and not self._stopping

    def iniciar(self):
        with self._condicion:
            if self._worker is not None:
                return
            self._worker = threading.Thread(
                target=self._trabajar, name="intval-worker", daemon=True
            )
            self._worker.start()

    def cerrar(self):
        with self._condicion:
            self._stopping = True
            for job in self._jobs.values():
                if job.state == "queued":
                    self._terminar(job, "cancelled")
                elif job.state == "running":
                    self._cambiar(job, "cancelling")
            ejecutores = list(self._historicos_activos)
            if self._ejecutor is not None:
                ejecutores.append(self._ejecutor)
            self._queue.clear()
            self._condicion.notify_all()
        for ejecutor in ejecutores:
            ejecutor.cerrar()
        if self._worker:
            self._worker.join(timeout=4)

    def _cambiar(self, job, estado):
        job.state = estado
        job.revision += 1
        LOG.info(
            "analysis_transition id=%s state=%s processed=%d total=%d duration_seconds=%.3f",
            job.id,
            estado,
            len(job.rows),
            len(job.tickers),
            0 if job.started_mono is None else self._monotono() - job.started_mono,
        )
        self._condicion.notify_all()

    def _terminar(self, job, estado, error=None):
        job.current_ticker = None
        job.error = error
        job.finished_at = self._utc()
        job.expires_at = job.finished_at + timedelta(seconds=self.ajustes.terminal_ttl_seconds)
        job.expires_mono = self._monotono() + self.ajustes.terminal_ttl_seconds
        self._cambiar(job, estado)

    def _eliminar(self, identificador):
        job = self._jobs.pop(identificador)
        self._requests.pop(job.request_id, None)
        self._tombstones[identificador] = self._monotono() + self.ajustes.terminal_ttl_seconds
        while len(self._tombstones) > 64:
            self._tombstones.popitem(last=False)

    def _podar(self):
        ahora = self._monotono()
        for key, entry in list(self._cache.items()):
            if entry[0] <= ahora:
                del self._cache[key]
        for key, job in list(self._jobs.items()):
            if job.expires_mono is not None and job.expires_mono <= ahora:
                self._eliminar(key)
        for key, vence in list(self._tombstones.items()):
            if vence <= ahora:
                del self._tombstones[key]
        terminales = [j for j in self._jobs.values() if j.state in TERMINALES]
        terminales.sort(key=lambda j: j.expires_mono)
        for job in terminales[: max(0, len(terminales) - self.ajustes.max_retained)]:
            self._eliminar(job.id)

    def _espacio(self, cantidad, protegido=None):
        def usado():
            return sum(j.bytes for j in self._jobs.values()) + sum(
                c[1] for c in self._cache.values()
            )

        while usado() + cantidad > self.ajustes.memory_budget_bytes:
            if self._cache:
                self._cache.popitem(last=False)
                continue
            candidatos = [
                j for j in self._jobs.values() if j.state in TERMINALES and j.id != protegido
            ]
            if not candidatos:
                return False
            self._eliminar(min(candidatos, key=lambda j: j.expires_mono).id)
        return True

    def _buscar(self, identificador):
        self._podar()
        if identificador in self._tombstones:
            raise FalloWeb(410, "ANALYSIS_EXPIRED", "El análisis expiró. Crea uno nuevo.")
        if identificador not in self._jobs:
            raise FalloWeb(
                404, "ANALYSIS_NOT_FOUND", "El análisis no está disponible. Crea uno nuevo."
            )
        return self._jobs[identificador]

    def crear(self, solicitud):
        with self._condicion:
            self._podar()
            if not self.listo:
                raise FalloWeb(
                    503, "SERVICE_UNAVAILABLE", "El servicio se está preparando.", retryable=True
                )
            if solicitud.source == "market" and not self.ajustes.mercado_habilitado:
                raise FalloWeb(422, "SOURCE_DISABLED", "La fuente de mercado está deshabilitada.")
            if len(solicitud.tickers) > self.ajustes.max_tickers:
                raise FalloWeb(
                    422,
                    "INVALID_REQUEST",
                    "El lote supera el máximo de empresas.",
                    fields=[{"field": "tickers", "message": "Reduce el lote."}],
                )
            if solicitud.source == "demo" and not set(solicitud.tickers) <= self._demo_tickers:
                raise FalloWeb(
                    422,
                    "INVALID_REQUEST",
                    "Selecciona empresas del catálogo de demostración.",
                    fields=[{"field": "tickers", "message": "Símbolo ajeno a la demo."}],
                )
            config = solicitud.configuration.a_dominio(solicitud.source)
            payload = {
                "source": solicitud.source,
                "tickers": solicitud.tickers,
                "configuration": asdict(config),
            }
            fingerprint = hashlib.sha256(
                json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()
            ).hexdigest()
            existente = self._requests.get(solicitud.client_request_id)
            if existente:
                job = self._jobs[existente]
                if job.fingerprint != fingerprint:
                    raise FalloWeb(
                        409, "IDEMPOTENCY_CONFLICT", "Esta solicitud ya se usó con otro contenido."
                    )
                return self._estado(job)
            en_cola = sum(j.state == "queued" for j in self._jobs.values())
            if en_cola >= self.ajustes.max_queue or not self._espacio(_tamano(payload)):
                raise FalloWeb(
                    429,
                    "CAPACITY_EXCEEDED",
                    "El servicio está ocupado. Reintenta más tarde.",
                    retryable=True,
                )
            job = Trabajo(
                str(uuid4()),
                solicitud.client_request_id,
                fingerprint,
                solicitud.source,
                tuple(solicitud.tickers),
                config,
                self._datasets[solicitud.source],
                self._utc(),
                _tamano(payload),
            )
            self._jobs[job.id] = job
            self._requests[job.request_id] = job.id
            self._queue.append(job.id)
            self._condicion.notify_all()
            return self._estado(job)

    def _estado(self, job):
        base = f"/api/v1/analyses/{job.id}"
        counts = {s: sum(p["Estado"] == s for p, _, _ in job.rows) for s in ESTADOS_FINANCIEROS}
        return a_json_seguro(
            {
                "id": job.id,
                "state": job.state,
                "source": job.source,
                "total": len(job.tickers),
                "processed": len(job.rows),
                "current_ticker": job.current_ticker,
                "counts": counts,
                "configuration": asdict(job.config),
                "dataset_version": job.dataset_version,
                "schema_version": "1.0",
                "methodology_version": VERSION_METODOLOGIA,
                "financial_contract_version": VERSION_CONTRATO,
                "revision": job.revision,
                "created_at": job.created_at,
                "started_at": job.started_at,
                "finished_at": job.finished_at,
                "expires_at": job.expires_at,
                "error": job.error,
                "links": {
                    "status": base,
                    "results": f"{base}/results",
                    "cancel": f"{base}/cancel",
                    "export": f"{base}/export.xlsx",
                },
            }
        )

    def estado(self, identificador):
        with self._condicion:
            return self._estado(self._buscar(identificador))

    def resultados(self, identificador, after, limit):
        with self._condicion:
            job = self._buscar(identificador)
            if (
                type(after) is not int
                or after < 0
                or after > len(job.rows)
                or not 1 <= limit <= 100
            ):
                raise FalloWeb(400, "INVALID_CURSOR", "El cursor de resultados no es válido.")
            filas = deepcopy(job.rows[after : after + limit])
            respuesta = {
                "id": job.id,
                "next_cursor": after + len(filas),
                "processed": len(job.rows),
                "total": len(job.tickers),
                "done": job.state in TERMINALES,
                "revision": job.revision,
            }
        respuesta["items"] = [empresa_a_dto(p, d) | {"calculation": sello} for p, d, sello in filas]
        return respuesta

    def cancelar(self, identificador):
        with self._condicion:
            job = self._buscar(identificador)
            if job.state == "queued":
                self._queue.remove(job.id)
                self._terminar(job, "cancelled")
            elif job.state == "running":
                self._cambiar(job, "cancelling")
            return self._estado(job)

    def historico(self, identificador, ticker, operacion, periodo="1y"):
        from .recursos import financieros_a_items, precios_a_items

        with self._condicion:
            job = self._buscar(identificador)
            if ticker not in job.tickers:
                raise FalloWeb(404, "COMPANY_NOT_FOUND", "La empresa no pertenece a este análisis.")
            fila = next((r for r in job.rows if r[0]["Ticker"] == ticker), None)
            if fila is None:
                raise FalloWeb(
                    409,
                    "COMPANY_NOT_READY",
                    "Espera a que termine el análisis de esta empresa.",
                    retryable=True,
                )
            clave = self._clave(job, operacion, ticker, periodo)
            cache = self._cache_get(clave)
            if cache is not None:
                cache["cache_hit"] = True
                return cache
            source, config, dataset = job.source, job.config, job.dataset_version
            # El servicio financiero ya convierte por FX a moneda de cotización.
            moneda = fila[0]["Moneda"]
        lane = self._lanes[source]
        if not self.listo or not lane.acquire(blocking=False):
            raise FalloWeb(
                503,
                "ACQUISITION_BUSY",
                "La fuente está ocupada. Reintenta este panel en unos segundos.",
                retryable=True,
            )
        ejecutor = None
        try:
            ejecutor = self._ejecutor_factory(source, self.ajustes.acquisition_timeout_seconds)
            with self._condicion:
                if self._stopping:
                    raise ErrorInfraestructura()
                self._historicos_activos.add(ejecutor)
            obtenido = ejecutor.ejecutar(
                operacion, ticker, periodo if operacion == "prices" else config
            )
            if operacion == "prices":
                items = precios_a_items(obtenido)
                extra = {
                    "period": periodo,
                    "price_kind": "synthetic" if source == "demo" else "adjusted_close",
                }
                ttl = self.ajustes.prices_cache_ttl_seconds
            else:
                items, margenes = financieros_a_items(obtenido)
                extra = {"unit": "millions", "margins": margenes}
                ttl = self.ajustes.financials_cache_ttl_seconds
            sello = self._sello(ttl)
            respuesta = {
                "ticker": ticker,
                "source": source,
                "dataset_version": dataset,
                "currency": moneda,
                "reference_date": ProveedorDemo().fecha_referencia if source == "demo" else None,
                "fetched_at": sello["computed_at"],
                **sello,
                "availability": "available" if items else "empty",
                "message": None if items else "No hay observaciones disponibles para este recurso.",
                "provenance": "Datos sintéticos de demostración."
                if source == "demo"
                else "Yahoo Finance vía yfinance; adquisición posterior al análisis.",
                "items": items,
                **extra,
            }
            with self._condicion:
                self._cache_put(clave, respuesta, ttl, identificador)
            return respuesta
        except Exception:
            raise FalloWeb(
                502,
                "HISTORY_FAILED",
                "No se pudo obtener este histórico. El análisis sigue disponible.",
                retryable=True,
            ) from None
        finally:
            if ejecutor:
                ejecutor.cerrar()
                with self._condicion:
                    self._historicos_activos.discard(ejecutor)
            lane.release()

    def exportar(self, identificador):
        from .recursos import exportar_snapshot

        with self._condicion:
            job = self._buscar(identificador)
            if job.state != "completed":
                raise FalloWeb(409, "EXPORT_NOT_READY", "El Excel requiere un análisis completado.")
            principales = [deepcopy(p) for p, _, _ in job.rows]
            detalles = [deepcopy(d) for _, d, _ in job.rows]
            config, source = job.config, job.source
        if not self._export_lane.acquire(blocking=False):
            raise FalloWeb(
                503,
                "EXPORT_BUSY",
                "Se está preparando otra descarga. Reintenta en unos segundos.",
                retryable=True,
            )
        try:
            return exportar_snapshot(principales, detalles, config, source)
        finally:
            self._export_lane.release()

    def esperar_terminal(self, identificador, timeout):
        """Sin polling: útil para verificaciones internas, no expuesto por HTTP."""
        with self._condicion:
            termino = self._condicion.wait_for(
                lambda: self._jobs[identificador].state in TERMINALES, timeout
            )
            if not termino:
                raise TimeoutError("El análisis no terminó durante la verificación.")
            return self._estado(self._jobs[identificador])

    def _clave(self, job, recurso, ticker, extra=""):
        return (
            recurso,
            job.source,
            job.dataset_version,
            VERSION_METODOLOGIA,
            ticker,
            json.dumps(asdict(job.config), sort_keys=True) if recurso != "prices" else extra,
        )

    def _cache_get(self, key):
        self._podar()
        entry = self._cache.get(key)
        if entry is None:
            return None
        self._cache.move_to_end(key)
        return deepcopy(entry[2])

    def _cache_put(self, key, valor, ttl, protegido=None):
        tamano = _tamano(valor)
        if self._espacio(tamano, protegido):
            self._cache[key] = (self._monotono() + ttl, tamano, deepcopy(valor))
            while len(self._cache) > 512:
                self._cache.popitem(last=False)

    def _sello(self, ttl):
        ahora = self._utc()
        return a_json_seguro(
            {"computed_at": ahora, "expires_at": ahora + timedelta(seconds=ttl), "cache_hit": False}
        )

    def _trabajar(self):
        while True:
            with self._condicion:
                if not self._condicion.wait_for(lambda: self._stopping or self._queue, timeout=30):
                    self._podar()
                    continue
                if self._stopping:
                    return
                identificador = self._queue.popleft()
                job = self._jobs.get(identificador)
                if job is None or job.state != "queued":
                    continue
                job.started_at, job.started_mono = self._utc(), self._monotono()
                self._cambiar(job, "running")
            self._procesar(job)
            with self._condicion:
                self._podar()

    def _procesar(self, job):
        ejecutor = None
        lane = self._lanes[job.source]
        adquirido = False
        estado_terminal, error_terminal = "completed", None
        try:
            for ticker in job.tickers:
                with self._condicion:
                    if self._stopping or job.state == "cancelling":
                        estado_terminal = "cancelled"
                        return
                    if self._monotono() - job.started_mono >= self.ajustes.job_deadline_seconds:
                        raise ErrorInfraestructura("JOB_DEADLINE_EXCEEDED")
                    job.current_ticker = ticker
                    job.revision += 1
                    clave = self._clave(job, "analysis", ticker)
                    cache = self._cache_get(clave)
                if cache is not None:
                    p, d, sello = cache
                    sello["cache_hit"] = True
                else:
                    if ejecutor is None:
                        # Espera acotada por la adquisición histórica que ya ocupaba la vía.
                        adquirido = lane.acquire(
                            timeout=self.ajustes.acquisition_timeout_seconds + 3
                        )
                        if not adquirido:
                            raise ErrorInfraestructura()
                        ejecutor = self._ejecutor_factory(
                            job.source, self.ajustes.acquisition_timeout_seconds
                        )
                        with self._condicion:
                            self._ejecutor = ejecutor
                            if self._stopping:
                                raise ErrorInfraestructura()
                    try:
                        p, d = ejecutor.ejecutar("analysis", ticker, job.config)
                        # Validar antes de publicar, cachear o exportar.
                        EmpresaResultado.model_validate(empresa_a_dto(p, d))
                    except ErrorProveedor:
                        p, d = crear_resultado_error(ticker, ErrorProveedor())
                    sello = self._sello(self.ajustes.analysis_cache_ttl_seconds)
                fila = deepcopy((p, d, sello))
                with self._condicion:
                    tamano = _tamano(fila)
                    if not self._espacio(tamano, job.id):
                        raise ErrorInfraestructura("MEMORY_LIMIT_EXCEEDED")
                    job.rows.append(fila)
                    job.bytes += tamano
                    job.revision += 1
                    if cache is None and p["Estado"] != "ERROR":
                        self._cache_put(
                            clave, fila, self.ajustes.analysis_cache_ttl_seconds, job.id
                        )
                    self._condicion.notify_all()
                    if job.state == "cancelling" or self._stopping:
                        estado_terminal = "cancelled"
                        return
                    if len(job.rows) == len(job.tickers):
                        return
                    self._condicion.wait(timeout=job.config.pausa_entre_tickers)
        except Exception as error:
            codigo = error.code if isinstance(error, ErrorInfraestructura) else "ACQUISITION_FAILED"
            mensaje = {
                "JOB_DEADLINE_EXCEEDED": "El análisis superó su plazo de ejecución. Puedes crear uno nuevo.",
                "MEMORY_LIMIT_EXCEEDED": "El análisis superó el presupuesto de datos. Prueba un lote menor.",
            }.get(codigo, "No se pudo completar el análisis. Puedes crear uno nuevo.")
            estado_terminal = "failed"
            error_terminal = {"code": codigo, "message": mensaje, "fields": [], "retryable": True}
            LOG.warning("analysis_failed id=%s code=%s processed=%d", job.id, codigo, len(job.rows))
        finally:
            if ejecutor:
                ejecutor.cerrar()
            if adquirido:
                lane.release()
            with self._condicion:
                self._ejecutor = None
                if self._stopping or (job.state == "cancelling" and estado_terminal == "completed"):
                    estado_terminal, error_terminal = "cancelled", None
                self._terminar(job, estado_terminal, error_terminal)
