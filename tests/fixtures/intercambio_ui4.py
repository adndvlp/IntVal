"""Intercambios ASGI y libros reales efímeros para Python y Vitest; sin sockets."""

import json
import sys
from dataclasses import replace
from pathlib import Path
from uuid import uuid4

import pandas as pd

from frontend.scripts.export_contract import verificar_libro
from tests.api.test_operaciones_f8 import web
from tests.integration.test_metodologia import datos
from tests.integration.test_servicio_inyectado import ProveedorMemoria
from valoracion import servicio
from valoracion.modelos import TrazabilidadDatos
from valoracion.universo import FUENTES_UNIVERSO
from valoracion.web.aislamiento import ErrorProveedor
from valoracion.web.esquemas import ConfiguracionWeb

CUSTOM = {
    "tasa_descuento": 0.155,
    "tasa_descuento_empresa": 0.065,
    "factor_margen_conservador": 0.725,
    "factor_crecimiento_inicial": 0.405,
    "factor_crecimiento_final": 0.325,
    "multiplo_terminal_fcl": 13,
    "multiplo_terminal_ebit": 16,
    "multiplo_terminal_ebitda": 17,
    "multiplo_terminal_utilidad_neta": 18,
}


def capturar(client, gestor, request, directory, name):
    response = client.post("/api/v1/analyses", json=request)
    assert response.status_code == 202, response.text
    accepted = response.json()
    assert gestor.esperar_terminal(accepted["id"], 5)["state"] == "completed"
    base = accepted["links"]["status"]
    job = client.get(base).json()
    rows, after = [], 0
    while True:
        page = client.get(f"{base}/results?after={after}&limit=1").json()
        rows.extend(page["items"])
        after = page["next_cursor"]
        if page["done"] and after == page["processed"]:
            break
    snapshot = {"job": job, "rows": rows}
    xlsx = client.get(base + "/export.xlsx")
    assert xlsx.status_code == 200, xlsx.text
    filename = f"{name}.xlsx"
    (directory / filename).write_bytes(xlsx.content)
    verificar_libro(directory / filename, snapshot)
    prices, financials = {}, {}
    for row in rows:
        ticker = row["ticker"]
        if row["status"] == "ERROR":
            continue
        for resource, target in [("prices?period=1y", prices), ("financials", financials)]:
            response = client.get(f"{base}/companies/{ticker}/{resource}")
            assert response.status_code == 200, response.text
            target[ticker] = response.json()
    return {
        **snapshot,
        "request": request,
        "accepted": accepted,
        "page": client.get(base + "/results?after=0&limit=100").json(),
        "prices": prices,
        "financials": financials,
        "xlsx": filename,
        "download_headers": dict(xlsx.headers),
    }


class MercadoSintetico:
    """FX, datos parciales y fallos reales del motor; jamás llama a Yahoo."""

    def __init__(self):
        trace = TrazabilidadDatos(
            fuente="Proveedor sintético UI-4; no son cotizaciones reales",
            fecha_precio="2024-12-31",
            fuente_precio="Serie sintética UI-4",
            fuente_fx="FX sintético USD/MXN",
            fecha_fx="2024-12-31",
        )
        base = datos(
            ticker="FX.MX",
            precio=200,
            objetivo_analistas=250,
            moneda_financiera="USD",
            moneda_cotizacion="MXN",
            tipo_cambio=20,
            trazabilidad=trace,
        )
        partial = replace(
            base,
            ticker="PE&OLES.MX",
            precio=10000,
            balance=base.balance.drop(index="Total Debt"),
        )
        self.providers = {
            d.ticker: ProveedorMemoria(d)
            for d in [
                base,
                partial,
                replace(base, ticker="NODATA.MX", tipo_cambio=None),
            ]
        }
        for provider in self.providers.values():
            provider.precios = pd.DataFrame(
                {
                    "Fecha": pd.to_datetime(["2024-12-30", "2024-12-31"]),
                    "Cierre": [190.0, 200.0],
                }
            )

    def __call__(self, source, timeout):
        assert source == "market"
        return self

    def ejecutar(self, operation, ticker, argument):
        if ticker == "ERROR":
            raise ErrorProveedor()
        provider = self.providers[ticker]
        if operation == "analysis":
            return servicio.analizar_empresa(ticker, argument, proveedor=provider).como_registros()
        if operation == "prices":
            return servicio.obtener_precio_historico(ticker, argument, proveedor=provider)
        return servicio.obtener_historicos_financieros(ticker, argument, proveedor=provider)

    def cerrar(self):
        pass


def preparar(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    pack = {"cases": {}, "universe_sources": FUENTES_UNIVERSO}
    with web() as (client, gestor, _):
        pack["metadata"] = client.get("/api/v1/meta").json()
        pack["catalog"] = client.get("/api/v1/catalog?source=demo&market=all").json()
        pack["universe"] = client.get("/api/v1/catalog?source=market&market=all").json()["items"]
        for name, config in [
            ("default", ConfiguracionWeb().model_dump()),
            ("custom", CUSTOM),
            (
                "compatible",
                ConfiguracionWeb(
                    factor_crecimiento_inicial=0,
                    factor_crecimiento_final=0.075,
                    tasa_descuento=0.0575,
                    multiplo_terminal_utilidad_neta=35,
                ).model_dump(),
            ),
        ]:
            request = {
                "source": "demo",
                "client_request_id": str(uuid4()),
                "tickers": ["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"],
                "configuration": config,
            }
            pack["cases"][name] = capturar(client, gestor, request, directory, name)
    with web(fabrica=MercadoSintetico()) as (client, gestor, _):
        request = {
            "source": "market",
            "client_request_id": str(uuid4()),
            "tickers": ["FX.MX", "PE&OLES.MX", "NODATA.MX", "ERROR"],
            "configuration": ConfiguracionWeb().model_dump(),
        }
        pack["cases"]["market"] = capturar(client, gestor, request, directory, "market")
    (directory / "exchange.json").write_text(
        json.dumps(pack, ensure_ascii=False, allow_nan=False), encoding="utf-8"
    )
    return pack


if __name__ == "__main__":
    preparar(Path(sys.argv[1]))
