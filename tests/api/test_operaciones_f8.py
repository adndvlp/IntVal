"""F8: HTTP real en ASGI, sin servidor TCP ni llamadas a Yahoo."""

from contextlib import contextmanager
from dataclasses import replace
from io import BytesIO
from uuid import uuid4

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from tests.api.test_gestor_f8 import Fabrica, Reloj
from valoracion import servicio
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.web.ajustes import Ajustes
from valoracion.web.aplicacion import create_app
from valoracion.web.trabajos import GestorTrabajos


class Recursos(Fabrica):
    def __init__(self):
        super().__init__()
        self.historia = None
        self.error_historia = False

    def ejecutar(self, operacion, ticker, argumento):
        if operacion == "analysis":
            return super().ejecutar(operacion, ticker, argumento)
        self.llamadas.append((operacion, ticker, argumento))
        if self.error_historia:
            raise RuntimeError("/Users/privado/credencial")
        if self.historia is not None:
            return self.historia
        proveedor = ProveedorDemo()
        if operacion == "prices":
            return servicio.obtener_precio_historico(ticker, argumento, proveedor=proveedor)
        return servicio.obtener_historicos_financieros(ticker, argumento, proveedor=proveedor)


@contextmanager
def web(ajustes=None, fabrica=None, reloj=None):
    ajustes = ajustes or Ajustes()
    fabrica = fabrica or Recursos()
    opciones = {"ejecutor_factory": fabrica}
    if reloj:
        opciones |= {"monotono": reloj.monotono, "utc": reloj.utc}
    gestor = GestorTrabajos(ajustes, **opciones)
    app = create_app(ajustes, gestor=gestor)
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, gestor, fabrica


def crear(client, tickers=None, **kwargs):
    return client.post(
        "/api/v1/analyses",
        json={
            "client_request_id": str(uuid4()),
            "source": "demo",
            "tickers": ["DEMO-USA"] if tickers is None else tickers,
            **kwargs,
        },
    )


def completar(client, gestor, **kwargs):
    response = crear(client, **kwargs)
    assert response.status_code == 202, response.text
    identificador = response.json()["id"]
    assert gestor.esperar_terminal(identificador, 5)["state"] == "completed"
    return f"/api/v1/analyses/{identificador}"


def test_api_demo_completa_con_config_inmutable_resultados_historia_y_excel():
    with web() as (client, gestor, fabrica):
        assert client.get("/readyz").json() == {"status": "ok"}
        base = completar(client, gestor, tickers=["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"])
        estado = client.get(base).json()
        assert estado["source"] == "demo" and estado["configuration"]["pausa_entre_tickers"] == 0
        assert estado["processed"] == estado["total"] == 3
        assert "items" not in estado
        primera = client.get(f"{base}/results?limit=2").json()
        segunda = client.get(f"{base}/results?after=2").json()
        assert [r["ticker"] for r in primera["items"] + segunda["items"]] == [
            "DEMO-USA",
            "DEMO-MX.MX",
            "DEMO-INCOMPLETA",
        ]
        assert primera["items"][1]["median"]["value_per_share"] == pytest.approx(209.138387491812)
        assert segunda["done"] is True and segunda["next_cursor"] == 3
        precios = client.get(f"{base}/companies/DEMO-USA/prices?period=1y").json()
        assert precios["price_kind"] == "synthetic"
        assert precios["reference_date"] == "2025-01-03"
        assert precios["items"][-1] == {"date": "2025-01-03", "value": 100.0}
        financieros = client.get(f"{base}/companies/DEMO-USA/financials").json()
        assert financieros["unit"] == "millions" and financieros["currency"] == "USD"
        assert financieros["items"][-1]["revenue"] == pytest.approx(0.001)
        assert financieros["items"][-1]["year"] == 2024
        assert "date" not in financieros["items"][-1]  # No inventar un día a partir del año.
        assert financieros["margins"]["unit"] == "ratio"
        assert financieros["margins"]["items"][-1]["fcl"] == pytest.approx(0.13)
        llamadas = len(fabrica.llamadas)
        exportacion = client.get(f"{base}/export.xlsx")
        assert exportacion.status_code == 200
        assert "demo_valoraciones_USA_MX.xlsx" in exportacion.headers["content-disposition"]
        libro = load_workbook(BytesIO(exportacion.content), data_only=True)
        assert libro.sheetnames == [
            "Resumen",
            "USA",
            "MX",
            "Detalle",
            "Supuestos",
            "Universo",
            "Fuentes",
        ]
        assert libro["Resumen"].max_row >= 4
        assert len(fabrica.llamadas) == llamadas
        assert client.get(base).json() == estado
        assert client.post(f"{base}/cancel").json()["state"] == "completed"


def test_salud_estado_y_meta_responden_durante_bloqueo_y_cancelacion_es_cooperativa():
    fabrica = Recursos()
    fabrica.soltar.clear()
    with web(fabrica=fabrica) as (client, gestor, _):
        response = crear(client, ["DEMO-USA", "DEMO-MX.MX"])
        assert response.status_code == 202
        base = response.json()["links"]["status"]
        assert fabrica.entro.wait(2)
        assert client.get("/healthz").status_code == client.get("/readyz").status_code == 200
        assert "analyses" in client.get("/api/v1/meta").json()["capabilities"]
        assert client.get(base).json()["current_ticker"] == "DEMO-USA"
        assert client.get(f"{base}/results").json()["items"] == []
        assert client.get(f"{base}/export.xlsx").json()["error"]["code"] == "EXPORT_NOT_READY"
        assert client.get(f"{base}/companies/DEMO-USA/financials").status_code == 409
        assert client.post(f"{base}/cancel").json()["state"] == "cancelling"
        fabrica.soltar.set()
        assert gestor.esperar_terminal(response.json()["id"], 3)["state"] == "cancelled"
        assert client.get(f"{base}/export.xlsx").status_code == 409


@pytest.mark.parametrize(
    "payload",
    [
        {"source": "market"},
        {"tickers": ["AAPL"]},
        {"tickers": []},
        {"configuration": {"tasa_descuento": 0.01}},
        {"precio": 10},
    ],
)
def test_validacion_no_encola_ni_toca_proveedor(payload):
    with web(Ajustes(mercado_habilitado=False)) as (client, gestor, fabrica):
        assert crear(client, **payload).status_code == 422
        assert fabrica.llamadas == [] and not gestor._queue


def test_limite_cuerpo_antes_de_json_tambien_sin_content_length():
    with web(Ajustes(max_body_bytes=300)) as (client, _, fabrica):
        for contenido in [b"x" * 301, iter([b"x" * 200, b"y" * 101])]:
            response = client.post(
                "/api/v1/analyses", content=contenido, headers={"Content-Type": "application/json"}
            )
            assert response.status_code == 413
            assert response.json()["error"]["code"] == "BODY_TOO_LARGE"
        assert fabrica.llamadas == []


def test_cola_http_retry_after_y_reintento_idempotente():
    fabrica = Recursos()
    fabrica.soltar.clear()
    with web(fabrica=fabrica) as (client, gestor, _):
        response = crear(client)
        assert response.status_code == 202
        assert fabrica.entro.wait(2)
        payload = {
            "client_request_id": str(uuid4()),
            "source": "demo",
            "tickers": ["demo-usa", "DEMO-USA"],
        }
        segundo = client.post("/api/v1/analyses", json=payload)
        assert crear(client).status_code == 202
        lleno = crear(client)
        assert lleno.status_code == 429 and int(lleno.headers["retry-after"]) > 0
        assert client.post("/api/v1/analyses", json=payload).json()["id"] == segundo.json()["id"]
        payload["configuration"] = {"tasa_descuento": 0.15}
        assert client.post("/api/v1/analyses", json=payload).status_code == 409
        fabrica.soltar.set()
        gestor.esperar_terminal(response.json()["id"], 3)


def test_recursos_validan_pertenencia_queries_expiracion_y_ausencia_de_listado():
    reloj = Reloj()
    with web(reloj=reloj) as (client, gestor, _):
        base = completar(client, gestor)
        for sufijo in [
            "/results?after=-1",
            "/results?limit=101",
            "/results?after=5",
            "/results?extra=x",
            "/companies/DEMO-USA/prices?period=1d",
            "/companies/DEMO-USA/financials?tasa_descuento=0.2",
            "/export.xlsx?tickers=AAPL",
        ]:
            assert client.get(base + sufijo).status_code == 400
        assert client.get(base + "/companies/AAPL/prices").status_code == 404
        assert client.get("/api/v1/analyses").status_code == 405
        reloj.t = 3601
        assert client.get(base).status_code == 410
        assert client.get(f"/api/v1/analyses/{uuid4()}").status_code == 404


def test_historicos_vacios_fallidos_o_ausentes_son_locales_y_reintentables():
    with web() as (client, gestor, fabrica):
        base = completar(client, gestor)
        anterior = client.get(base + "/results").content
        fabrica.error_historia = True
        error = client.get(base + "/companies/DEMO-USA/prices")
        assert error.status_code == 502
        assert "privado" not in error.text and error.json()["error"]["retryable"] is True
        fabrica.error_historia = False
        fabrica.historia = pd.DataFrame()
        vacio = client.get(base + "/companies/DEMO-USA/prices").json()
        assert vacio["availability"] == "empty" and vacio["items"] == []
        assert client.get(base + "/results").content == anterior


def test_error_excel_limpia_temporal_y_conserva_snapshot(monkeypatch, tmp_path):
    from valoracion.web import recursos

    def fallar(*args):
        raise PermissionError("/Users/privado/token")

    monkeypatch.setattr(recursos, "escribir_excel", fallar)
    monkeypatch.setattr(recursos.tempfile, "tempdir", str(tmp_path))
    with web() as (client, gestor, _):
        base = completar(client, gestor)
        antes = client.get(base + "/results").content
        response = client.get(base + "/export.xlsx")
        assert response.status_code == 500 and "privado" not in response.text
        assert list(tmp_path.iterdir()) == []
        assert client.get(base + "/results").content == antes


def test_cache_historica_no_refresca_fechas_y_claves_aislan_periodo_y_config():
    reloj = Reloj()
    with web(reloj=reloj) as (client, gestor, fabrica):
        base = completar(client, gestor)
        ruta = base + "/companies/DEMO-USA"
        original = client.get(ruta + "/prices?period=1y").json()
        reloj.t = 10
        assert client.get(ruta + "/prices?period=1y").json() == original | {"cache_hit": True}
        client.get(ruta + "/prices?period=2y")
        historico = client.get(ruta + "/financials").json()
        base2 = completar(client, gestor, configuration={"factor_margen_conservador": 0.5})
        assert client.get(base2 + "/companies/DEMO-USA/prices?period=1y").json() == original | {
            "cache_hit": True
        }
        assert client.get(base2 + "/companies/DEMO-USA/financials").status_code == 200
        assert len([llamada for llamada in fabrica.llamadas if llamada[0] == "financials"]) == 2
        reloj.t = 1801
        actualizado = client.get(ruta + "/prices?period=1y").json()
        assert (
            actualizado["cache_hit"] is False
            and actualizado["computed_at"] != original["computed_at"]
        )
        assert client.get(ruta + "/financials").json() == historico | {"cache_hit": True}
        assert len([llamada for llamada in fabrica.llamadas if llamada[0] == "prices"]) == 3


def test_via_ocupada_devuelve_503_y_demo_tiene_via_independiente():
    with web() as (client, gestor, _):
        base = completar(client, gestor)
        gestor._lanes["market"].acquire()
        try:
            assert client.get(base + "/companies/DEMO-USA/prices").status_code == 200
        finally:
            gestor._lanes["market"].release()
        gestor._lanes["demo"].acquire()
        try:
            # El cache hit no necesita el carril; otra consulta sí.
            assert client.get(base + "/companies/DEMO-USA/prices").status_code == 200
            ocupado = client.get(base + "/companies/DEMO-USA/prices?period=2y")
            assert ocupado.status_code == 503 and ocupado.headers["retry-after"] == "3"
            assert client.get("/healthz").status_code == 200
        finally:
            gestor._lanes["demo"].release()


def test_ausencias_historicas_son_null_fechas_ordenadas_e_infinity_no_se_publica():
    with web() as (client, gestor, fabrica):
        base = completar(client, gestor)
        fabrica.historia = pd.DataFrame(
            {"Fecha": pd.to_datetime(["2025-01-03", "2025-01-02"]), "Cierre": [float("nan"), 10]}
        )
        ruta = base + "/companies/DEMO-USA/prices"
        assert client.get(ruta).json()["items"] == [
            {"date": "2025-01-02", "value": 10},
            {"date": "2025-01-03", "value": None},
        ]
        fabrica.historia = pd.DataFrame(
            {"Fecha": pd.to_datetime(["2025-01-03"]), "Cierre": [float("inf")]}
        )
        assert client.get(ruta + "?period=2y").status_code == 502
        fabrica.historia = pd.DataFrame()
        assert client.get(ruta + "?period=2y").status_code == 200  # El error no quedó cacheado.


def test_readyz_requiere_lifespan_y_reinicio_pierde_referencias():
    app = create_app(Ajustes())
    sin_lifespan = TestClient(app)
    assert sin_lifespan.get("/healthz").status_code == 200
    assert sin_lifespan.get("/readyz").status_code == 503
    assert crear(sin_lifespan).status_code == 503
    with web() as (client, gestor, _):
        base = completar(client, gestor)
    with web() as (otro, _, _):
        assert otro.get(base).status_code == 404


def test_error_financiero_seguro_se_exporta_sin_perder_filas():
    from valoracion.web.aislamiento import ErrorProveedor

    fabrica = Recursos()
    fabrica.fallo = ErrorProveedor()
    with web(fabrica=fabrica) as (client, gestor, _):
        base = completar(client, gestor, tickers=["DEMO-USA", "DEMO-MX.MX"])
        assert client.get(base).json()["counts"]["ERROR"] == 2
        response = client.get(base + "/results")
        assert all(r["status"] == "ERROR" for r in response.json()["items"])
        assert "privado" not in response.text
        excel = client.get(base + "/export.xlsx")
        assert excel.status_code == 200
        libro = load_workbook(BytesIO(excel.content), data_only=True)
        resumen = list(libro["Resumen"].values)
        assert any("ERROR" in fila for fila in resumen)
        assert "privado" not in str(list(libro["Detalle"].values))


def test_cors_permite_creacion_solo_desde_origen_explicito():
    with web(Ajustes(origenes_cors=("https://intval.example",))) as (client, _, _):
        response = client.options(
            "/api/v1/analyses",
            headers={
                "Origin": "https://intval.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "https://intval.example"
        assert "access-control-allow-credentials" not in response.headers


def test_endpoint_con_procesos_reales_usa_demo_y_mantiene_paridad():
    ajustes = Ajustes()
    app = create_app(ajustes)
    with TestClient(app) as client:
        base = completar(
            client, app.state.gestor, tickers=["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"]
        )
        rows = client.get(base + "/results").json()["items"]
        assert [r["status"] for r in rows] == ["OK", "OK", "DATOS INCOMPLETOS"]
        assert rows[0]["median"]["value_per_share"] == pytest.approx(116.1879930510067)
        assert client.get(base + "/companies/DEMO-USA/financials").json()["items"][-1][
            "revenue"
        ] == pytest.approx(0.001)


def test_limite_tickers_se_aplica_despues_de_normalizar_sin_adquirir_rechazados():
    with web(Ajustes(max_tickers=1)) as (client, gestor, fabrica):
        assert crear(client, ["DEMO-USA", "DEMO-MX.MX"]).status_code == 422
        assert fabrica.llamadas == []
        base = completar(client, gestor, tickers=[" demo-usa ", "DEMO-USA"])
        assert client.get(base).json()["total"] == 1


def test_excel_conserva_tasa_y_numeros_de_analisis_anterior_a_otro_lote():
    with web() as (client, gestor, _):
        primero = completar(client, gestor)
        completar(client, gestor, configuration={"tasa_descuento": 0.2})
        response = client.get(primero + "/export.xlsx")
        assert response.status_code == 200
        libro = load_workbook(BytesIO(response.content), data_only=True)
        supuestos = {fila[0]: fila[1] for fila in libro["Supuestos"].values}
        assert supuestos["Tasa descuento accionista"] == 0.1
        filas = list(libro["Resumen"].values)
        resumen = dict(zip(filas[2], filas[3], strict=True))
        assert resumen["Mediana de proxies"] == pytest.approx(116.1879930510067)
        assert resumen["Proxy FCL por acción"] == pytest.approx(112.01930042013419)


def test_financieros_etiquetan_moneda_de_cotizacion_despues_de_convertir_fx():
    from tests.integration.test_servicio_inyectado import ProveedorMemoria

    datos = replace(
        ProveedorDemo().obtener_empresa("DEMO-USA"),
        moneda_financiera="MXN",
        moneda_cotizacion="USD",
        tipo_cambio=0.05,
    )
    proveedor = ProveedorMemoria(datos)
    fabrica = Recursos()

    def ejecutar(operacion, ticker, config):
        if operacion == "analysis":
            return servicio.analizar_empresa(ticker, config, proveedor=proveedor).como_registros()
        return servicio.obtener_historicos_financieros(ticker, config, proveedor=proveedor)

    fabrica.ejecutar = ejecutar
    with web(fabrica=fabrica) as (client, gestor, _):
        base = completar(client, gestor)
        response = client.get(base + "/companies/DEMO-USA/financials")
        assert response.status_code == 200
        historico = response.json()
        assert historico["currency"] == "USD"
        assert historico["items"][-1]["revenue"] == pytest.approx(0.00005)
