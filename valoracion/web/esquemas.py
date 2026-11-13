"""Contratos de transporte independientes del contrato financiero 2.0."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

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


class Metadatos(ContratoEstricto):
    schema_version: Literal["1.0"] = "1.0"
    methodology_version: str
    financial_contract_version: str
    default_source: Fuente
    capabilities: list[Literal["catalog"]]
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
    code: Literal["INVALID_REQUEST", "SOURCE_DISABLED"]
    message: str
    fields: list[CampoInvalido] = Field(default_factory=list)
    retryable: Literal[False] = False


class RespuestaError(ContratoEstricto):
    error: ErrorDetalle
