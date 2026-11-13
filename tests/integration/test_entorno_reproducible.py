"""F4: una sola configuración y dependencias de ejecución/desarrollo compatibles."""

import subprocess
import tomllib
from importlib import metadata
from pathlib import Path

import pytest
from packaging.markers import default_environment
from packaging.requirements import Requirement
from packaging.utils import canonicalize_name

RAIZ = Path(__file__).resolve().parents[2]


def test_git_preserva_finales_de_linea_para_formato_y_lanzadores():
    resultado = subprocess.run(
        ["git", "check-attr", "eol", "--", "app.py", "iniciar_servicio.sh"],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        check=True,
    )
    assert resultado.stdout.splitlines() == [
        "app.py: eol: lf",
        "iniciar_servicio.sh: eol: lf",
    ]


def leer_resolucion(nombre):
    dependencias = {}
    for linea in (RAIZ / nombre).read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        if linea.startswith("-r "):
            dependencias.update(leer_resolucion(linea[3:].strip()))
            continue
        requisito = Requirement(linea)
        assert not requisito.url, linea
        especificadores = list(requisito.specifier)
        assert len(especificadores) == 1 and especificadores[0].operator == "==", linea
        assert "*" not in especificadores[0].version, linea
        dependencias[canonicalize_name(requisito.name)] = requisito
    return dependencias


@pytest.mark.parametrize("archivo", ["requirements.txt", "requirements-dev.txt"])
def test_resoluciones_fijan_todas_las_versiones(archivo):
    assert leer_resolucion(archivo)


def test_desarrollo_respeta_ejecucion_y_sus_entradas():
    ejecucion = leer_resolucion("requirements.txt")
    desarrollo = leer_resolucion("requirements-dev.txt")
    for nombre, requisito in ejecucion.items():
        assert str(desarrollo[nombre]) == str(requisito)
    entrada = (RAIZ / "requirements-dev.in").read_text(encoding="utf-8")
    assert "-c requirements.txt" in entrada
    assert "-r requirements.in" in entrada
    assert {"pytest", "pytest-cov", "coverage", "ruff", "pyyaml"} <= desarrollo.keys()


def test_entorno_instalado_corresponde_a_la_resolucion_de_desarrollo():
    for nombre, requisito in leer_resolucion("requirements-dev.txt").items():
        if requisito.marker and not requisito.marker.evaluate():
            continue
        assert metadata.version(nombre) in requisito.specifier, nombre


def test_dependencias_condicionales_de_linux_tambien_estan_fijadas():
    plataforma, sistema = "linux", "Linux"
    resolucion = leer_resolucion("requirements-dev.txt")
    ambiente = {
        **default_environment(),
        "sys_platform": plataforma,
        "platform_system": sistema,
        "extra": "",
    }
    for nombre, requisito in resolucion.items():
        if requisito.marker and not requisito.marker.evaluate(ambiente):
            continue
        try:
            distribucion = metadata.distribution(nombre)
        except metadata.PackageNotFoundError:
            # Se valida la presencia de sus pines en la plataforma correspondiente;
            # pip check y las instalaciones de CI comprueban los paquetes instalados.
            assert nombre == "watchdog"
            continue
        for texto in distribucion.requires or []:
            dependencia = Requirement(texto)
            if dependencia.marker and not dependencia.marker.evaluate(ambiente):
                continue
            clave = canonicalize_name(dependencia.name)
            assert clave in resolucion, (nombre, texto, plataforma)
            version = next(iter(resolucion[clave].specifier)).version
            assert version in dependencia.specifier, (nombre, texto, version)


def test_configuracion_unica_preserva_cobertura_y_version_python():
    config = tomllib.loads((RAIZ / "pyproject.toml").read_text(encoding="utf-8"))
    assert not (RAIZ / "pytest.ini").exists()
    assert not (RAIZ / ".coveragerc").exists()
    opciones = config["tool"]["pytest"]["ini_options"]
    for argumento in ["--cov=app", "--cov=motor_valoracion", "--cov=valoracion", "--cov-branch"]:
        assert argumento in opciones["addopts"]
    cobertura = config["tool"]["coverage"]
    assert cobertura["run"]["branch"] is True
    assert set(cobertura["run"]["source"]) == {"app", "motor_valoracion", "valoracion"}
    assert cobertura["report"]["fail_under"] == 85
    assert (RAIZ / ".python-version").read_text().strip() == "3.12"
    ruff = config["tool"]["ruff"]
    assert ruff["target-version"] == "py312"
    assert {"E4", "E7", "E9", "F", "I"} <= set(ruff["lint"]["select"])
