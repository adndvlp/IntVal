"""C-11 a C-18: oráculos de la SDD y validación anterior al cálculo."""

import math

import pytest

import valoracion.calculos as motor


@pytest.mark.parametrize(
    "argumentos, esperado",
    [
        ((100, 0, 0, 0, 3, 2), (500, 300, 200)),
        ((100, 0.1, 0.05, 0.1, 2, 10), (1200, 200, 1000)),
        ((100, 0.1, 0, 0, 6, 2), (1154.714, 832.612, 322.102)),
    ],
)
def test_proyecciones_con_esperados_independientes(argumentos, esperado):
    assert motor.proyectar_valor(*argumentos) == pytest.approx(esperado, rel=1e-9, abs=1e-9)


@pytest.mark.parametrize(
    "base, descuento", [(None, 0.1), (0, 0.1), (-1, 0.1), (100, -1), (100, -2)]
)
def test_proyeccion_no_calculable(base, descuento):
    assert motor.proyectar_valor(base, 0, 0, descuento, 3, 2) == (None, None, None)


@pytest.mark.parametrize(
    "total, acciones, esperado",
    [
        (1000, 10, 100),
        (None, 10, None),
        (100, None, None),
        (100, 0, None),
        (100, -1, None),
        (-100, 10, None),
        (math.inf, 10, None),
    ],
)
def test_por_accion(total, acciones, esperado):
    assert motor.por_accion(total, acciones) == esperado


@pytest.mark.parametrize(
    "valor, precio, esperado",
    [
        (120, 100, 0.2),
        (80, 100, -0.2),
        (0, 100, -1),
        (None, 100, None),
        (100, None, None),
        (100, 0, None),
        (100, -1, None),
    ],
)
def test_rendimiento(valor, precio, esperado):
    resultado = motor.rendimiento(valor, precio)
    assert resultado == (pytest.approx(esperado) if esperado is not None else None)


@pytest.mark.parametrize(
    "info, esperado",
    [
        ({"sector": "Financial Services"}, True),
        ({"industry": "Banks"}, True),
        ({"sector": "Industrials"}, False),
        ({}, False),
    ],
)
def test_clasificacion_financiera(info, esperado):
    assert motor.es_financiera(info) is esperado


@pytest.mark.parametrize(
    "cambios",
    [
        {"anos_proyeccion": 0},
        {"anos_proyeccion": -1},
        {"anos_proyeccion": 2.5},
        {"max_anos_historicos": 0},
        {"tasa_descuento": -1},
        {"tasa_descuento": math.nan},
        {"factor_crecimiento_inicial": -0.1},
        {"factor_crecimiento_final": math.inf},
        {"factor_margen_conservador": 1.1},
        {"multiplo_terminal_fcl": 0},
        {"multiplo_terminal_ebit": -1},
        {"multiplo_terminal_ebitda": math.inf},
        {"multiplo_terminal_utilidad_neta": math.nan},
        {"pausa_entre_tickers": -1},
        {"crecimiento_minimo": 0.2, "crecimiento_maximo": 0.1},
        {"tasa_impuestos_minima": 0.4, "tasa_impuestos_maxima": 0.2},
        {"tasa_impuestos_fallback": 1.1},
        {"crecimiento_fallback": math.inf},
    ],
)
def test_configuracion_invalida_se_rechaza_antes_de_consultar(cambios):
    with pytest.raises(ValueError):
        motor.Configuracion(**cambios)


@pytest.mark.parametrize("posicion", [0, 1, 2, 3, 5])
@pytest.mark.parametrize("invalido", [math.nan, math.inf, -math.inf])
def test_proyeccion_no_propaga_parametros_no_finitos(posicion, invalido):
    argumentos = [100, 0.1, 0.05, 0.1, 3, 2]
    argumentos[posicion] = invalido
    assert motor.proyectar_valor(*argumentos) == (None, None, None)


@pytest.mark.parametrize("anos", [0, -1, 2.5])
def test_horizonte_invalido_tiene_error_explicito(anos):
    with pytest.raises(ValueError, match="[Aa]ños|horizonte"):
        motor.proyectar_valor(100, 0.1, 0, 0.1, anos, 2)


def test_desbordamiento_no_produce_valoracion_infinita():
    assert motor.proyectar_valor(1e308, 1000, 0, 0.1, 3, 2) == (None, None, None)


@pytest.mark.parametrize(
    "valor, precio", [(math.inf, 100), (math.nan, 100), (100, math.inf), (100, math.nan)]
)
def test_rendimiento_no_finito_es_ausente(valor, precio):
    assert motor.rendimiento(valor, precio) is None
