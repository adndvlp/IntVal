"""Capacidad integrada con proveedor local y sin alterar el catálogo de demo."""

import pytest

from benchmarks.web_capacity import ProveedorSintetico, medir_capacidad


def test_observaciones_sinteticas_independientes_y_fuente_explicita():
    proveedor = ProveedorSintetico()
    primero = proveedor.obtener_empresa("SYN000")
    segundo = proveedor.obtener_empresa("SYN001")
    mx = proveedor.obtener_empresa("SYN500.MX")
    assert primero.ticker == "SYN000" and segundo.ticker == "SYN001"
    assert segundo.precio != primero.precio
    assert mx.moneda_cotizacion == "MXN"
    primero.resultados.iloc[0, 0] = -999
    assert segundo.resultados.iloc[0, 0] != -999
    assert "sintético" in segundo.trazabilidad.fuente.lower()


def test_medicion_reabre_excel_y_acredita_cola_cache_memoria_y_salud():
    informe = medir_capacidad(3, incluir_demo=False)
    assert informe["rows"] == informe["unique_tickers"] == 3
    assert informe["counts"]["OK"] == 3
    assert informe["queue_rejection_status"] == 429
    assert informe["idempotent_same_id"] is True
    assert informe["managed_payload_bytes"] <= informe["memory_budget_bytes"]
    assert informe["cache_entries"] <= 512
    assert informe["excel"]["sheets"] == 7 and informe["excel"]["data_rows"] == 3
    assert informe["first_median"] == pytest.approx(116.1879930510067)
    assert informe["parent_peak_rss_bytes"] > 0
    assert informe["child_peak_rss_bytes"] > 0
    assert len(informe["health_seconds"]) == 5
