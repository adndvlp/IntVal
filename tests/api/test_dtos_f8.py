"""F8: solicitudes normalizadas y adaptación sin recalcular finanzas."""

import json
from dataclasses import asdict
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from tests.fixtures.escenarios_f2 import CASOS
from tests.integration.test_servicio_inyectado import (
    ProveedorMemoria,
    datos_del_caso,
    migrar_referencia_f3,
)
from valoracion.modelos import COLUMNAS_DETALLE
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.servicio import analizar_empresa
from valoracion.web import adaptadores, esquemas


def solicitud(**cambios):
    return esquemas.SolicitudAnalisis(
        **{"client_request_id": str(uuid4()), "source": "demo", "tickers": ["DEMO-USA"]} | cambios
    )


def test_normaliza_antes_de_contar_y_conserva_simbolos_reales_del_catalogo():
    pedido = solicitud(source="market", tickers=[" aapl ", "AAPL", "pe&oles.mx", "BRK-B"])
    assert pedido.tickers == ["AAPL", "PE&OLES.MX", "BRK-B"]
    assert pedido.configuration.a_dominio("market").tasa_descuento == 0.1


def test_catalogo_completo_cabe_y_sus_604_simbolos_son_admisibles():
    from valoracion.universo import CATALOGO
    from valoracion.web.ajustes import Ajustes

    completo = solicitud(source="market", tickers=list(CATALOGO.todos))
    assert len(completo.tickers) == 604 <= Ajustes().max_tickers
    assert completo.tickers == list(CATALOGO.todos)


@pytest.mark.parametrize(
    "cambios",
    [
        {"tickers": []},
        {"tickers": [""]},
        {"tickers": ["http://malicioso"]},
        {"tickers": ["../app.py"]},
        {"tickers": ["A" * 33]},
        {"tickers": [True]},
        {"client_request_id": "no-uuid"},
        {"source": "otra"},
        {"precio": 100},
        {"configuration": {"tasa_descuento": True}},
    ],
)
def test_rechaza_solicitudes_antes_de_adquirir_datos(cambios):
    with pytest.raises(ValidationError):
        solicitud(**cambios)


def test_dto_concilia_modelos_mediana_analistas_y_los_73_campos():
    config = esquemas.ConfiguracionWeb().a_dominio("demo")
    principal, detalle = analizar_empresa(
        "DEMO-USA", config, proveedor=ProveedorDemo()
    ).como_registros()
    dto = adaptadores.empresa_a_dto(principal, detalle)
    assert dto["median"]["value_per_share"] == pytest.approx(116.1879930510067)
    assert dto["median"]["upside"] == pytest.approx(0.1618799305100671)
    assert dto["median"]["included_models"] == ["fcl", "nopat", "ebitda_adjusted", "net_income"]
    assert dto["analyst_target"]["statistic"] == "sintético"
    assert dto["analyst_target"]["value"] == 120
    assert len(dto["audit_fields"]) == len(COLUMNAS_DETALLE) == 73
    assert len({f["key"] for f in dto["audit_fields"]}) == 73
    assert {f["domain_key"]: f["value"] for f in dto["audit_fields"]} == detalle
    assert dto["traceability"]["price_date"] == "2025-01-03"
    assert esquemas.EmpresaResultado.model_validate(dto).model_dump() == dto
    assert asdict(config)["tasa_descuento"] == 0.1


def test_no_infiere_inclusion_por_positividad_ni_convierte_ausencia_en_cero():
    config = esquemas.ConfiguracionWeb().a_dominio("demo")
    p, d = analizar_empresa("DEMO-INCOMPLETA", config, proveedor=ProveedorDemo()).como_registros()
    p["Valor intrínseco FCL"] = 12.0
    d["Modelos excluidos"] = '{"FCL": "Falta una base comparable"}'
    dto = adaptadores.empresa_a_dto(p, d)
    assert dto["proxies"][0]["value_per_share"] == 12
    assert dto["proxies"][0]["included"] is False
    assert dto["proxies"][0]["exclusion_reason"] == "Falta una base comparable"
    assert dto["median"] == {
        "value_per_share": None,
        "upside": None,
        "count": 0,
        "included_models": [],
    }


@pytest.mark.parametrize("caso", CASOS)
def test_dto_conserva_oraculos_historicos_sin_sobrescribir_fixtures(caso):
    datos, config = datos_del_caso(caso)
    principal, detalle = analizar_empresa(
        "TEST", config, proveedor=ProveedorMemoria(datos)
    ).como_registros()
    esperado = json.loads(
        (Path(__file__).resolve().parents[1] / "fixtures/resultados_f1.json").read_text(
            encoding="utf-8"
        )
    )[caso]
    referencia, _ = migrar_referencia_f3(esperado, caso)
    dto = esquemas.EmpresaResultado.model_validate(adaptadores.empresa_a_dto(principal, detalle))
    assert dto.status == referencia["Estado"]
    if referencia["Mediana de modelos"] is None:
        assert dto.median.value_per_share is None
    else:
        assert dto.median.value_per_share == pytest.approx(referencia["Mediana de modelos"])
    for proxy, clave in zip(dto.proxies, ["FCL", "EBIT", "EBITDA", "utilidad neta"], strict=True):
        valor = referencia[f"Valor intrínseco {clave}"]
        if valor is None:
            assert proxy.value_per_share is None
        else:
            assert proxy.value_per_share == pytest.approx(valor)
