"""F11: arranque ASGI genérico, runtime preparado y señales sin procesos intermedios."""

import json
import os
import shutil
import signal
import subprocess
import sys
import time
import venv
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]


def preparar_servicio(tmp_path, codigo=0, *, esperar=False, legacy=False):
    proyecto = tmp_path / "checkout con espacios"
    proyecto.mkdir()
    nombre = "iniciar_streamlit.sh" if legacy else "iniciar_servicio.sh"
    script = proyecto / nombre
    shutil.copy2(RAIZ / nombre, script)
    (proyecto / "app.py").write_text("# Entrada del servicio\n", encoding="utf-8")
    entorno = tmp_path / "runtime-plataforma"
    venv.EnvBuilder(with_pip=False).create(entorno)
    paquete = (
        entorno
        / f"lib/python{sys.version_info.major}.{sys.version_info.minor}/site-packages"
        / ("streamlit" if legacy else "uvicorn")
    )
    paquete.mkdir(parents=True)
    (paquete / "__init__.py").write_text("", encoding="utf-8")
    (paquete / "__main__.py").write_text(
        "import json, os, pathlib, signal, sys, time\n"
        "def terminar(signum, frame):\n"
        "    pathlib.Path(os.environ['F4_REGISTRO'] + '.signal').write_text(str(signum))\n"
        "    sys.exit(0)\n"
        "signal.signal(signal.SIGTERM, terminar)\n"
        "pathlib.Path(os.environ['F4_REGISTRO']).write_text(\n"
        "    json.dumps({'argv': sys.argv[1:], 'cwd': os.getcwd(), 'pid': os.getpid()}), encoding='utf-8')\n"
        + ("while True: time.sleep(1)\n" if esperar else f"sys.exit({codigo})\n"),
        encoding="utf-8",
    )
    variables = {
        **os.environ,
        "PATH": str(entorno / "bin") + os.pathsep + os.environ["PATH"],
        "F4_REGISTRO": str(tmp_path / "arranque.json"),
        "WEB_CONCURRENCY": "8",
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
        "valoracion.web.distribucion:create_app",
        "--factory",
        "--host",
        "0.0.0.0",
        "--port",
        str(puerto),
        "--workers",
        "1",
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


@pytest.mark.parametrize("puerto", ["0", "65536", "-1", "abc", "80;false", "80\n80"])
def test_port_invalido_no_ejecuta_el_runtime(tmp_path, puerto):
    _, script, variables = preparar_servicio(tmp_path)
    variables["PORT"] = puerto
    result = subprocess.run(["bash", str(script)], env=variables, capture_output=True, text=True)
    assert result.returncode != 0
    assert "PORT" in result.stderr
    assert not (tmp_path / "arranque.json").exists()


def test_sigterm_llega_al_proceso_final_sin_shell_intermedio(tmp_path):
    _, script, variables = preparar_servicio(tmp_path, esperar=True)
    variables["PORT"] = "9137"
    proc = subprocess.Popen(
        ["bash", str(script)], env=variables, stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    registro = tmp_path / "arranque.json"
    try:
        deadline = time.monotonic() + 10
        while not registro.exists() and proc.poll() is None and time.monotonic() < deadline:
            time.sleep(0.01)
        assert registro.exists(), proc.communicate(timeout=2)
        assert json.loads(registro.read_text())["pid"] == proc.pid
        proc.send_signal(signal.SIGTERM)
        assert proc.wait(timeout=5) == 0
        assert Path(str(registro) + ".signal").read_text() == str(signal.SIGTERM)
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()


def test_lanzador_legacy_conserva_la_entrada_streamlit(tmp_path):
    proyecto, script, variables = preparar_servicio(tmp_path, legacy=True)
    variables["PORT"] = "9137"
    result = subprocess.run(["bash", str(script)], env=variables, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    registro = json.loads((tmp_path / "arranque.json").read_text())
    assert registro["argv"] == [
        "run",
        str(proyecto / "app.py"),
        "--server.address=0.0.0.0",
        "--server.port=9137",
        "--server.headless=true",
        "--server.fileWatcherType=none",
        "--browser.gatherUsageStats=false",
    ]
