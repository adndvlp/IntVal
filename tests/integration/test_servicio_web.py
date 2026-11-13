"""F4: arranque de un servicio web independiente del proveedor de alojamiento."""

import json
import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]


def preparar_servicio(tmp_path, codigo=0):
    proyecto = tmp_path / "checkout con espacios"
    proyecto.mkdir()
    script = proyecto / "iniciar_servicio.sh"
    shutil.copy2(RAIZ / "iniciar_servicio.sh", script)
    (proyecto / "app.py").write_text("# Entrada del servicio\n", encoding="utf-8")
    entorno = tmp_path / "runtime-plataforma"
    venv.EnvBuilder(with_pip=False).create(entorno)
    paquete = (
        entorno
        / f"lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages/streamlit"
    )
    paquete.mkdir(parents=True)
    (paquete / "__init__.py").write_text("", encoding="utf-8")
    (paquete / "__main__.py").write_text(
        "import json, os, pathlib, sys\n"
        "pathlib.Path(os.environ['F4_REGISTRO']).write_text(\n"
        "    json.dumps({'argv': sys.argv[1:], 'cwd': os.getcwd()}), encoding='utf-8')\n"
        f"sys.exit({codigo})\n",
        encoding="utf-8",
    )
    variables = {
        **os.environ,
        "PATH": str(entorno / "bin") + os.pathsep + os.environ["PATH"],
        "F4_REGISTRO": str(tmp_path / "arranque.json"),
    }
    variables.pop("PORT", None)
    return proyecto, script, variables


@pytest.mark.parametrize("puerto, codigo", [(10000, 0), (9137, 0), (10000, 7)])
def test_servicio_usa_runtime_y_puerto_del_entorno_sin_crear_entornos(tmp_path, puerto, codigo):
    proyecto, script, variables = preparar_servicio(tmp_path, codigo)
    variables["PORT"] = str(puerto)
    resultado = subprocess.run(
        ["bash", str(script)],
        cwd=tmp_path,
        env=variables,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert resultado.returncode == codigo, resultado.stdout + resultado.stderr
    registro = json.loads((tmp_path / "arranque.json").read_text(encoding="utf-8"))
    assert Path(registro["cwd"]).resolve() == proyecto.resolve()
    assert registro["argv"] == [
        "run",
        str(proyecto / "app.py"),
        "--server.address=0.0.0.0",
        f"--server.port={puerto}",
        "--server.headless=true",
        "--server.fileWatcherType=none",
        "--browser.gatherUsageStats=false",
    ]
    assert not (proyecto / ".venv").exists()


def test_servicio_sin_port_informa_error_generico_y_no_arranca(tmp_path):
    _, script, variables = preparar_servicio(tmp_path)
    resultado = subprocess.run(
        ["bash", str(script)],
        cwd=tmp_path,
        env=variables,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert resultado.returncode != 0
    assert "Debe definir PORT para el servicio web" in resultado.stderr
    assert not (tmp_path / "arranque.json").exists()
