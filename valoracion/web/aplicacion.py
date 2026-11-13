"""API inicial de sólo lectura. No inicia trabajos ni consulta cotizaciones."""

from dataclasses import asdict
from typing import Annotated

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from valoracion.metodologia import VERSION_CONTRATO, VERSION_METODOLOGIA
from valoracion.normalizacion import mercado_de_ticker
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.universo import cargar_universo

from .adaptadores import a_json_seguro
from .ajustes import Ajustes
from .esquemas import (
    Catalogo,
    ConfiguracionWeb,
    ConsultaCatalogo,
    Metadatos,
    RespuestaError,
    Salud,
)


def create_app(ajustes: Ajustes | None = None) -> FastAPI:
    ajustes = ajustes if ajustes is not None else Ajustes.del_entorno()
    universo = cargar_universo()
    demo = ProveedorDemo()
    app = FastAPI(title="IntVal API", version="1.0", redoc_url=None)
    app.state.ajustes = ajustes
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(ajustes.origenes_cors),
        allow_methods=["GET"],
        allow_headers=["Accept"],
        allow_credentials=False,
    )

    @app.exception_handler(RequestValidationError)
    async def solicitud_invalida(request: Request, error: RequestValidationError):
        campos = [
            {"field": ".".join(str(p) for p in detalle["loc"][1:]), "message": "Valor no válido."}
            for detalle in error.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "INVALID_REQUEST",
                    "message": "Revisa los campos de la solicitud.",
                    "fields": campos,
                    "retryable": False,
                }
            },
        )

    @app.get("/healthz", response_model=Salud, operation_id="getHealth")
    def salud():
        return Salud()

    @app.get("/api/v1/meta", response_model=Metadatos, operation_id="getMetadata")
    def metadatos():
        fuente = ajustes.fuente_default
        return a_json_seguro(
            {
                "schema_version": "1.0",
                "methodology_version": VERSION_METODOLOGIA,
                "financial_contract_version": VERSION_CONTRATO,
                "default_source": fuente,
                "capabilities": ["catalog"],
                "demo": {"version": demo.version, "reference_date": demo.fecha_referencia},
                "configuration": asdict(ConfiguracionWeb().a_dominio(fuente)),
                "limits": {"max_tickers": ajustes.max_tickers},
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
    def catalogo(consulta: Annotated[ConsultaCatalogo, Query()]):
        if consulta.source == "market" and not ajustes.mercado_habilitado:
            return JSONResponse(
                status_code=422,
                content={
                    "error": {
                        "code": "SOURCE_DISABLED",
                        "message": "La fuente de mercado está deshabilitada.",
                        "fields": [
                            {"field": "source", "message": "Selecciona una fuente habilitada."}
                        ],
                        "retryable": False,
                    }
                },
            )
        es_demo = consulta.source == "demo"
        tickers = demo.tickers() if es_demo else universo.todos
        items = [
            {"ticker": ticker, "market": mercado_de_ticker(ticker)}
            for ticker in tickers
            if consulta.market in {"all", mercado_de_ticker(ticker)}
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

    return app
