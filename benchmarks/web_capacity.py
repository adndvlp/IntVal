"""Medición reproducible de ASGI, dominio, procesos y Excel; nunca usa Yahoo.

Ejecutar en un proceso nuevo para interpretar los máximos RSS correctamente.
La fuente HTTP market sólo enruta al proveedor sintético inyectado aquí.
"""

import argparse
import json
import os
import platform
import resource
import time
from dataclasses import replace
from functools import partial
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from valoracion.proveedores.demo import ProveedorDemo
from valoracion.web.aislamiento import EjecutorAislado, crear_proveedor
from valoracion.web.ajustes import Ajustes
from valoracion.web.aplicacion import create_app
from valoracion.web.trabajos import GestorTrabajos


class ProveedorSintetico:
    def __init__(self):
        base = ProveedorDemo()
        self.usa = base.obtener_empresa("DEMO-USA")
        self.mx = base.obtener_empresa("DEMO-MX.MX")

    def obtener_empresa(self, ticker):
        indice = int(ticker.removeprefix("SYN").removesuffix(".MX"))
        base = self.mx if ticker.endswith(".MX") else self.usa
        return replace(
            base,
            ticker=ticker,
            info={**base.info, "shortName": f"Empresa sintética {ticker}"},
            precio=base.precio * (1 + indice / 10000),
            trazabilidad=replace(base.trazabilidad, fuente="Proveedor sintético de capacidad F10"),
        )


def fabrica_sintetica(source):
    return ProveedorSintetico() if source == "market" else crear_proveedor("demo")


def _rss(who):
    value = resource.getrusage(who).ru_maxrss
    return int(value if platform.system() == "Darwin" else value * 1024)


def medir_capacidad(cantidad=604, *, incluir_demo=True):
    if not 3 <= cantidad <= 650:
        raise ValueError("La medición requiere entre 3 y 650 símbolos sintéticos.")
    ajustes = Ajustes()
    gestor = GestorTrabajos(
        ajustes, ejecutor_factory=partial(EjecutorAislado, fabrica=fabrica_sintetica)
    )
    simbolos = [f"SYN{i:03d}" + (".MX" if i >= 500 else "") for i in range(cantidad)]
    pedido = {"client_request_id": str(uuid4()), "source": "market", "tickers": simbolos}
    parent_before = _rss(resource.RUSAGE_SELF)
    with TestClient(create_app(ajustes, gestor=gestor)) as client:
        start = time.perf_counter()
        response = client.post("/api/v1/analyses", json=pedido)
        assert response.status_code == 202, response.text
        identifier = response.json()["id"]
        base = f"/api/v1/analyses/{identifier}"
        # Barrera de publicación real; no sustituye el reloj o la pausa de producción.
        with gestor._condicion:
            assert gestor._condicion.wait_for(lambda: gestor._jobs[identifier].rows, timeout=15)
        partial_rows = client.get(base + "/results?limit=1").json()
        assert partial_rows["next_cursor"] == 1
        # Dos solicitudes adicionales deben permanecer en cola mientras trabaja el lote.
        pending = []
        for _ in range(2):
            queued = client.post(
                "/api/v1/analyses", json={**pedido, "client_request_id": str(uuid4())}
            )
            assert queued.status_code == 202, queued.text
            pending.append(queued.json()["id"])
        rejected = client.post(
            "/api/v1/analyses", json={**pedido, "client_request_id": str(uuid4())}
        )
        assert rejected.status_code == 429
        same = client.post("/api/v1/analyses", json=pedido)
        assert same.status_code == 202 and same.json()["id"] == identifier
        health = []
        for _ in range(5):
            now = time.perf_counter()
            assert client.get("/healthz").status_code == 200
            health.append(time.perf_counter() - now)
        for queued in pending:
            assert client.post(f"/api/v1/analyses/{queued}/cancel").json()["state"] == "cancelled"
        finished = gestor.esperar_terminal(identifier, 240)
        duration = time.perf_counter() - start
        assert finished["state"] == "completed", finished
        rows, cursor = [], 0
        while cursor < cantidad:
            result = client.get(f"{base}/results?after={cursor}&limit=100")
            assert result.status_code == 200
            page = result.json()
            assert page["next_cursor"] > cursor
            cursor = page["next_cursor"]
            rows.extend(page["items"])
        assert [row["ticker"] for row in rows] == simbolos
        assert all(row["status"] == "OK" for row in rows)
        memory = sum(j.bytes for j in gestor._jobs.values()) + sum(
            v[1] for v in gestor._cache.values()
        )
        assert memory <= ajustes.memory_budget_bytes and len(gestor._cache) <= 512
        export_start = time.perf_counter()
        export = client.get(base + "/export.xlsx")
        assert export.status_code == 200
        export_seconds = time.perf_counter() - export_start
        book = load_workbook(BytesIO(export.content), read_only=True, data_only=True)
        data_rows = sum(
            row[1] is not None for row in book["Resumen"].iter_rows(min_row=4, values_only=True)
        )
        assert len(book.sheetnames) == 7 and data_rows == cantidad
        excel = {
            "sheets": len(book.sheetnames),
            "data_rows": data_rows,
            "bytes": len(export.content),
            "seconds": export_seconds,
        }
        book.close()
        demo = []
        if incluir_demo:
            for run in range(3):
                now = time.perf_counter()
                response = client.post(
                    "/api/v1/analyses",
                    json={
                        "client_request_id": str(uuid4()),
                        "source": "demo",
                        "tickers": ["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"],
                    },
                )
                assert response.status_code == 202
                terminal = gestor.esperar_terminal(response.json()["id"], 15)
                assert terminal["state"] == "completed"
                demo.append(
                    {"cache": "cold" if run == 0 else "warm", "seconds": time.perf_counter() - now}
                )
        return {
            "schema": "intval-capacity-1",
            "environment": {
                "python": platform.python_version(),
                "os": platform.system(),
                "release": platform.release(),
                "machine": platform.machine(),
                "logical_cpus": os.cpu_count(),
            },
            "method": "TestClient ASGI sin TCP; dominio y procesos spawn reales; proveedor sintético por símbolo, pausas market de 0.15 s conservadas; no mide Yahoo ni capacidad de un PaaS.",
            "rows": len(rows),
            "unique_tickers": len({r["ticker"] for r in rows}),
            "counts": finished["counts"],
            "seconds": duration,
            "queue_rejection_status": rejected.status_code,
            "idempotent_same_id": same.json()["id"] == identifier,
            "health_seconds": health,
            "memory_budget_bytes": ajustes.memory_budget_bytes,
            "managed_payload_bytes": memory,
            "cache_entries": len(gestor._cache),
            "parent_peak_before_bytes": parent_before,
            "parent_peak_rss_bytes": _rss(resource.RUSAGE_SELF),
            "child_peak_rss_bytes": _rss(resource.RUSAGE_CHILDREN),
            "rss_method": "ru_maxrss: máximo del padre y máximo de un hijo recolectado, por separado; no se suman ni se presentan como pico simultáneo del árbol.",
            "first_median": rows[0]["median"]["value_per_share"],
            "excel": excel,
            "demo_runs": demo,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=604)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = medir_capacidad(args.count)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"{report['rows']} símbolos sintéticos; {report['seconds']:.2f} s; {report['managed_payload_bytes']} bytes administrados; Excel reabierto."
    )


if __name__ == "__main__":
    main()
