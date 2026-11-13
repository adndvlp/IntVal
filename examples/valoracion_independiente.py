"""Conciliación decimal independiente de proxies-1.0. Ejecutar como módulo."""
from __future__ import annotations

import argparse
import csv
from decimal import Decimal, localcontext
from pathlib import Path
from statistics import median

import pandas as pd

from valoracion.calculos import valorar_empresa
from valoracion.configuracion import Configuracion
from valoracion.exportacion.excel import escribir_excel
from valoracion.metodologia import MODELOS
from valoracion.modelos import DatosEmpresa, TrazabilidadDatos

DIRECTORIO = Path(__file__).resolve().parent


def calculo_independiente(tasa_empresa=Decimal('0')):
    """Lee CSV con Decimal y usa una anualidad cerrada, sin funciones del motor.

    Hipótesis del ejemplo: g=0, N=3, múltiplo=2, factor margen=0.8,
    10 acciones, Ke=0. Los datos son ficticios y los importes están en USD.
    """
    with (DIRECTORIO / 'datos.csv').open(newline='') as archivo:
        filas = [{k: Decimal(v) for k, v in fila.items() if k != 'periodo'} for fila in csv.DictReader(archivo)]
    with localcontext() as contexto:
        contexto.prec = 40
        impuestos = median([f['impuestos'] / f['pretax'] for f in filas])
        ingreso_actual = filas[-1]['ingresos']
        deuda_neta = filas[-1]['deuda'] - filas[-1]['efectivo']
        margenes = {m: [] for m in MODELOS}
        for f in filas:
            fcl = f['cfo'] - abs(f['capex'])
            if fcl != f['fcl']:
                raise ValueError('FCL reportado y CFO menos CapEx no concilian en el ejemplo.')
            metricas = {
                'FCL': fcl,
                'NOPAT': f['ebit'] * (1-impuestos),
                'EBITDA_AJUSTADO': f['ebitda'] - max(Decimal(0), f['ebit']) * impuestos - abs(f['capex']),
                'UTILIDAD_NETA': f['utilidad_neta'],
            }
            for modelo, valor in metricas.items():
                margenes[modelo].append(valor / f['ingresos'])
        resultado = {}
        for modelo, observaciones in margenes.items():
            empresa = modelo in ('NOPAT', 'EBITDA_AJUSTADO')
            tasa = tasa_empresa if empresa else Decimal(0)
            factor_actual = (1+tasa) ** -3
            anualidad = Decimal(3) if tasa == 0 else (1-factor_actual) / tasa
            margen = median(observaciones)
            conservador = margen * Decimal('0.8')
            base = ingreso_actual * conservador
            flujos = base * anualidad
            terminal = base * 2 * factor_actual
            capital = flujos + terminal - (deuda_neta if empresa else Decimal(0))
            resultado[modelo] = dict(margen_mediano=margen, margen_conservador=conservador,
                                     base=base, pv_flujos=flujos, pv_terminal=terminal,
                                     capital=capital, por_accion=capital / 10)
        return resultado


def crear_caso():
    tabla = pd.read_csv(DIRECTORIO / 'datos.csv', index_col='periodo')
    tabla.index = pd.to_datetime(tabla.index)
    def estado(campos):
        return tabla[list(campos)].rename(columns=campos).T
    return DatosEmpresa(
        ticker='EJEMPLO', info={'shortName': 'Industrial sintética', 'sector': 'Industrials', 'quoteType': 'EQUITY'},
        precio=40, objetivo_analistas=60, acciones=10,
        resultados=estado({'ingresos': 'Total Revenue', 'ebit': 'EBIT', 'utilidad_neta': 'Net Income',
                           'impuestos': 'Tax Provision', 'pretax': 'Pretax Income', 'ebitda': 'EBITDA'}),
        flujo=estado({'cfo': 'Operating Cash Flow', 'capex': 'Capital Expenditure', 'fcl': 'Free Cash Flow'}),
        balance=estado({'deuda': 'Total Debt', 'efectivo': 'Cash And Cash Equivalents'}),
        moneda_financiera='USD', moneda_cotizacion='USD', tipo_cambio=1,
        trazabilidad=TrazabilidadDatos(fuente='Datos sintéticos de examples/datos.csv'),
    )


def ejecutar(destino: Path):
    destino = Path(destino)
    config = Configuracion(anos_proyeccion=3, tasa_descuento=0, tasa_descuento_empresa=0,
                           multiplo_terminal_fcl=2, multiplo_terminal_ebit=2,
                           multiplo_terminal_ebitda=2, multiplo_terminal_utilidad_neta=2,
                           pausa_entre_tickers=0)
    resultado = valorar_empresa(crear_caso(), config)
    independiente = calculo_independiente()
    with (DIRECTORIO / 'esperados.csv').open(newline='') as archivo:
        for fila in csv.DictReader(archivo):
            for campo, valor in fila.items():
                if campo != 'modelo' and independiente[fila['modelo']][campo] != Decimal(valor):
                    raise ArithmeticError(f'La conciliación manual difiere: {fila["modelo"]}, {campo}')
    comparacion = []
    for modelo, campo in MODELOS.items():
        esperado = independiente[modelo]['por_accion']
        actual = Decimal(str(resultado.principal[campo]))
        diferencia = abs(actual - esperado)
        if diferencia > Decimal('1e-10'):
            raise ArithmeticError(f'El motor difiere del cálculo independiente: {modelo}')
        comparacion.append(dict(modelo=modelo, independiente=str(esperado), motor=str(actual), diferencia_absoluta=str(diferencia)))
    destino.mkdir(parents=True, exist_ok=True)
    with (destino / 'conciliacion.csv').open('w', newline='') as archivo:
        escritor = csv.DictWriter(archivo, fieldnames=list(comparacion[0]))
        escritor.writeheader()
        escritor.writerows(comparacion)
    escribir_excel([resultado.principal], [resultado.detalle], destino / 'valoracion_independiente.xlsx', config)
    return resultado, comparacion


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DIRECTORIO / 'salida')
    argumentos = parser.parse_args()
    resultado, _ = ejecutar(argumentos.output)
    print(f'4 proxies conciliados; mediana {resultado.principal["Mediana de modelos"]:.2f} USD; salida: {argumentos.output}')


if __name__ == '__main__':
    main()
