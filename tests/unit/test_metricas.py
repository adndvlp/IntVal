"""C-01 a C-10: esperados numéricos independientes y límites."""

from dataclasses import replace

import pandas as pd
import pytest

import motor_valoracion as motor


def test_cagr_conocido():
    valores = pd.Series([100, 146.41], index=pd.to_datetime(["2020-01-01", "2024-01-01"]))
    assert motor.calcular_cagr(valores) == pytest.approx(0.1)


@pytest.mark.parametrize("valores", [pd.Series(dtype=float), pd.Series([0, -1]), pd.Series([100]), pd.Series([1, 2], index=["2024-01-01", "2024-01-01"])])
def test_cagr_sin_datos_suficientes(valores):
    assert motor.calcular_cagr(valores) is None


def test_cagr_descarta_no_positivos_y_caracteriza_fechas_no_interpretables():
    assert motor.calcular_cagr(pd.Series([100, -10, 121], index=["a", "b", "c"])) == pytest.approx(0.21)


def test_impuestos_mediana_ventana_limites_y_fallback():
    config = motor.Configuracion()
    assert motor.estimar_tasa_impuestos(pd.Series([20, 25]), pd.Series([100, 100]), config) == pytest.approx(0.225)
    assert motor.estimar_tasa_impuestos(pd.Series([37]), pd.Series([100]), config) == 0.35
    assert motor.estimar_tasa_impuestos(pd.Series([20, 90]), pd.Series([100, 100]), config) == 0.2
    assert motor.estimar_tasa_impuestos(pd.Series([20]), pd.Series([-100]), config) == 0.21
    assert motor.estimar_tasa_impuestos(pd.Series(dtype=float), pd.Series(dtype=float), config) == 0.21
    assert motor.estimar_tasa_impuestos(pd.Series([10, 20, 30]), pd.Series([100]*3), replace(config, max_anos_historicos=1)) == 0.3


@pytest.mark.parametrize("signo", [-1, 1])
def test_fcl_cfo_menos_capex_absoluto(signo):
    flujo = pd.DataFrame([[150, 180], [signo*40, signo*50]], index=["Operating Cash Flow", "Capital Expenditure"])
    serie, fuente = motor.construir_fcl(flujo)
    assert serie.tolist() == [110, 130]
    assert fuente == "Calculado: CFO - |CapEx|"


def test_fcl_directo_prioritario_y_ausente():
    serie, fuente = motor.construir_fcl(pd.DataFrame([[9]], index=["Free Cash Flow"]))
    assert serie.tolist() == [9]
    assert fuente == "Yahoo: Free Cash Flow"
    assert motor.construir_fcl(pd.DataFrame())[0].empty


def test_ebitda_directo_calculado_y_ausente():
    directo, _ = motor.construir_ebitda(pd.DataFrame([[9]], index=["EBITDA"]), pd.DataFrame(), pd.Series(dtype=float))
    assert directo.tolist() == [9]
    calculado, fuente = motor.construir_ebitda(pd.DataFrame(), pd.DataFrame([[-20, 30]], index=["Depreciation And Amortization"]), pd.Series([100, 120]))
    assert calculado.tolist() == [120, 150]
    assert fuente == "Calculado: EBIT + D&A"
    assert motor.construir_ebitda(pd.DataFrame(), pd.DataFrame(), pd.Series(dtype=float))[0].empty


def test_margen_conservador_mediana_ventana_y_negativos():
    config = motor.Configuracion()
    margen, anos, mediana = motor.margen_normalizado(pd.Series([20, 30, 60]), pd.Series([100, 200, 300]), config)
    assert (margen, anos, mediana) == pytest.approx((0.16, 3, 0.2))
    assert motor.margen_normalizado(pd.Series([-10]), pd.Series([100]), config) == (-0.1, 1, -0.1)
    assert motor.margen_normalizado(pd.Series([20, 90]), pd.Series([100, 100]), replace(config, max_anos_historicos=1)) == pytest.approx((0.72, 1, 0.9))


@pytest.mark.parametrize("metrica, ingresos", [([], []), ([10], [0]), ([200], [100]), ([-200], [100])])
def test_margen_sin_observaciones_admitidas(metrica, ingresos):
    assert motor.margen_normalizado(pd.Series(metrica, dtype=float), pd.Series(ingresos, dtype=float), motor.Configuracion()) == (None, 0, None)
