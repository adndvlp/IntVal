"""El lanzador de QA no acredita ejecuciones vacías, parciales o fallidas."""

from copy import deepcopy

import pytest

from qa_ui5 import (
    REQUIRED_PROJECTS,
    REQUIRED_UI5,
    browser_environment,
    combine_reports,
    validate_report,
)


def report():
    return {
        "stats": {"expected": 24, "unexpected": 0, "flaky": 0, "skipped": 0},
        "errors": [],
        "suites": [
            {
                "specs": [
                    {"title": title, "tests": [{"projectName": project, "status": "expected"}]}
                    for project in REQUIRED_PROJECTS
                    for title in ["recorrido", *REQUIRED_UI5]
                ]
            }
        ],
    }


def test_acepta_solo_ejecucion_completa_y_sin_fallos():
    assert validate_report(report()) == []


def test_reporte_html_nunca_abre_un_servidor_ni_modifica_el_entorno_del_usuario():
    original = {
        "PATH": "/usr/bin",
        "PLAYWRIGHT_HTML_OPEN": "on-failure",
        "PLAYWRIGHT_CHANNEL": "chrome",
    }
    env = browser_environment("/tmp/runtime/node", original)
    assert env["PLAYWRIGHT_HTML_OPEN"] == "never"
    assert "PLAYWRIGHT_CHANNEL" not in env
    assert original["PLAYWRIGHT_HTML_OPEN"] == "on-failure"


def test_combina_motores_sin_perder_fallos_de_una_etapa():
    first, second = report(), report()
    first["stats"]["unexpected"] = 1
    combined = combine_reports([first, second])
    assert combined["stats"]["expected"] == 48
    assert combined["stats"]["unexpected"] == 1
    assert len(combined["suites"]) == 2
    assert validate_report(combined)


@pytest.mark.parametrize(
    "change", ["empty", "failed", "flaky", "error", "missing_engine", "missing_ui5"]
)
def test_rechaza_falso_cierre(change):
    data = deepcopy(report())
    if change == "empty":
        data["stats"]["expected"] = 0
    elif change in {"failed", "flaky"}:
        data["stats"]["unexpected" if change == "failed" else "flaky"] = 1
    elif change == "error":
        data["errors"] = [{"message": "Servidor no disponible"}]
    elif change == "missing_engine":
        data["suites"][0]["specs"] = [
            s
            for s in data["suites"][0]["specs"]
            if not s["tests"][0]["projectName"].startswith("webkit")
        ]
    else:
        data["suites"][0]["specs"] = [
            s for s in data["suites"][0]["specs"] if not s["title"].startswith("UI5")
        ]
    assert validate_report(data)
