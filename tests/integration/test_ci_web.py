"""F6: CI comprueba ambos contratos y el navegador sin publicar servicios."""

import json
import re
from pathlib import Path

import yaml

RAIZ = Path(__file__).resolve().parents[2]


def test_ci_web_instala_lock_y_comprueba_tipos_y_api_real():
    workflow = yaml.safe_load((RAIZ / ".github/workflows/web.yml").read_text(encoding="utf-8"))
    assert workflow["permissions"] == {"contents": "read"}
    assert set(workflow["on"]) == {"push", "pull_request", "workflow_dispatch"}
    job = workflow["jobs"]["web"]
    pasos = job["steps"]
    preparar_python = next(
        paso for paso in pasos if paso.get("uses", "").startswith("actions/setup-python@")
    )
    # La caché automática invoca el script pip del host, no python -m pip.
    assert "cache" not in preparar_python["with"]
    assert job["runs-on"] == "ubuntu-24.04"
    for paso in pasos:
        assert not paso.get("continue-on-error", False)
        if "uses" in paso:
            assert re.fullmatch(r"[\w/-]+@[a-f0-9]{40}", paso["uses"])
    comandos = "\n".join(paso.get("run", "") for paso in pasos)
    manifest = json.loads((RAIZ / "frontend/package.json").read_text(encoding="utf-8"))
    version_playwright = manifest["devDependencies"]["@playwright/test"]
    assert job["container"]["image"] == (
        f"mcr.microsoft.com/playwright:v{version_playwright}-noble"
    )
    assert "--ipc=host" in job["container"]["options"]
    assert "playwright install" not in comandos
    assert "apt-get" not in comandos
    instalar_npm = f"npm install --global npm@{manifest['engines']['npm']}"
    assert instalar_npm in comandos
    assert comandos.index(instalar_npm) < comandos.index("npm ci")
    for comando in (
        "npm ci",
        "npm run lint",
        "npm run format:check",
        "npm run check",
        "npm run test:unit",
        "npm run build",
        "npm run test:shell",
        "npm run test:e2e",
        "python -m valoracion.web.contratos --check",
        "python -m examples.exportar_demo_web --check",
        "npm run types:generate",
        "git diff --exit-code",
        "accessSync(browser.executablePath(), constants.X_OK)",
        "[chromium, firefox, webkit]",
    ):
        assert comando in comandos
    assert "contracts/openapi.v1.json" in comandos
    assert "src/lib/generated/api.ts" in comandos
    assert "secrets." not in str(workflow)
    assert "deploy" not in comandos
    assert "|| true" not in comandos
