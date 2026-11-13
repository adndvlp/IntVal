"""F2-R02/R03/R08: motor real con un proveedor de dominio, sin parchear Yahoo."""

import json
from dataclasses import asdict
from importlib import import_module
from pathlib import Path

import pandas as pd
import pytest

from tests.fixtures.escenarios_f2 import CASOS, escenario


def datos_del_caso(caso):
    modelos = import_module("valoracion.modelos")
    ticker, config = escenario(caso)
    datos = modelos.DatosEmpresa(
        ticker="TEST",
        info=ticker.info,
        precio=40,
        objetivo_analistas=60,
        acciones=None if caso == "sin_acciones" else 10,
        resultados=ticker.income_stmt,
        flujo=pd.DataFrame() if caso == "sin_flujo" else ticker.cashflow,
        balance=ticker.balance_sheet,
        moneda_financiera=ticker.info["financialCurrency"],
        moneda_cotizacion=ticker.info["currency"],
        tipo_cambio=None if caso == "fx_ausente" else 1.0,
    )
    return datos, config


class ProveedorMemoria:
    def __init__(self, datos):
        self.datos = datos
        self.llamadas = []
        self.precios = pd.DataFrame(
            {
                "Fecha": pd.date_range("2025-01-01", periods=3),
                "Cierre": [38.0, 39.0, 40.0],
            }
        )

    def obtener_empresa(self, ticker):
        self.llamadas.append(("empresa", ticker))
        return self.datos

    def obtener_precio_historico(self, ticker, periodo):
        self.llamadas.append(("precio", ticker, periodo))
        return self.precios

    def obtener_estados_historicos(self, ticker):
        self.llamadas.append(("estados", ticker))
        return self.datos


def migrar_referencia_f3(referencia, caso):
    """Políticas documentadas en methodology.md; el JSON de F1 permanece intacto.

    Se comparan todos los campos heredados, incluidos los nuevos ausentes esperados.
    Las columnas nuevas se prueban en test_metodologia y test_trazabilidad.
    """
    principal, detalle = referencia
    for campo in ("Fuente FCL", "Fuente EBITDA ajustado"):
        detalle[campo] = detalle[campo].replace("Yahoo: ", "Campo: ")
    if caso == "crecimiento_fallback":
        for registro in referencia:
            registro["Notas"] = "Crecimiento no disponible; se usó fallback de 3.0%."
    if caso in ("financiera", "fx_ausente"):
        for campo in principal:
            if campo.startswith("Valor intrínseco") or campo in (
                "Upside FCL",
                "Upside EBIT",
                "Upside EBITDA",
                "Upside utilidad neta",
                "Mediana de modelos",
                "Upside mediana",
            ):
                principal[campo] = None
        for campo in detalle:
            if campo.startswith("PV "):
                detalle[campo] = None
    if caso == "financiera":
        principal["Estado"] = "REVISAR"
        principal["Notas"] = detalle["Notas"] = (
            "Clase FINANCIERA: no hay un modelo sectorial implementado; proxies no aplicables."
        )
    if caso == "fx_ausente":
        principal["Estado"] = "DATOS INCOMPLETOS"
        for campo in detalle:
            if campo.startswith(("Margen ", "Base ")) or campo in (
                "Tipo de cambio",
                "Ingresos actuales",
                "Deuda",
                "Efectivo",
                "Deuda neta",
            ):
                detalle[campo] = None
            elif campo.startswith("Años "):
                detalle[campo] = 0
        detalle.update(
            {
                "Tasa de impuestos": 0.21,
                "CAGR histórico ingresos": 0.03,
                "Crecimiento años 1-5": 0.0075,
                "Crecimiento años 6-10": 0.00375,
                "Fuente EBITDA ajustado": "No disponible",
            }
        )
        principal["Notas"] = detalle["Notas"] = " ".join(
            [
                "FX USD/MXN no verificable; valoraciones bloqueadas.",
                "Crecimiento no disponible; se usó fallback de 3.0%.",
                "Deuda desconocida; no se presume cero.",
                "Efectivo desconocido; no se presume cero.",
                "Ingresos no disponibles.",
                "FCL normalizado no positivo o no disponible.",
                "NOPAT normalizado no positivo o no disponible.",
                "EBITDA ajustado no positivo o no disponible.",
                "Utilidad neta normalizada no positiva o no disponible.",
            ]
        )
    return referencia


@pytest.mark.parametrize("caso", CASOS)
def test_servicio_inyectado_conserva_f1_con_migracion_explicita_f3(caso):
    servicio = import_module("valoracion.servicio")
    datos, config = datos_del_caso(caso)
    proveedor = ProveedorMemoria(datos)
    esperado = json.loads(Path("tests/fixtures/resultados_f1.json").read_text(encoding="utf-8"))[
        caso
    ]
    esperado = migrar_referencia_f3(esperado, caso)
    resultado = servicio.analizar_empresa("TEST", config, proveedor=proveedor)
    assert proveedor.llamadas == [("empresa", "TEST")]
    assert asdict(resultado.configuracion) == asdict(config)
    for registro, referencia in zip(resultado.como_registros(), esperado, strict=True):
        assert list(registro)[: len(referencia)] == list(referencia)
        assert registro["Versión metodología"] == "proxies-1.0"
        assert registro["Versión contrato"] == "2.0"
        for campo, valor in referencia.items():
            if isinstance(valor, (int, float)) and not isinstance(valor, bool):
                assert registro[campo] == pytest.approx(valor, rel=1e-12, abs=1e-12), campo
            else:
                assert registro[campo] == valor, campo
    assert " ".join(d.mensaje for d in resultado.diagnosticos) == resultado.principal["Notas"]


def test_snapshot_utf8_con_codificacion_predeterminada_cp1252(monkeypatch):
    lectura_original = Path.read_text

    def leer_texto(ruta, *args, **kwargs):
        kwargs.setdefault("encoding", "cp1252")
        return lectura_original(ruta, *args, **kwargs)

    monkeypatch.setattr(Path, "read_text", leer_texto)
    test_servicio_inyectado_conserva_f1_con_migracion_explicita_f3("completa_simple")


def test_calculo_puro_y_resultados_no_comparten_estado_mutable():
    calculos = import_module("valoracion.calculos")
    datos, config = datos_del_caso("completa_simple")
    antes = datos.resultados.copy(deep=True)
    primero = calculos.valorar_empresa(datos, config)
    segundo = calculos.valorar_empresa(datos, config)
    registro, detalle = primero.como_registros()
    registro["Precio de mercado"] = 999
    detalle["Sector"] = "Modificado"
    assert primero.principal["Precio de mercado"] == 40
    assert segundo.principal["Precio de mercado"] == 40
    assert segundo.detalle["Sector"] == "Industrials"
    pd.testing.assert_frame_equal(datos.resultados, antes)


def test_modelo_copia_entradas_del_proveedor():
    modelos = import_module("valoracion.modelos")
    ticker, _ = escenario("completa_default")
    datos = modelos.DatosEmpresa(ticker="TEST", info=ticker.info, resultados=ticker.income_stmt)
    ticker.datos["info"]["shortName"] = "Modificado"
    ticker.datos["income_stmt"].iloc[0, 0] = 999
    assert datos.info["shortName"] == "Industrial sintética"
    assert datos.resultados.iloc[0, 0] == 1000


def test_historicos_usen_el_mismo_contrato_inyectado():
    servicio = import_module("valoracion.servicio")
    datos, config = datos_del_caso("completa_simple")
    proveedor = ProveedorMemoria(datos)
    precios = servicio.obtener_precio_historico("TEST", "1y", proveedor=proveedor)
    financieros, margenes = servicio.obtener_historicos_financieros(
        "TEST", config, proveedor=proveedor
    )
    assert proveedor.llamadas == [("precio", "TEST", "1y"), ("estados", "TEST")]
    pd.testing.assert_frame_equal(precios, proveedor.precios)
    precios.loc[0, "Cierre"] = 999
    assert proveedor.precios.loc[0, "Cierre"] == 38
    assert financieros.loc["2024", "Ingresos"] == pytest.approx(0.001)
    assert margenes.loc["2024", "Margen NOPAT"] == pytest.approx(0.16)


def test_mercado_explicito_conserva_prioridad_heredada():
    servicio = import_module("valoracion.servicio")
    datos, config = datos_del_caso("completa_simple")
    resultado = servicio.analizar_empresa("TEST", config, "MX", proveedor=ProveedorMemoria(datos))
    assert resultado.principal["Mercado"] == "MX"


def test_adaptador_yahoo_acepta_factory_y_retorna_el_modelo_de_dominio():
    yahoo = import_module("valoracion.proveedores.yahoo")
    base = import_module("valoracion.proveedores.base")
    ticker, config = escenario("completa_simple")
    llamadas = []

    def factory(simbolo):
        llamadas.append(simbolo)
        return ticker

    proveedor = yahoo.ProveedorYahoo(ticker_factory=factory)
    assert isinstance(proveedor, base.ProveedorDatos)
    datos = proveedor.obtener_empresa("TEST")
    assert datos.ticker == "TEST"
    assert datos.precio == 40
    assert datos.acciones == 10
    assert datos.moneda_cotizacion == "USD"
    assert datos.tipo_cambio == 1
    assert llamadas == ["TEST"]
    historico = proveedor.obtener_precio_historico("TEST", "1y")
    assert historico["Cierre"].tolist() == [38, 39, 40]
    assert historico["Fecha"].dt.tz is None
    estados = proveedor.obtener_estados_historicos("TEST")
    assert estados.precio is None
    assert estados.resultados.equals(datos.resultados)
    assert llamadas == ["TEST", "TEST", "TEST"]


def test_factory_y_cache_fx_quedan_aislados_entre_proveedores():
    yahoo = import_module("valoracion.proveedores.yahoo")
    ticker, _ = escenario("completa_default")
    ticker.datos["info"].update(financialCurrency="USD", currency="MXN")
    consultas = []

    def factory(factor):
        def obtener(simbolo):
            consultas.append((factor, simbolo))
            if simbolo == "TEST":
                return ticker
            assert simbolo == "USDMXN=X"
            return type(ticker)(history_result=pd.DataFrame({"Close": [factor]}))

        return obtener

    primero = yahoo.ProveedorYahoo(ticker_factory=factory(20))
    segundo = yahoo.ProveedorYahoo(ticker_factory=factory(10))
    assert primero.obtener_empresa("TEST").tipo_cambio == 20
    assert segundo.obtener_empresa("TEST").tipo_cambio == 10
    assert primero.obtener_empresa("TEST").tipo_cambio == 20
    assert consultas.count((20, "USDMXN=X")) == 1
    assert consultas.count((10, "USDMXN=X")) == 1


@pytest.mark.parametrize(
    "campo, atributo, estado, mediana",
    [
        ("income_stmt", "resultados", "DATOS INCOMPLETOS", None),
        ("cashflow", "flujo", "OK", 46),
        ("balance_sheet", "balance", "REVISAR", 50),
    ],
)
def test_adaptador_normaliza_estados_nulos_como_el_motor_heredado(campo, atributo, estado, mediana):
    yahoo = import_module("valoracion.proveedores.yahoo")
    servicio = import_module("valoracion.servicio")
    ticker, config = escenario("completa_simple")
    ticker.datos[campo] = None
    proveedor = yahoo.ProveedorYahoo(ticker_factory=lambda _: ticker)
    datos = proveedor.obtener_empresa("TEST")
    assert isinstance(getattr(datos, atributo), pd.DataFrame)
    assert getattr(datos, atributo).empty
    resultado = servicio.analizar_empresa("TEST", config, proveedor=proveedor)
    assert resultado.principal["Estado"] == estado
    assert resultado.principal["Precio de mercado"] == 40
    assert resultado.principal["Mediana de modelos"] == (
        pytest.approx(mediana) if mediana is not None else None
    )
    historicos = proveedor.obtener_estados_historicos("TEST")
    assert isinstance(historicos.resultados, pd.DataFrame)
    assert isinstance(historicos.flujo, pd.DataFrame)
