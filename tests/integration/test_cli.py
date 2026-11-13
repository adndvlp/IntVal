"""CLI-01 a CLI-06: parser, motor y archivo real sin acceso al mercado."""

from contextlib import closing
import sys

import pytest
from openpyxl import load_workbook

import valoracion.cli as motor
from tests.fixtures.datos_sinteticos import TickerSintetico


@pytest.mark.parametrize("mercado, esperados", [("USA", ["TEST"]), ("MX", ["TEST.MX"]), ("TODOS", ["TEST", "TEST.MX"])])
def test_cli_seleccion_de_universo_y_ruta_con_espacios(monkeypatch, tmp_path, industrial, proveedor, config_simple, mercado, esperados):
    proveedor[0]["TEST.MX"] = TickerSintetico()
    monkeypatch.setattr(motor, "EMPRESAS_USA", ["TEST"])
    monkeypatch.setattr(motor, "EMPRESAS_MX", ["TEST.MX"])
    monkeypatch.setattr(motor, "EMPRESAS", ["TEST", "TEST.MX"])
    monkeypatch.setattr(motor, "CONFIG", config_simple)
    ruta = tmp_path / "con espacios" / "salida.xlsx"
    monkeypatch.setattr(sys, "argv", ["motor_valoracion.py", "--mercado", mercado, "--output", str(ruta)])
    motor.main()
    assert proveedor[1] == esperados
    with closing(load_workbook(ruta)) as libro:
        assert set(fila[1] for fila in libro["Resumen"].iter_rows(min_row=4, values_only=True)) == set(esperados)


def test_cli_tickers_repetidos_error_y_continuacion(monkeypatch, tmp_path, industrial, proveedor, config_simple, capsys):
    proveedor[0]["ERROR"] = RuntimeError("Fallo CLI")
    monkeypatch.setattr(motor, "CONFIG", config_simple)
    ruta = tmp_path / "mixto.xlsx"
    monkeypatch.setattr(sys, "argv", ["motor_valoracion.py", "--ticker", "ERROR", "--ticker", "TEST", "--ticker", "TEST", "--output", str(ruta)])
    motor.main()
    assert proveedor[1] == ["ERROR", "TEST"]
    salida = capsys.readouterr().out
    assert "ERROR: Fallo CLI" in salida
    assert "Archivo generado" in salida
    with closing(load_workbook(ruta)) as libro:
        filas = list(libro["Resumen"].iter_rows(min_row=4, values_only=True))
        assert {fila[1]: fila[17] for fila in filas} == {"ERROR": "ERROR", "TEST": "OK"}
        assert next(fila for fila in filas if fila[1] == "ERROR")[14] is None


def test_cli_todos_fallan_y_salida_predeterminada(monkeypatch, tmp_path, proveedor, config_simple):
    proveedor[0]["ERROR"] = RuntimeError("Fallo CLI")
    monkeypatch.setattr(motor, "CONFIG", config_simple)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(sys, "argv", ["motor_valoracion.py", "--ticker", "ERROR"])
    motor.main()
    with closing(load_workbook(tmp_path / "valoraciones_empresas.xlsx")) as libro:
        assert libro["Resumen"].cell(4, 18).value == "ERROR"


@pytest.mark.parametrize("argumentos, codigo", [(["--help"], 0), (["--mercado", "INVALIDO"], 2)])
def test_cli_ayuda_y_argumentos_invalidos_no_consultan(monkeypatch, proveedor, argumentos, codigo):
    monkeypatch.setattr(sys, "argv", ["motor_valoracion.py", *argumentos])
    with pytest.raises(SystemExit) as exc:
        motor.main()
    assert exc.value.code == codigo
    assert proveedor[1] == []
