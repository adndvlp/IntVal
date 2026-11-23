"""F6: CI comprueba ambos contratos y el navegador sin publicar servicios."""

import json
import os
import re
import subprocess
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
        "diff --exit-code HEAD --",
        "accessSync(browser.executablePath(), constants.X_OK)",
        "[chromium, firefox, webkit]",
    ):
        assert comando in comandos
    assert "contracts/openapi.v1.json" in comandos
    assert "src/lib/generated/api.ts" in comandos
    assert "secrets." not in str(workflow)
    assert "deploy" not in comandos
    assert "|| true" not in comandos


def test_ci_web_detecta_drift_sin_comparar_json_con_typescript(tmp_path):
    raiz = tmp_path.resolve()
    entorno = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    entorno.update(GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM="1")

    def git(*argumentos):
        subprocess.run(["git", *argumentos], cwd=raiz, env=entorno, check=True, capture_output=True)

    archivos = ["contracts/openapi.v1.json", "frontend/src/lib/generated/api.ts"]
    contenidos = ['{"openapi": "3.1.0"}\n', "export interface paths {}\n"]
    git("init", "--quiet")
    for nombre, contenido in zip(archivos, contenidos, strict=True):
        destino = raiz / nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(contenido)
    git("add", "--", *archivos)
    git("-c", "user.name=Prueba", "-c", "user.email=test@example.invalid", "commit", "-qm", "base")

    # Fuerza la guarda de propietario de Git sin sudo ni cambios de permisos.
    entorno.update(GIT_TEST_ASSUME_DIFFERENT_OWNER="1", GITHUB_WORKSPACE=str(raiz))
    workflow = yaml.safe_load((RAIZ / ".github/workflows/web.yml").read_text())
    paso = next(
        p
        for p in workflow["jobs"]["web"]["steps"]
        if p["name"] == "Comprobar OpenAPI y tipos generados"
    )
    comandos = "\n".join(linea for linea in paso["run"].splitlines() if linea.startswith("git "))

    def comprobar():
        return subprocess.run(
            ["bash", "-e", "-o", "pipefail", "-c", comandos],
            cwd=raiz,
            env=entorno,
            capture_output=True,
            text=True,
        )

    limpio = comprobar()
    assert limpio.returncode == 0, limpio.stdout + limpio.stderr
    for nombre, contenido in zip(archivos, contenidos, strict=True):
        (raiz / nombre).write_text(contenido + "cambio no versionado\n")
        cambiado = comprobar()
        assert cambiado.returncode == 1
        assert f"--- a/{nombre}" in cambiado.stdout
        assert f"+++ b/{nombre}" in cambiado.stdout
        (raiz / nombre).write_text(contenido)
