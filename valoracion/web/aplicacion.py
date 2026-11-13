"""API de trabajos efímeros; el motor financiero y Streamlit siguen independientes."""

import logging
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Annotated

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException

from valoracion.metodologia import VERSION_CONTRATO, VERSION_METODOLOGIA
from valoracion.normalizacion import mercado_de_ticker
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.universo import cargar_universo

from .adaptadores import a_json_seguro
from .ajustes import Ajustes
from .cuerpos import LimiteCuerpo
from .errores import FalloWeb
from .esquemas import (
    Catalogo,
    ConfiguracionWeb,
    ConsultaCatalogo,
    ConsultaPrecios,
    ConsultaResultados,
    ConsultaVacia,
    EstadoTrabajo,
    FinancierosHistoricos,
    Metadatos,
    PaginaResultados,
    PreciosHistoricos,
    RespuestaError,
    Salud,
    SolicitudAnalisis,
)
from .trabajos import GestorTrabajos

LOG = logging.getLogger(__name__)
ERRORES = {
    codigo: {"model": RespuestaError}
    for codigo in (400, 404, 409, 410, 413, 422, 429, 500, 502, 503)
}


def _respuesta_error(error):
    headers = {"Retry-After": "3"} if error.status in {429, 503} and error.retryable else None
    return JSONResponse(
        status_code=error.status, content={"error": error.detalle()}, headers=headers
    )


def create_app(ajustes: Ajustes | None = None, *, gestor: GestorTrabajos | None = None) -> FastAPI:
    ajustes = ajustes if ajustes is not None else Ajustes.del_entorno()
    universo, demo = cargar_universo(), ProveedorDemo()
    gestor = gestor if gestor is not None else GestorTrabajos(ajustes)

    @asynccontextmanager
    async def lifespan(app):
        gestor.iniciar()
        try:
            yield
        finally:
            gestor.cerrar()

    app = FastAPI(title="IntVal API", version="1.0", redoc_url=None, lifespan=lifespan)
    app.state.ajustes, app.state.gestor = ajustes, gestor
    app.add_middleware(LimiteCuerpo, max_bytes=ajustes.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(ajustes.origenes_cors),
        allow_methods=["GET", "POST"],
        allow_headers=["Accept", "Content-Type"],
        expose_headers=["Content-Disposition", "Retry-After"],
        allow_credentials=False,
    )

    @app.exception_handler(FalloWeb)
    async def fallo_web(request: Request, error: FalloWeb):
        return _respuesta_error(error)

    @app.exception_handler(RequestValidationError)
    async def solicitud_invalida(request: Request, error: RequestValidationError):
        es_query_operativa = request.url.path != "/api/v1/catalog" and all(
            e["loc"][0] == "query" for e in error.errors()
        )
        campos = [
            {"field": ".".join(str(p) for p in e["loc"][1:]), "message": "Valor no válido."}
            for e in error.errors()
        ]
        return _respuesta_error(
            FalloWeb(
                400 if es_query_operativa else 422,
                "INVALID_REQUEST",
                "Revisa los campos de la solicitud.",
                fields=campos,
            )
        )

    @app.exception_handler(HTTPException)
    async def error_http(request: Request, error: HTTPException):
        codigo = "METHOD_NOT_ALLOWED" if error.status_code == 405 else "NOT_FOUND"
        return _respuesta_error(
            FalloWeb(error.status_code, codigo, "La operación solicitada no está disponible.")
        )

    @app.exception_handler(Exception)
    async def inesperado(request: Request, error: Exception):
        LOG.error("http_failed code=INTERNAL_ERROR type=%s", type(error).__name__)
        return _respuesta_error(
            FalloWeb(500, "INTERNAL_ERROR", "No se pudo completar la operación.", retryable=True)
        )

    @app.get("/healthz", response_model=Salud, operation_id="getHealth")
    async def salud():
        return Salud()

    @app.get(
        "/readyz",
        response_model=Salud,
        operation_id="getReadiness",
        responses={503: {"model": RespuestaError}},
    )
    async def preparado():
        if not gestor.listo:
            raise FalloWeb(
                503, "SERVICE_UNAVAILABLE", "El servicio se está preparando.", retryable=True
            )
        return Salud()

    @app.get("/api/v1/meta", response_model=Metadatos, operation_id="getMetadata")
    async def metadatos():
        fuente = ajustes.fuente_default
        limites = {
            k: v
            for k, v in asdict(ajustes).items()
            if k not in {"demo", "mercado_habilitado", "origenes_cors"}
        }
        return a_json_seguro(
            {
                "schema_version": "1.0",
                "methodology_version": VERSION_METODOLOGIA,
                "financial_contract_version": VERSION_CONTRATO,
                "default_source": fuente,
                "capabilities": [
                    "catalog",
                    "analyses",
                    "cancellation",
                    "histories",
                    "excel_export",
                ],
                "demo": {"version": demo.version, "reference_date": demo.fecha_referencia},
                "configuration": asdict(ConfiguracionWeb().a_dominio(fuente)),
                "limits": limites,
                "sources": [
                    {"id": "demo", "enabled": True},
                    {"id": "market", "enabled": ajustes.mercado_habilitado},
                ],
            }
        )

    @app.get(
        "/api/v1/catalog",
        response_model=Catalogo,
        operation_id="getCatalog",
        responses={422: {"model": RespuestaError}},
    )
    async def catalogo(consulta: Annotated[ConsultaCatalogo, Query()]):
        if consulta.source == "market" and not ajustes.mercado_habilitado:
            raise FalloWeb(
                422,
                "SOURCE_DISABLED",
                "La fuente de mercado está deshabilitada.",
                fields=[{"field": "source", "message": "Selecciona una fuente habilitada."}],
            )
        es_demo = consulta.source == "demo"
        tickers = demo.tickers() if es_demo else universo.todos
        items = [
            {"ticker": t, "market": mercado_de_ticker(t)}
            for t in tickers
            if consulta.market in {"all", mercado_de_ticker(t)}
        ]
        return {
            "source": consulta.source,
            "market": consulta.market,
            "dataset_version": demo.version if es_demo else f"universe-{universo.fecha_snapshot}",
            "reference_date": demo.fecha_referencia if es_demo else universo.fecha_snapshot,
            "description": "Datos sintéticos de demostración." if es_demo else universo.descripcion,
            "total": len(items),
            "items": items,
        }

    @app.post(
        "/api/v1/analyses",
        response_model=EstadoTrabajo,
        status_code=202,
        operation_id="createAnalysis",
        responses=ERRORES,
    )
    async def crear(solicitud: SolicitudAnalisis):
        return gestor.crear(solicitud)

    @app.get(
        "/api/v1/analyses/{id}",
        response_model=EstadoTrabajo,
        operation_id="getAnalysis",
        responses=ERRORES,
    )
    async def estado(id: str):
        return gestor.estado(id)

    @app.get(
        "/api/v1/analyses/{id}/results",
        response_model=PaginaResultados,
        operation_id="getAnalysisResults",
        responses=ERRORES,
    )
    async def resultados(id: str, consulta: Annotated[ConsultaResultados, Query()]):
        return gestor.resultados(id, consulta.after, consulta.limit)

    @app.post(
        "/api/v1/analyses/{id}/cancel",
        response_model=EstadoTrabajo,
        operation_id="cancelAnalysis",
        responses=ERRORES,
    )
    async def cancelar(id: str):
        return gestor.cancelar(id)

    @app.get(
        "/api/v1/analyses/{id}/companies/{ticker}/prices",
        response_model=PreciosHistoricos,
        operation_id="getCompanyPrices",
        responses=ERRORES,
    )
    def precios(id: str, ticker: str, consulta: Annotated[ConsultaPrecios, Query()]):
        return gestor.historico(id, ticker, "prices", consulta.period)

    @app.get(
        "/api/v1/analyses/{id}/companies/{ticker}/financials",
        response_model=FinancierosHistoricos,
        operation_id="getCompanyFinancials",
        responses=ERRORES,
    )
    def financieros(id: str, ticker: str, consulta: Annotated[ConsultaVacia, Query()]):
        return gestor.historico(id, ticker, "financials")

    @app.get(
        "/api/v1/analyses/{id}/export.xlsx",
        operation_id="exportAnalysis",
        response_class=Response,
        responses={
            **ERRORES,
            200: {
                "description": "Snapshot completo del análisis.",
                "content": {
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                        "schema": {"type": "string", "format": "binary"}
                    }
                },
            },
        },
    )
    def exportar(id: str, consulta: Annotated[ConsultaVacia, Query()]):
        contenido, nombre = gestor.exportar(id)
        return Response(
            contenido,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f'attachment; filename="{nombre}"',
                "Cache-Control": "no-store",
            },
        )

    return app
