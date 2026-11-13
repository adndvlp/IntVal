"""F6: contratos iniciales reales, sin consultas al proveedor de mercado."""

from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from importlib import import_module

import numpy as np
import pandas as pd
import pytest


def modulo(nombre):
    return import_module(f"valoracion.web.{nombre}")


def cliente():
    app = modulo("aplicacion").create_app()
    return import_module("fastapi.testclient").TestClient(app)


def test_salud_y_metadatos_describen_solo_capacidades_implementadas():
    with cliente() as client:
        assert client.get("/healthz").json() == {"status": "ok"}
        response = client.get("/api/v1/meta")
        assert response.status_code == 200
        meta = response.json()
        assert meta["schema_version"] == "1.0"
        assert meta["methodology_version"] == "proxies-1.0"
        assert meta["financial_contract_version"] == "2.0"
        assert meta["default_source"] == "market"
        assert meta["capabilities"] == [
            "catalog",
            "analyses",
            "cancellation",
            "histories",
            "excel_export",
        ]
        assert meta["demo"] == {"version": "demo-1.0", "reference_date": "2025-01-03"}
        config = meta["configuration"]
        assert config["tasa_descuento"] == config["tasa_descuento_empresa"] == 0.1
        assert config["anos_proyeccion"] == 10
        assert config["factor_margen_conservador"] == 0.8
        assert config["pausa_entre_tickers"] == 0.15
        assert meta["limits"]["max_tickers"] >= 604
        assert client.post("/api/v1/analyses", json={}).status_code == 422


@pytest.mark.parametrize(
    "source,market,total",
    [
        ("market", "USA", 500),
        ("market", "MX", 104),
        ("market", "all", 604),
        ("demo", "USA", 2),
        ("demo", "MX", 1),
        ("demo", "all", 3),
    ],
)
def test_catalogo_local_por_fuente_y_mercado(source, market, total):
    with cliente() as client:
        response = client.get("/api/v1/catalog", params={"source": source, "market": market})
        assert response.status_code == 200
        catalogo = response.json()
        assert catalogo["source"] == source
        assert catalogo["market"] == market
        assert catalogo["total"] == len(catalogo["items"]) == total
        assert len({item["ticker"] for item in catalogo["items"]}) == total
        if source == "demo":
            assert catalogo["dataset_version"] == "demo-1.0"
            assert catalogo["reference_date"] == "2025-01-03"
            assert all(item["ticker"].startswith("DEMO-") for item in catalogo["items"])
        if market != "all":
            assert {item["market"] for item in catalogo["items"]} == {market}


@pytest.mark.parametrize(
    "params,field",
    [
        ({"source": "otra"}, "source"),
        ({"market": "UE"}, "market"),
        ({"source": "demo", "desconocido": "x"}, "desconocido"),
    ],
)
def test_queries_invalidas_tienen_error_uniforme_sin_repetir_el_input(params, field):
    with cliente() as client:
        response = client.get("/api/v1/catalog", params=params)
        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "INVALID_REQUEST"
        assert error["retryable"] is False
        assert any(item["field"] == field for item in error["fields"])
        assert "input" not in response.json()


def test_default_demo_y_mercado_deshabilitado_son_ajustes_del_runtime(monkeypatch):
    monkeypatch.setenv("VALORACION_MARKET_ENABLED", "0")
    with cliente() as client:
        meta = client.get("/api/v1/meta").json()
        assert meta["default_source"] == "demo"
        assert meta["configuration"]["pausa_entre_tickers"] == 0
        assert meta["sources"] == [
            {"id": "demo", "enabled": True},
            {"id": "market", "enabled": False},
        ]
        assert client.get("/api/v1/catalog", params={"source": "demo"}).status_code == 200
        response = client.get("/api/v1/catalog", params={"source": "market"})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "SOURCE_DISABLED"


def test_variable_demo_no_afecta_otra_instancia(monkeypatch):
    monkeypatch.setenv("VALORACION_DEMO", "1")
    with cliente() as first:
        assert first.get("/api/v1/meta").json()["default_source"] == "demo"
    monkeypatch.setenv("VALORACION_DEMO", "0")
    with cliente() as second:
        assert second.get("/api/v1/meta").json()["default_source"] == "market"


@pytest.mark.parametrize(
    "variable,value",
    [
        ("VALORACION_DEMO", "maybe"),
        ("VALORACION_MARKET_ENABLED", "maybe"),
        ("VALORACION_MAX_TICKERS", "0"),
        ("VALORACION_MAX_TICKERS", "true"),
        ("VALORACION_CORS_ORIGINS", "*"),
    ],
)
def test_configuracion_operativa_invalida_falla_al_crear_app(monkeypatch, variable, value):
    monkeypatch.setenv(variable, value)
    with pytest.raises(ValueError, match=variable):
        modulo("aplicacion").create_app()


def test_supuestos_web_convierten_a_dominio_sin_cambiar_los_defaults_heredados():
    web = modulo("esquemas").ConfiguracionWeb(tasa_descuento=0.15)
    config = web.a_dominio("market")
    assert config.tasa_descuento == 0.15
    assert config.descuento_empresa == 0.1
    assert config.pausa_entre_tickers == 0.15
    assert web.a_dominio("demo").pausa_entre_tickers == 0
    assert asdict(config)["multiplo_terminal_utilidad_neta"] == 15
    dominio = import_module("valoracion.configuracion").Configuracion()
    assert dominio.tasa_descuento_empresa is None
    assert dominio.pausa_entre_tickers == 0.35


@pytest.mark.parametrize(
    "kwargs",
    [
        {"tasa_descuento": True},
        {"tasa_descuento": "0.1"},
        {"tasa_descuento": float("nan")},
        {"tasa_descuento_empresa": float("inf")},
        {"tasa_descuento_empresa": None},
        {"tasa_descuento": 0.049},
        {"tasa_descuento": 0.201},
        {"factor_margen_conservador": 0.39},
        {"factor_crecimiento_inicial": 1.1},
        {"factor_crecimiento_final": -0.1},
        {"multiplo_terminal_fcl": 3.9},
        {"multiplo_terminal_ebit": 31},
        {"multiplo_terminal_ebitda": 31},
        {"multiplo_terminal_utilidad_neta": 36},
        {"pausa_entre_tickers": 0},
        {"precio": 100},
    ],
)
def test_supuestos_publicos_rechazan_tipos_limites_y_campos_extra(kwargs):
    schema = modulo("esquemas").ConfiguracionWeb
    validation_error = import_module("pydantic").ValidationError
    with pytest.raises(validation_error):
        schema(**kwargs)


def test_serializacion_conserva_ausencias_numeros_y_fechas_verificables():
    convertir = modulo("adaptadores").a_json_seguro
    datos = {
        "numero": np.float64(1.25),
        "cantidad": np.int64(4),
        "logico": np.bool_(True),
        "nulo": pd.NA,
        "sin_fecha": pd.NaT,
        "fecha": date(2025, 1, 3),
        "instante": datetime(2025, 1, 3, 5, tzinfo=timezone(timedelta(hours=5))),
        "lista": (0, None, -1),
    }
    assert convertir(datos) == {
        "numero": 1.25,
        "cantidad": 4,
        "logico": True,
        "nulo": None,
        "sin_fecha": None,
        "fecha": "2025-01-03",
        "instante": "2025-01-03T00:00:00Z",
        "lista": [0, None, -1],
    }
    assert isinstance(convertir(np.int64(4)), int)


@pytest.mark.parametrize(
    "value",
    [float("nan"), float("inf"), float("-inf"), np.float64("nan"), {"anidado": [float("inf")]}],
)
def test_serializacion_rechaza_numeros_no_finitos(value):
    with pytest.raises(ValueError, match="finito"):
        modulo("adaptadores").a_json_seguro(value)


@pytest.mark.parametrize(
    "value", [pd.DataFrame({"dato": [1]}), object(), {1: "clave"}, datetime(2025, 1, 3)]
)
def test_serializacion_no_inventa_cadenas_ni_zonas_horarias(value):
    with pytest.raises((TypeError, ValueError)):
        modulo("adaptadores").a_json_seguro(value)


def test_openapi_exporta_solo_rutas_reales_y_es_determinista_desde_otro_cwd(tmp_path, monkeypatch):
    exportar = modulo("contratos").exportar_openapi
    app = modulo("aplicacion").create_app()
    schema = app.openapi()
    assert set(schema["paths"]) == {
        "/healthz",
        "/readyz",
        "/api/v1/meta",
        "/api/v1/catalog",
        "/api/v1/analyses",
        "/api/v1/analyses/{id}",
        "/api/v1/analyses/{id}/results",
        "/api/v1/analyses/{id}/cancel",
        "/api/v1/analyses/{id}/companies/{ticker}/prices",
        "/api/v1/analyses/{id}/companies/{ticker}/financials",
        "/api/v1/analyses/{id}/export.xlsx",
    }
    assert schema["info"]["version"] == "1.0"
    monkeypatch.chdir(tmp_path)
    primera = tmp_path / "a.json"
    segunda = tmp_path / "b.json"
    exportar(primera)
    exportar(segunda)
    assert primera.read_bytes() == segunda.read_bytes()
    texto = primera.read_text(encoding="utf-8")
    assert "/Users/" not in texto and "/home/" not in texto


def test_cors_esta_cerrado_salvo_allowlist_explicita(monkeypatch):
    monkeypatch.setenv("VALORACION_CORS_ORIGINS", "http://127.0.0.1:4321")
    with cliente() as client:
        response = client.get("/api/v1/meta", headers={"Origin": "http://127.0.0.1:4321"})
        assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:4321"
        response = client.get("/api/v1/meta", headers={"Origin": "https://otro.example"})
        assert "access-control-allow-origin" not in response.headers
