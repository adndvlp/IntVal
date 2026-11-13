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
    assert job["runs-on"] == "ubuntu-latest"
    pasos = job["steps"]
    for paso in pasos:
        assert not paso.get("continue-on-error", False)
        if "uses" in paso:
            assert re.fullmatch(r"[\w/-]+@[a-f0-9]{40}", paso["uses"])
    comandos = "\n".join(paso.get("run", "") for paso in pasos)
    manifest = json.loads((RAIZ / "frontend/package.json").read_text(encoding="utf-8"))
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
        "npm run types:generate",
        "git diff --exit-code",
        "playwright install --with-deps chromium",
    ):
        assert comando in comandos
    assert "contracts/openapi.v1.json" in comandos
    assert "src/lib/generated/api.ts" in comandos
    assert "secrets." not in str(workflow)
    assert "deploy" not in comandos
    assert "|| true" not in comandos
