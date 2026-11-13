"""F3-R09: procedencia y tiempo disponibles, sin fechas de mercado inventadas."""

from dataclasses import replace
import json

import pandas as pd
import pytest

from valoracion import calculos, modelos
from valoracion.proveedores import yahoo
from tests.fixtures.datos_sinteticos import TickerSintetico
from tests.integration.test_metodologia import datos


def test_adquisicion_conserva_fuente_estadistico_y_no_inventa_fecha_precio(monkeypatch):
    instante='2026-11-12T12:00:00+00:00'
    monkeypatch.setattr(yahoo,'_ahora_utc',lambda:instante,raising=False)
    ticker=TickerSintetico(analyst_price_targets={'mean':None,'median':55})
    ticker.datos['info'].update(numberOfAnalystOpinions=12,regularMarketTime=1700000000)
    resultado=yahoo.ProveedorYahoo(ticker_factory=lambda _:ticker).obtener_empresa('TEST')
    traza=resultado.trazabilidad
    assert traza.fuente=='Yahoo Finance vía yfinance'
    assert traza.obtenido_en==instante
    assert traza.fuente_precio=='fast_info.last_price'
    assert traza.fecha_precio is None  # regularMarketTime no pertenece a fast_info.
    assert traza.fuente_objetivo=='analyst_price_targets.median'
    assert traza.estadistico_objetivo=='median'
    assert traza.cobertura_analistas==12
    assert traza.fecha_objetivo is None and traza.horizonte_objetivo is None


def test_precio_historico_conserva_su_fecha_real_y_el_objetivo_fallback(monkeypatch):
    monkeypatch.setattr(yahoo,'_ahora_utc',lambda:'2026-11-12T12:00:00+00:00',raising=False)
    ticker=TickerSintetico(fast_info={},analyst_price_targets={})
    ticker.datos['info']['targetMeanPrice']=65
    dato=yahoo.ProveedorYahoo(ticker_factory=lambda _:ticker).obtener_empresa('TEST')
    assert dato.trazabilidad.fuente_precio=='history.Close'
    assert dato.trazabilidad.fecha_precio=='2025-01-03T00:00:00+00:00'
    assert dato.trazabilidad.fuente_objetivo=='info.targetMeanPrice'
    assert dato.trazabilidad.estadistico_objetivo=='mean'


def test_fx_cacheado_no_recibe_una_fecha_de_adquisicion_nueva(monkeypatch):
    reloj={'ahora':'2026-11-12T12:00:00+00:00'}
    monkeypatch.setattr(yahoo,'_ahora_utc',lambda:reloj['ahora'],raising=False)
    ticker=TickerSintetico()
    ticker.datos['info'].update(currency='MXN',financialCurrency='USD')
    fx=TickerSintetico(history_result=pd.DataFrame({'Close':[20]},index=pd.date_range('2026-11-10',periods=1,tz='UTC')))
    llamadas=[]
    def factory(simbolo):
        llamadas.append(simbolo)
        return ticker if simbolo=='TEST' else fx
    proveedor=yahoo.ProveedorYahoo(ticker_factory=factory)
    primero=proveedor.obtener_empresa('TEST')
    reloj['ahora']='2026-11-12T13:00:00+00:00'
    segundo=proveedor.obtener_empresa('TEST')
    assert segundo.trazabilidad.obtenido_en==reloj['ahora']
    assert segundo.trazabilidad.fx_obtenido_en==primero.trazabilidad.fx_obtenido_en=='2026-11-12T12:00:00+00:00'
    assert segundo.trazabilidad.fecha_fx=='2026-11-10T00:00:00+00:00'
    assert 'USDMXN=X' in segundo.trazabilidad.fuente_fx
    assert llamadas.count('USDMXN=X')==1


def test_periodos_fuentes_y_configuracion_describen_las_observaciones_usadas(config_simple):
    base=datos()
    flujo=base.flujo.astype(float)
    flujo.loc['Free Cash Flow',pd.Timestamp('2024-01-01')]=float('nan')
    traza=modelos.TrazabilidadDatos(fuente='Datos sintéticos',obtenido_en='2026-11-12T12:00:00+00:00')
    base=replace(base,flujo=flujo,trazabilidad=traza)
    config=replace(config_simple,max_anos_historicos=2)
    resultado=calculos.valorar_empresa(base,config)
    fcl=resultado.trazabilidad['modelos']['FCL']
    assert fcl['periodos']==['2022-01-01','2023-01-01']
    assert fcl['incluido'] is True
    assert 'Free Cash Flow' in fcl['fuente']
    assert resultado.detalle['Período ingresos']=='2024-01-01'
    assert resultado.detalle['Fuente de datos']=='Datos sintéticos'
    assert resultado.detalle['Obtenido en UTC']==traza.obtenido_en
    assert resultado.detalle['Fecha del precio'] is None
    assert json.loads(resultado.detalle['Configuración efectiva'])['max_anos_historicos']==2
    assert json.loads(resultado.detalle['Períodos por modelo'])['FCL']==fcl['periodos']


def test_datos_sin_procedencia_no_se_atribuyen_a_yahoo(config_simple):
    resultado=calculos.valorar_empresa(datos(),config_simple)
    assert resultado.detalle['Fuente de datos'] is None
    assert resultado.detalle['Obtenido en UTC'] is None
    assert resultado.detalle['Fecha del precio'] is None


def test_balance_de_fechas_distintas_no_se_concilia_sin_advertencia(config_simple):
    base=datos()
    balance=base.balance.astype(float)
    balance.loc['Total Debt',pd.Timestamp('2024-01-01')]=float('nan')
    resultado=calculos.valorar_empresa(replace(base,balance=balance),config_simple)
    assert resultado.detalle['Deuda']==300 and resultado.detalle['Efectivo']==100
    assert resultado.detalle['Período deuda']=='2023-01-01'
    assert resultado.detalle['Período efectivo']=='2024-01-01'
    assert resultado.detalle['Deuda neta'] is None
    assert resultado.principal['Valor intrínseco EBIT'] is None
    assert resultado.principal['Modelos en mediana']==2
    assert 'períodos' in resultado.principal['Notas'].lower()


def test_fuente_balance_fallback_no_inventa_periodo(config_simple):
    base=datos()
    info={**base.info,'totalDebt':300,'totalCash':100}
    resultado=calculos.valorar_empresa(replace(base,info=info,balance=pd.DataFrame()),config_simple)
    assert resultado.detalle['Fuente deuda']=='info.totalDebt'
    assert resultado.detalle['Fuente efectivo']=='info.totalCash'
    assert resultado.detalle['Período deuda'] is None
    assert resultado.detalle['Período efectivo'] is None
    assert resultado.principal['Estado']=='REVISAR'


def test_monedas_ausentes_no_se_infieren_del_dolar():
    ticker=TickerSintetico()
    ticker.datos['info'].pop('financialCurrency')
    dato=yahoo.ProveedorYahoo(ticker_factory=lambda _:ticker).obtener_empresa('TEST')
    assert dato.moneda_financiera is None
    assert dato.moneda_cotizacion=='USD'
    assert dato.tipo_cambio is None


def test_fuentes_reflejan_alias_reales_y_ajustes_derivados(config_simple):
    base = datos()
    resultados = base.resultados.rename(index={'EBITDA': 'Normalized EBITDA', 'Tax Provision': 'Income Tax Expense'})
    flujo = base.flujo.drop(index='Free Cash Flow').rename(index={'Operating Cash Flow': 'Total Cash From Operating Activities'})
    resultado = calculos.valorar_empresa(replace(base, resultados=resultados, flujo=flujo), config_simple)
    fuentes = json.loads(resultado.detalle['Fuentes por métrica'])
    assert 'Normalized EBITDA' in fuentes['EBITDA_AJUSTADO']
    assert 'Total Cash From Operating Activities' in fuentes['FCL']
    assert 'Income Tax Expense' in fuentes['IMPUESTOS']
    assert 'Calculado' in fuentes['FCL']


def test_acciones_derivadas_de_market_cap_conservan_su_procedencia():
    ticker = TickerSintetico(fast_info={'last_price':40})
    ticker.datos['info'].pop('sharesOutstanding')
    ticker.datos['info']['marketCap'] = 400
    dato = yahoo.ProveedorYahoo(ticker_factory=lambda _: ticker).obtener_empresa('TEST')
    assert dato.acciones == 10
    assert dato.trazabilidad.fuente_acciones == 'Calculado: info.marketCap / precio'
    assert dato.trazabilidad.fecha_acciones is None


def test_error_conserva_versiones_del_contrato():
    principal, detalle = modelos.crear_resultado_error('TEST', RuntimeError('fallo'))
    assert principal['Versión metodología'] == detalle['Versión metodología'] == 'proxies-1.0'
    assert detalle['Versión contrato'] == '2.0'
