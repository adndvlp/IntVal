"""Contrato de automatización: suite obligatoria en PR/push, sin publicar."""

import re
from pathlib import Path

import yaml


def test_ci_ejecuta_suite_y_reportes_sin_desplegar():
    flujo = yaml.safe_load(Path(".github/workflows/tests.yml").read_text(encoding="utf-8"))
    assert set(flujo["on"]) == {"push", "pull_request", "workflow_dispatch"}
    assert flujo["permissions"] == {"contents": "read"}
    assert len(flujo["jobs"]) == 1
    trabajo = next(iter(flujo["jobs"].values()))
    assert trabajo["runs-on"] == "ubuntu-latest"
    assert "strategy" not in trabajo
    assert trabajo["timeout-minutes"] <= 10
    pasos = trabajo["steps"]
    comandos = [paso["run"] for paso in pasos if "run" in paso]
    assert "python -m pip install --no-deps -r requirements-dev.txt" in comandos
    assert "python -m pip check" in comandos
    assert "python -m ruff check ." in comandos
    assert "python -m ruff format --check ." in comandos
    assert "python -m pytest" in comandos
    assert any("python -m venv .venv" in comando for comando in comandos)
    assert not any(paso.get("continue-on-error") for paso in pasos)
    acciones = [paso for paso in pasos if "uses" in paso]
    assert all(re.fullmatch(r"actions/[\w-]+@[0-9a-f]{40}", paso["uses"]) for paso in acciones)
    python = next(paso for paso in acciones if paso["uses"].startswith("actions/setup-python@"))
    assert python["with"]["python-version-file"] == ".python-version"
    reporte = next(paso for paso in acciones if paso["uses"].startswith("actions/upload-artifact@"))
    assert reporte["if"] == "always()"
    assert "linux" in reporte["with"]["name"]
    assert {"coverage.xml", "test-results.xml"} <= set(reporte["with"]["path"].splitlines())
    assert "secrets." not in Path(".github/workflows/tests.yml").read_text(encoding="utf-8")
