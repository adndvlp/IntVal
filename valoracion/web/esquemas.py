"""Contratos de transporte independientes del contrato financiero 2.0."""

import re
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator

from valoracion.configuracion import Configuracion

Fuente = Literal["market", "demo"]
Mercado = Literal["USA", "MX"]
Tasa = Annotated[float, Field(ge=0.05, le=0.20)]
Factor = Annotated[float, Field(ge=0, le=1)]
Multiplo = Annotated[float, Field(ge=4, le=30)]


class ContratoEstricto(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class ConfiguracionWeb(ContratoEstricto):
    tasa_descuento: Tasa = 0.10
    tasa_descuento_empresa: Tasa = 0.10
    factor_margen_conservador: Annotated[float, Field(ge=0.4, le=1)] = 0.80
    factor_crecimiento_inicial: Factor = 0.25
    factor_crecimiento_final: Factor = 0.50
    multiplo_terminal_fcl: Multiplo = 12.0
    multiplo_terminal_ebit: Multiplo = 12.0
    multiplo_terminal_ebitda: Multiplo = 12.0
    multiplo_terminal_utilidad_neta: Annotated[float, Field(ge=4, le=35)] = 15.0

    def a_dominio(self, fuente: Fuente) -> Configuracion:
        return Configuracion(
            **self.model_dump(), pausa_entre_tickers=0 if fuente == "demo" else 0.15
        )


class ConfiguracionEfectiva(ConfiguracionWeb):
    """Supuestos editables y constantes efectivas; sólo es respuesta de lectura."""

    anos_proyeccion: Literal[10] = 10
    crecimiento_minimo: Literal[-0.02] = -0.02
    crecimiento_maximo: Literal[0.12] = 0.12
    crecimiento_fallback: Literal[0.03] = 0.03
    max_anos_historicos: Literal[5] = 5
    tasa_impuestos_fallback: Literal[0.21] = 0.21
    tasa_impuestos_minima: Literal[0.0] = 0.0
    tasa_impuestos_maxima: Literal[0.35] = 0.35
    pausa_entre_tickers: Literal[0, 0.15]


class SolicitudAnalisis(ContratoEstricto):
    client_request_id: str
    source: Fuente
    tickers: list[str]
    configuration: ConfiguracionWeb = Field(default_factory=ConfiguracionWeb)

    @field_validator("client_request_id")
    @classmethod
    def uuid_valido(cls, valor: str) -> str:
        return str(UUID(valor))

    @field_validator("tickers")
    @classmethod
    def simbolos_validos(cls, valores: list[str]) -> list[str]:
        normalizados = list(dict.fromkeys(v.strip().upper() for v in valores))
        # Incluye PE&OLES.MX del catálogo; excluye rutas, URLs y controles.
        if not normalizados or any(
            not re.fullmatch(r"[A-Z0-9][A-Z0-9&.\-]{0,31}", v) or ".." in v for v in normalizados
        ):
            raise ValueError("Selecciona símbolos válidos de hasta 32 caracteres.")
        return normalizados


ModeloProxy = Literal["fcl", "nopat", "ebitda_adjusted", "net_income"]


class Proxy(ContratoEstricto):
    id: ModeloProxy
    value_per_share: float | None
    upside: float | None
    included: bool
    exclusion_reason: str | None


class Mediana(ContratoEstricto):
    value_per_share: float | None
    upside: float | None
    count: int
    included_models: list[ModeloProxy]


class ObjetivoAnalistas(ContratoEstricto):
    value: float | None
    upside: float | None
    statistic: str | None
    coverage: int | None
    date: str | None
    horizon: str | None
    source: str | None


class Trazabilidad(ContratoEstricto):
    source: str | None
    fetched_at: str | None
    price_date: str | None
    price_source: str | None
    reporting_currency: str | None
    quote_currency: str | None
    fx_rate: float | None
    fx_source: str | None
    fx_fetched_at: str | None
    fx_date: str | None
    revenue_period: str | None
    debt_period: str | None
    cash_period: str | None


class CampoAuditoria(ContratoEstricto):
    key: str
    domain_key: str
    label: str
    value: JsonValue


class EmpresaResultado(ContratoEstricto):
    ticker: str
    market: Mercado
    company_name: str
    currency: str | None
    market_price: float | None
    proxies: list[Proxy]
    median: Mediana
    analyst_target: ObjetivoAnalistas
    status: Literal["OK", "DATOS INCOMPLETOS", "REVISAR", "ERROR"]
    notes: str | None
    company_class: str | None
    traceability: Trazabilidad
    audit_fields: list[CampoAuditoria]


class Salud(ContratoEstricto):
    status: Literal["ok"] = "ok"


class DatosDemo(ContratoEstricto):
    version: str
    reference_date: str


class FuenteDisponible(ContratoEstricto):
    id: Fuente
    enabled: bool


class Limites(ContratoEstricto):
    max_tickers: Annotated[int, Field(gt=0)]
    max_body_bytes: int
    max_queue: int
    max_retained: int
    memory_budget_bytes: int
    terminal_ttl_seconds: int
    analysis_cache_ttl_seconds: int
    prices_cache_ttl_seconds: int
    financials_cache_ttl_seconds: int
    job_deadline_seconds: int
    acquisition_timeout_seconds: int
    max_symbol_length: Literal[32] = 32
    max_results_page: Literal[100] = 100
    analysis_workers: Literal[1] = 1
    max_cache_entries: Literal[512] = 512
    max_tombstones: Literal[64] = 64
    memory_measurement: Literal["managed_json_payload_bytes"] = "managed_json_payload_bytes"


class Metadatos(ContratoEstricto):
    schema_version: Literal["1.0"] = "1.0"
    methodology_version: str
    financial_contract_version: str
    default_source: Fuente
    capabilities: list[Literal["catalog", "analyses", "cancellation", "histories", "excel_export"]]
    demo: DatosDemo
    configuration: ConfiguracionEfectiva
    limits: Limites
    sources: list[FuenteDisponible]


class ConsultaCatalogo(ContratoEstricto):
    source: Fuente = "market"
    market: Literal["USA", "MX", "all"] = "all"


class EmpresaCatalogo(ContratoEstricto):
    ticker: str
    market: Mercado


class Catalogo(ContratoEstricto):
    source: Fuente
    market: Literal["USA", "MX", "all"]
    dataset_version: str
    reference_date: str
    description: str
    total: Annotated[int, Field(ge=0)]
    items: list[EmpresaCatalogo]


class CampoInvalido(ContratoEstricto):
    field: str
    message: str


class ErrorDetalle(ContratoEstricto):
    code: Literal[
        "INVALID_REQUEST",
        "SOURCE_DISABLED",
        "IDEMPOTENCY_CONFLICT",
        "CAPACITY_EXCEEDED",
        "SERVICE_UNAVAILABLE",
        "ANALYSIS_EXPIRED",
        "ANALYSIS_NOT_FOUND",
        "INVALID_CURSOR",
        "ACQUISITION_FAILED",
        "COMPANY_NOT_FOUND",
        "COMPANY_NOT_READY",
        "ACQUISITION_BUSY",
        "HISTORY_FAILED",
        "EXPORT_NOT_READY",
        "EXPORT_BUSY",
        "EXPORT_FAILED",
        "BODY_TOO_LARGE",
        "NOT_FOUND",
        "METHOD_NOT_ALLOWED",
        "INTERNAL_ERROR",
        "JOB_DEADLINE_EXCEEDED",
        "MEMORY_LIMIT_EXCEEDED",
    ]
    message: str
    fields: list[CampoInvalido] = Field(default_factory=list)
    retryable: bool = False


class RespuestaError(ContratoEstricto):
    error: ErrorDetalle


class EnlacesTrabajo(ContratoEstricto):
    status: str
    results: str
    cancel: str
    export: str


class Conteos(ContratoEstricto):
    ok: int = Field(alias="OK")
    incomplete: int = Field(alias="DATOS INCOMPLETOS")
    review: int = Field(alias="REVISAR")
    error: int = Field(alias="ERROR")


class EstadoTrabajo(ContratoEstricto):
    id: str
    state: Literal["queued", "running", "cancelling", "completed", "cancelled", "failed"]
    source: Fuente
    total: int
    processed: int
    current_ticker: str | None
    counts: Conteos
    configuration: ConfiguracionEfectiva
    dataset_version: str
    schema_version: Literal["1.0"]
    methodology_version: str
    financial_contract_version: str
    revision: int
    created_at: str
    started_at: str | None
    finished_at: str | None
    expires_at: str | None
    error: ErrorDetalle | None
    links: EnlacesTrabajo


class SelloCalculo(ContratoEstricto):
    computed_at: str
    expires_at: str
    cache_hit: bool


class ResultadoPublicado(EmpresaResultado):
    calculation: SelloCalculo


class PaginaResultados(ContratoEstricto):
    id: str
    next_cursor: int
    processed: int
    total: int
    done: bool
    revision: int
    items: list[ResultadoPublicado]


class ConsultaResultados(BaseModel):
    # Las queries HTTP son cadenas; se convierten sólo enteros, no floats/bools.
    model_config = ConfigDict(extra="forbid")
    after: Annotated[int, Field(ge=0)] = 0
    limit: Annotated[int, Field(ge=1, le=100)] = 100


class ConsultaPrecios(ContratoEstricto):
    period: Literal["1y", "2y", "5y", "10y"] = "1y"


class ConsultaVacia(ContratoEstricto):
    """No permite supuestos ni filtros ajenos al snapshot en estas rutas."""


class ObservacionPrecio(ContratoEstricto):
    date: str
    value: float | None


class ObservacionFinanciera(ContratoEstricto):
    year: int
    revenue: float | None
    fcl: float | None
    ebit: float | None
    ebitda: float | None
    net_income: float | None


class ObservacionMargenes(ContratoEstricto):
    year: int
    fcl: float | None
    nopat: float | None
    ebitda: float | None
    net_income: float | None


class MargenesHistoricos(ContratoEstricto):
    unit: Literal["ratio"]
    items: list[ObservacionMargenes]


class HistoricoBase(SelloCalculo):
    ticker: str
    source: Fuente
    dataset_version: str
    currency: str | None
    reference_date: str | None
    fetched_at: str
    availability: Literal["available", "empty"]
    message: str | None
    provenance: str


class PreciosHistoricos(HistoricoBase):
    period: Literal["1y", "2y", "5y", "10y"]
    price_kind: Literal["synthetic", "adjusted_close"]
    items: list[ObservacionPrecio]


class FinancierosHistoricos(HistoricoBase):
    unit: Literal["millions"]
    items: list[ObservacionFinanciera]
    margins: MargenesHistoricos
