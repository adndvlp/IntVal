"""UI-4: conciliación del libro real con el snapshot servido, sin puerto TCP."""

from copy import deepcopy
from io import BytesIO

import pytest
from openpyxl import load_workbook

from frontend.scripts.export_contract import verificar_libro
from tests.api.test_operaciones_f8 import completar, web
from tests.fixtures.intercambio_ui4 import CUSTOM, preparar


def snapshot(client, base):
    job = client.get(base).json()
    rows = []
    after = 0
    while True:
        page = client.get(f"{base}/results?after={after}&limit=1").json()
        rows.extend(page["items"])
        after = page["next_cursor"]
        if page["done"] and after == page["processed"]:
            break
    return {"job": job, "rows": rows}


@pytest.fixture
def intercambio(tmp_path):
    with web() as (client, gestor, factory):
        base = completar(client, gestor, tickers=["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"])
        data = snapshot(client, base)
        calls = list(factory.llamadas)
        file = tmp_path / "real.xlsx"
        file.write_bytes(client.get(base + "/export.xlsx").content)
        assert factory.llamadas == calls  # Exportar no vuelve a adquirir ni recalcular.
        yield file, data


def test_concilia_las_siete_hojas_los_24_campos_y_los_73_campos_de_auditoria(intercambio):
    file, data = intercambio
    verificar_libro(file, data)


@pytest.mark.parametrize(
    "change", ["median", "audit", "configuration", "missing", "extra", "currency", "source"]
)
def test_oraculo_rechaza_divergencias_aunque_el_archivo_siga_siendo_un_xlsx(intercambio, change):
    file, original = intercambio
    data = deepcopy(original)
    if change == "median":
        data["rows"][0]["median"]["value_per_share"] += 1
    elif change == "audit":
        data["rows"][0]["audit_fields"][8]["value"] = 99999
    elif change == "configuration":
        data["job"]["configuration"]["tasa_descuento"] = 0.15
    elif change == "missing":
        data["rows"].pop()
    elif change == "extra":
        data["rows"].append(deepcopy(data["rows"][0]))
    elif change == "currency":
        data["rows"][0]["currency"] = "MXN"
    else:
        data["rows"][0]["traceability"]["source"] = "Otra fuente"
    with pytest.raises(AssertionError):
        verificar_libro(file, data)


def test_oraculo_rechaza_celda_alterada_en_excel_y_modelo_ausente_convertido_en_cero(intercambio):
    file, data = intercambio
    with file.open("rb") as stream:
        book = load_workbook(BytesIO(stream.read()))
    sheet = book["Resumen"]
    headers = [c.value for c in sheet[3]]
    for cells in sheet.iter_rows(min_row=4):
        if cells[headers.index("Ticker")].value == "DEMO-INCOMPLETA":
            cells[headers.index("Mediana de proxies")].value = 0
    book.save(file)
    book.close()
    with pytest.raises(AssertionError):
        verificar_libro(file, data)


@pytest.fixture(scope="module")
def cases(tmp_path_factory):
    folder = tmp_path_factory.mktemp("ui4-paridad")
    return folder, preparar(folder)


@pytest.mark.parametrize("name", ["default", "custom", "compatible", "market"])
def test_todos_los_datos_del_motor_sobreviven_api_y_excel_con_ajustes_y_monedas(cases, name):
    folder, pack = cases
    case = pack["cases"][name]
    result = verificar_libro(
        folder / case["xlsx"],
        {**case, "universe": pack["universe"], "universe_sources": pack["universe_sources"]},
    )
    assert result == {
        "sheets": 7,
        "companies": len(case["request"]["tickers"]),
        "summary_fields": 24,
        "audit_fields": 73,
    }


def test_nueve_ajustes_confirmados_recalculan_el_motor_sin_mutar_el_anterior(cases):
    folder, pack = cases
    original, custom = pack["cases"]["default"], pack["cases"]["custom"]
    for key, value in CUSTOM.items():
        assert custom["job"]["configuration"][key] == value
        assert original["job"]["configuration"][key] != value
    assert (
        custom["rows"][0]["median"]["value_per_share"]
        != original["rows"][0]["median"]["value_per_share"]
    )
    assert original["rows"][0]["median"]["value_per_share"] == pytest.approx(116.1879930510067)
    # La descarga del análisis original se concilia tras ejecutar el nuevo.
    verificar_libro(folder / original["xlsx"], original)


def test_fx_millones_ratios_exclusiones_y_fallos_no_se_confunden_con_ceros(cases):
    _, pack = cases
    case = pack["cases"]["market"]
    rows = {r["ticker"]: r for r in case["rows"]}
    converted = rows["FX.MX"]
    assert converted["currency"] == "MXN"
    assert converted["traceability"]["reporting_currency"] == "USD"
    assert converted["traceability"]["fx_rate"] == 20
    assert converted["market_price"] == 200
    financials = case["financials"]["FX.MX"]
    assert financials["currency"] == "MXN" and financials["unit"] == "millions"
    assert financials["items"][-1]["revenue"] == pytest.approx(1000 * 20 / 1_000_000)
    assert financials["margins"]["items"][-1]["fcl"] == pytest.approx(130 / 1000)
    partial = rows["PE&OLES.MX"]
    assert partial["median"]["count"] == 2
    assert partial["median"]["upside"] < 0
    assert {p["id"] for p in partial["proxies"] if not p["included"]} == {
        "nopat",
        "ebitda_adjusted",
    }
    assert all(p["exclusion_reason"] for p in partial["proxies"] if not p["included"])
    assert rows["NODATA.MX"]["median"]["value_per_share"] is None
    assert rows["NODATA.MX"]["market_price"] == 200
    assert rows["ERROR"]["status"] == "ERROR"
    assert rows["ERROR"]["market_price"] is None
