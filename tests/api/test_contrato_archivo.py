"""El contrato publicado es exactamente el que sirve la API de lectura."""

import json
import subprocess
import sys
from pathlib import Path

from valoracion.web.aplicacion import create_app
from valoracion.web.contratos import contenido_openapi

RAIZ = Path(__file__).resolve().parents[2]


def test_contrato_versionado_coincide_con_api_y_no_depende_de_variables(monkeypatch):
    contrato = RAIZ / "contracts/openapi.v1.json"
    assert contrato.read_text(encoding="utf-8") == contenido_openapi()
    monkeypatch.setenv("VALORACION_MARKET_ENABLED", "0")
    monkeypatch.setenv("VALORACION_MAX_TICKERS", "12")
    assert json.loads(contrato.read_text(encoding="utf-8")) == create_app().openapi()


def test_verificador_cli_detecta_contrato_ausente_y_desactualizado(tmp_path):
    destino = tmp_path / "contrato.json"
    comando = [sys.executable, "-m", "valoracion.web.contratos", "--output", str(destino)]
    ausente = subprocess.run([*comando, "--check"], cwd=RAIZ, capture_output=True, text=True)
    assert ausente.returncode == 1
    assert subprocess.run(comando, cwd=RAIZ, capture_output=True).returncode == 0
    assert subprocess.run([*comando, "--check"], cwd=RAIZ, capture_output=True).returncode == 0
    destino.write_text("{}\n", encoding="utf-8")
    assert subprocess.run([*comando, "--check"], cwd=RAIZ, capture_output=True).returncode == 1
