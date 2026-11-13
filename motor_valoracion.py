from __future__ import annotations

import argparse
import math
import time
import warnings
from dataclasses import asdict, dataclass, fields
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
import yfinance as yf
from openpyxl import load_workbook
from openpyxl.formatting.rule import CellIsRule, ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

warnings.filterwarnings("ignore", category=FutureWarning)


# ---------------------------------------------------------------------------
# Universo de empresas
# ---------------------------------------------------------------------------

EMPRESAS_USA = [
  "A",
  "AAPL",
  "ABBV",
  "ABNB",
  "ABT",
  "ACGL",
  "ACN",
  "ADBE",
  "ADI",
  "ADM",
  "ADP",
  "ADSK",
  "AEE",
  "AEP",
  "AES",
  "AFL",
  "AIG",
  "AIZ",
  "AJG",
  "AKAM",
  "ALB",
  "ALGN",
  "ALL",
  "ALLE",
  "AMAT",
  "AMCR",
  "AMD",
  "AME",
  "AMGN",
  "AMP",
  "AMT",
  "AMZN",
  "ANET",
  "AON",
  "AOS",
  "APA",
  "APD",
  "APH",
  "APO",
  "APP",
  "APTV",
  "ARE",
  "ARES",
  "ATO",
  "AVB",
  "AVGO",
  "AVY",
  "AWK",
  "AXON",
  "AXP",
  "AZO",
  "BA",
  "BAC",
  "BALL",
  "BAX",
  "BBY",
  "BDX",
  "BEN",
  "BF.B",
  "BG",
  "BIIB",
  "BKNG",
  "BKR",
  "BLDR",
  "BLK",
  "BMY",
  "BNY",
  "BR",
  "BRK.B",
  "BRO",
  "BSX",
  "BX",
  "BXP",
  "C",
  "CAH",
  "CARR",
  "CASY",
  "CAT",
  "CB",
  "CBOE",
  "CBRE",
  "CCI",
  "CCL",
  "CDNS",
  "CDW",
  "CEG",
  "CF",
  "CFG",
  "CHD",
  "CHRW",
  "CHTR",
  "CI",
  "CIEN",
  "CINF",
  "CL",
  "CLX",
  "CMCSA",
  "CME",
  "CMG",
  "CMI",
  "CMS",
  "CNC",
  "CNP",
  "COF",
  "COHR",
  "COIN",
  "COO",
  "COP",
  "COR",
  "COST",
  "CPAY",
  "CPRT",
  "CPT",
  "CRH",
  "CRL",
  "CRM",
  "CRWD",
  "CSCO",
  "CSGP",
  "CSX",
  "CTAS",
  "CTSH",
  "CTVA",
  "CVNA",
  "CVS",
  "CVX",
  "D",
  "DAL",
  "DASH",
  "DD",
  "DDOG",
  "DE",
  "DECK",
  "DELL",
  "DG",
  "DGX",
  "DHI",
  "DHR",
  "DIS",
  "DLR",
  "DLTR",
  "DOC",
  "DOV",
  "DOW",
  "DPZ",
  "DRI",
  "DTE",
  "DUK",
  "DVA",
  "DVN",
  "DXCM",
  "EA",
  "EBAY",
  "ECHO",
  "ECL",
  "ED",
  "EFX",
  "EG",
  "EIX",
  "EL",
  "ELV",
  "EME",
  "EMR",
  "EOG",
  "EQIX",
  "EQR",
  "EQT",
  "ERIE",
  "ES",
  "ESS",
  "ETN",
  "ETR",
  "EVRG",
  "EW",
  "EXC",
  "EXE",
  "EXPD",
  "EXPE",
  "EXR",
  "F",
  "FANG",
  "FAST",
  "FCX",
  "FDS",
  "FDX",
  "FDXF",
  "FE",
  "FFIV",
  "FICO",
  "FIS",
  "FISV",
  "FITB",
  "FIX",
  "FLEX",
  "FOXA",
  "FRT",
  "FSLR",
  "FTNT",
  "FTV",
  "GD",
  "GDDY",
  "GE",
  "GEHC",
  "GEN",
  "GEV",
  "GILD",
  "GIS",
  "GL",
  "GLW",
  "GM",
  "GNRC",
  "GOOGL",
  "GPC",
  "GPN",
  "GRMN",
  "GS",
  "GWW",
  "HAL",
  "HAS",
  "HBAN",
  "HCA",
  "HD",
  "HIG",
  "HII",
  "HLT",
  "HON",
  "HONA",
  "HOOD",
  "HPE",
  "HPQ",
  "HRL",
  "HSIC",
  "HST",
  "HSY",
  "HUBB",
  "HUM",
  "HWM",
  "IBKR",
  "IBM",
  "ICE",
  "IDXX",
  "IEX",
  "IFF",
  "INCY",
  "INTC",
  "INTU",
  "INVH",
  "IP",
  "IQV",
  "IR",
  "IRM",
  "ISRG",
  "IT",
  "ITW",
  "IVZ",
  "J",
  "JBHT",
  "JBL",
  "JCI",
  "JKHY",
  "JNJ",
  "JPM",
  "KDP",
  "KEY",
  "KEYS",
  "KHC",
  "KIM",
  "KKR",
  "KLAC",
  "KMB",
  "KMI",
  "KO",
  "KR",
  "KVUE",
  "L",
  "LDOS",
  "LEN",
  "LH",
  "LHX",
  "LII",
  "LIN",
  "LITE",
  "LLY",
  "LMT",
  "LNT",
  "LOW",
  "LRCX",
  "LULU",
  "LUV",
  "LVS",
  "LYB",
  "LYV",
  "MA",
  "MAA",
  "MAR",
  "MAS",
  "MCD",
  "MCHP",
  "MCK",
  "MCO",
  "MDLZ",
  "MDT",
  "MET",
  "META",
  "MGM",
  "MKC",
  "MLM",
  "MMM",
  "MNST",
  "MO",
  "MOS",
  "MPC",
  "MPWR",
  "MRK",
  "MRNA",
  "MRSH",
  "MRVL",
  "MS",
  "MSCI",
  "MSFT",
  "MSI",
  "MTB",
  "MTD",
  "MU",
  "NCLH",
  "NDAQ",
  "NDSN",
  "NEE",
  "NEM",
  "NFLX",
  "NI",
  "NKE",
  "NOC",
  "NOW",
  "NRG",
  "NSC",
  "NTAP",
  "NTRS",
  "NUE",
  "NVDA",
  "NVR",
  "NWSA",
  "NXPI",
  "O",
  "ODFL",
  "OKE",
  "OMC",
  "ON",
  "ORCL",
  "ORLY",
  "OTIS",
  "OXY",
  "PANW",
  "PAYX",
  "PCAR",
  "PCG",
  "PEG",
  "PEP",
  "PFE",
  "PFG",
  "PG",
  "PGR",
  "PH",
  "PHM",
  "PKG",
  "PLD",
  "PLTR",
  "PM",
  "PNC",
  "PNR",
  "PNW",
  "PODD",
  "PPG",
  "PPL",
  "PRU",
  "PSA",
  "PSKY",
  "PSX",
  "PTC",
  "PWR",
  "PYPL",
  "Q",
  "QCOM",
  "RCL",
  "REG",
  "REGN",
  "RF",
  "RJF",
  "RL",
  "RMD",
  "ROK",
  "ROL",
  "ROP",
  "ROST",
  "RSG",
  "RTX",
  "RVTY",
  "SBAC",
  "SBUX",
  "SCHW",
  "SHW",
  "SJM",
  "SLB",
  "SMCI",
  "SNA",
  "SNDK",
  "SNPS",
  "SO",
  "SOLV",
  "SPG",
  "SPGI",
  "SRE",
  "STE",
  "STLD",
  "STT",
  "STX",
  "STZ",
  "SW",
  "SWK",
  "SWKS",
  "SYF",
  "SYK",
  "SYY",
  "T",
  "TAP",
  "TDG",
  "TDY",
  "TECH",
  "TEL",
  "TER",
  "TFC",
  "TGT",
  "TJX",
  "TKO",
  "TMO",
  "TMUS",
  "TPL",
  "TPR",
  "TRGP",
  "TRMB",
  "TROW",
  "TRV",
  "TSCO",
  "TSLA",
  "TSN",
  "TT",
  "TTD",
  "TTWO",
  "TXN",
  "TXT",
  "TYL",
  "UAL",
  "UBER",
  "UDR",
  "UHS",
  "ULTA",
  "UNH",
  "UNP",
  "UPS",
  "URI",
  "USB",
  "V",
  "VEEV",
  "VICI",
  "VLO",
  "VLTO",
  "VMC",
  "VRSK",
  "VRSN",
  "VRT",
  "VRTX",
  "VST",
  "VTR",
  "VTRS",
  "VZ",
  "WAB",
  "WAT",
  "WBD",
  "WDAY",
  "WDC",
  "WEC",
  "WELL",
  "WFC",
  "WM",
  "WMB",
  "WMT",
  "WRB",
  "WSM",
  "WST",
  "WTW",
  "WY",
  "WYNN",
  "XEL",
  "XOM",
  "XYL",
  "XYZ",
  "YUM",
  "ZBH",
  "ZBRA",
  "ZTS"
]


# Selección de emisoras mexicanas grandes y líquidas. La lista prioriza los
# principales componentes del S&P/BMV IPC y compañías mexicanas de gran
# capitalización con ticker local reconocido por Yahoo Finance.
EMPRESAS_MX = [
    "AC.MX",           # Arca Continental
    "ACCELSAB.MX",     # Accel
    "ACTINVRB.MX",     # Corporación Actinver
    "AERO.MX",         # Grupo Aeroméxico
    "AGUA.MX",         # Grupo Rotoplas
    "AGUILASCPO.MX",   # Ollamani / Club América
    "ALPEKA.MX",       # Alpek
    "ALSEA.MX",        # Alsea
    "ALTERNAB.MX",     # Alterna Asesoría Internacional
    "AMXB.MX",         # América Móvil
    "ARA.MX",          # Consorcio ARA
    "ARISTOSA.MX",     # Consorcio Aristos
    "ASURB.MX",        # Grupo Aeroportuario del Sureste
    "AUTLANB.MX",      # Compañía Minera Autlán
    "AXTELCPO.MX",     # Axtel
    "AZTECACPO.MX",    # TV Azteca

    "BBAJIOO.MX",      # Banco del Bajío
    "BIMBOA.MX",       # Grupo Bimbo
    "BOLSAA.MX",       # Bolsa Mexicana de Valores

    "CABLECPO.MX",     # Empresas Cablevisión
    "CADUA.MX",        # Corpovael / CADU
    "CEMEXCPO.MX",     # Cemex
    "CHDRAUIB.MX",     # Grupo Comercial Chedraui
    "CIDMEGA.MX",      # Grupo CID
    "CIEB.MX",         # Corporación Interamericana de Entretenimiento
    "CMOCTEZ.MX",      # Corporación Moctezuma
    "CMRB.MX",         # CMR
    "COLLADO.MX",      # Grupo Collado
    "CONVERA.MX",      # Convertidora Industrial
    "COXA.MX",         # Cox México
    "CTAXTELA.MX",     # Controladora Axtel
    "CUERVO.MX",       # Becle / José Cuervo
    "CULTIBAB.MX",     # Organización Cultiba
    "CYDSASAA.MX",     # Cydsa

    "DIABLOSO.MX",     # Diablos Rojos de México
    "DINEA.MX",        # Dine

    "FEMSAUBD.MX",     # FEMSA
    "FINAMEXO.MX",     # Casa de Bolsa Finamex
    "FINDEP.MX",       # Financiera Independencia
    "FRAGUAB.MX",      # Corporativo Fragua

    "GAPB.MX",         # Grupo Aeroportuario del Pacífico
    "GAVA.MX",         # Acosta Verde
    "GBMO.MX",         # Corporativo GBM
    "GCARSOA1.MX",     # Grupo Carso
    "GCC.MX",          # GCC / Cementos de Chihuahua
    "GENTERA.MX",      # Gentera
    "GFINBURO.MX",     # Grupo Financiero Inbursa
    "GFMULTIO.MX",     # Grupo Financiero Multiva
    "GFNORTEO.MX",     # Grupo Financiero Banorte
    "GICSAB.MX",       # Grupo GICSA
    "GIGANTE.MX",      # Grupo Gigante
    "GISSA.MX",        # Grupo Industrial Saltillo
    "GLOBCA.MX",       # Tenedora de Acciones CM
    "GMD.MX",          # Grupo Mexicano de Desarrollo
    "GMEXICOB.MX",     # Grupo México
    "GNP.MX",          # Grupo Nacional Provincial
    "GPH1.MX",         # Grupo Palacio de Hierro
    "GPROFUT.MX",      # Grupo Profuturo
    "GRUMAB.MX",       # Gruma

    "HCITY.MX",        # Hoteles City Express
    "HERDEZ.MX",       # Grupo Herdez
    "HOTEL.MX",        # Grupo Hotelero Santa Fe

    "ICHB.MX",         # Industrias CH
    "IDEALB-1.MX",     # IDEAL
    "INVEXA.MX",       # Invex Controladora

    "KIMBERA.MX",      # Kimberly-Clark de México
    "KOFUBL.MX",       # Coca-Cola FEMSA
    "KUOA.MX",         # Grupo KUO

    "LABB.MX",         # Genomma Lab
    "LACOMERUBC.MX",   # La Comer
    "LAMOSA.MX",       # Grupo Lamosa
    "LASITE.MX",       # Sitios Latinoamérica
    "LIVEPOL1.MX",     # El Puerto de Liverpool

    "MEDICAB.MX",      # Médica Sur
    "MEGACPO.MX",      # Megacable
    "MFRISCOA-1.MX",   # Minera Frisco
    "MINSAB.MX",       # Grupo Minsa

    "NEMAKA.MX",       # Nemak
    "NUTRISAA.MX",     # Grupo Nutrisa

    "OMAB.MX",         # Grupo Aeroportuario del Centro Norte
    "ORBIA.MX",        # Orbia

    "PASAB.MX",        # Promotora Ambiental
    "PE&OLES.MX",      # Industrias Peñoles
    "PINFRA.MX",       # Pinfra
    "POCHTECB.MX",     # Grupo Pochteca
    "POSADASA.MX",     # Grupo Posadas

    "Q.MX",            # Quálitas Controladora

    "RA.MX",           # Regional / Banregio
    "RLHA.MX",         # RLH Properties

    "SIGMAFA.MX",      # Sigma Foods
    "SIMECB.MX",       # Grupo Simec
    "SORIANAB.MX",     # Organización Soriana
    "SPORTS.MX",       # Grupo Sports World

    "TEAKCPO.MX",      # Proteak Uno
    "TLEVISACPO.MX",   # Grupo Televisa
    "TRAXIONA.MX",     # Grupo Traxión

    "VALUEGFO.MX",     # Value Grupo Financiero
    "VASCONI.MX",      # Grupo Vasconia
    "VESTA.MX",        # Corporación Inmobiliaria Vesta
    "VINTE.MX",        # Vinte Viviendas Integrales
    "VISTAA.MX",       # Vista Energy
    "VITROA.MX",       # Vitro
    "VOLAR-A.MX",      # Volaris

    "WALMEX.MX",       # Walmart de México
]

EMPRESAS = EMPRESAS_USA + EMPRESAS_MX

FUENTES_UNIVERSO = [
    {
        "Mercado": "MX",
        "Fuente": "S&P/BMV IPC",
        "Descripción": "Índice de las acciones más grandes y líquidas listadas en la BMV.",
        "URL": "https://www.spglobal.com/spdji/en/indices/equity/sp-bmv-ipc/",
    },
    {
        "Mercado": "MX",
        "Fuente": "S&P/BMV Indices 2025 Annual Report",
        "Descripción": "Composición y principales constituyentes del índice a diciembre de 2025.",
        "URL": "https://www.spglobal.com/spdji/en/documents/commentary/market-commentary-sp-bmv-indices-2025-annual-report.pdf",
    },
    {
        "Mercado": "MX",
        "Fuente": "Yahoo Finance - componentes INMEX",
        "Descripción": "Referencia para símbolos .MX disponibles en Yahoo Finance.",
        "URL": "https://es.finance.yahoo.com/quote/INMEX.MX/components/",
    },
]


def mercado_de_ticker(ticker: str) -> str:
    return "MX" if ticker.upper().endswith(".MX") else "USA"


def eliminar_duplicados(items: Iterable[str]) -> list[str]:
    """Elimina duplicados sin cambiar el orden."""
    return list(dict.fromkeys(items))


# ---------------------------------------------------------------------------
# Supuestos editables
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Configuracion:
    anos_proyeccion: int = 10
    tasa_descuento: float = 0.10

    # Replica la lógica conservadora del Excel:
    # crecimiento años 1-5 = CAGR histórico × 25 %
    # crecimiento años 6-10 = crecimiento inicial × 50 %
    factor_crecimiento_inicial: float = 0.25
    factor_crecimiento_final: float = 0.50
    crecimiento_minimo: float = -0.02
    crecimiento_maximo: float = 0.12
    crecimiento_fallback: float = 0.03

    # Margen histórico normalizado × 80 %
    factor_margen_conservador: float = 0.80
    max_anos_historicos: int = 5

    # Múltiplos terminales editables
    multiplo_terminal_fcl: float = 12.0
    multiplo_terminal_ebit: float = 12.0
    multiplo_terminal_ebitda: float = 12.0
    multiplo_terminal_utilidad_neta: float = 15.0

    tasa_impuestos_fallback: float = 0.21
    tasa_impuestos_minima: float = 0.00
    tasa_impuestos_maxima: float = 0.35

    pausa_entre_tickers: float = 0.35

    def __post_init__(self) -> None:
        for campo in fields(self):
            valor = getattr(self, campo.name)
            if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor):
                raise ValueError(f"{campo.name} debe ser un número finito.")
        for nombre in ("anos_proyeccion", "max_anos_historicos"):
            valor = getattr(self, nombre)
            if not isinstance(valor, int) or valor <= 0:
                raise ValueError(f"{nombre} debe ser un entero positivo.")
        if self.tasa_descuento <= -1:
            raise ValueError("La tasa de descuento debe ser mayor que -1.")
        for nombre in ("factor_crecimiento_inicial", "factor_crecimiento_final", "factor_margen_conservador"):
            if not 0 <= getattr(self, nombre) <= 1:
                raise ValueError(f"{nombre} debe estar entre 0 y 1.")
        if min(self.crecimiento_minimo, self.crecimiento_maximo, self.crecimiento_fallback) <= -1:
            raise ValueError("Las tasas de crecimiento deben ser mayores que -1.")
        if self.crecimiento_minimo > self.crecimiento_maximo:
            raise ValueError("El crecimiento mínimo no puede superar al máximo.")
        for nombre in ("multiplo_terminal_fcl", "multiplo_terminal_ebit", "multiplo_terminal_ebitda", "multiplo_terminal_utilidad_neta"):
            if getattr(self, nombre) <= 0:
                raise ValueError(f"{nombre} debe ser positivo.")
        if not 0 <= self.tasa_impuestos_minima <= self.tasa_impuestos_fallback <= self.tasa_impuestos_maxima <= 1:
            raise ValueError("Las tasas de impuestos deben tener límites coherentes entre 0 y 1.")
        if self.pausa_entre_tickers < 0:
            raise ValueError("La pausa entre tickers no puede ser negativa.")


CONFIG = Configuracion()
CACHE_FX: dict[tuple[str, str], float | None] = {}

COLUMNAS_PRINCIPAL = [
    "Mercado", "Ticker", "Empresa", "Moneda", "Precio de mercado",
    "Valor intrínseco FCL", "Upside FCL", "Valor intrínseco EBIT", "Upside EBIT",
    "Valor intrínseco EBITDA", "Upside EBITDA", "Valor intrínseco utilidad neta",
    "Upside utilidad neta", "Mediana de modelos", "Upside mediana",
    "Precio objetivo analistas", "Upside analistas", "Estado", "Notas",
]
COLUMNAS_DETALLE = [
    "Mercado", "Ticker", "Empresa", "Sector", "Industria", "Moneda estados",
    "Moneda cotización", "Tipo de cambio", "Ingresos actuales",
    "Acciones en circulación", "Deuda", "Efectivo", "Deuda neta",
    "Tasa de impuestos", "CAGR histórico ingresos", "Crecimiento años 1-5",
    "Crecimiento años 6-10", "Margen FCL mediano", "Margen FCL conservador",
    "Años FCL", "Fuente FCL", "Margen NOPAT mediano", "Margen NOPAT conservador",
    "Años EBIT", "Margen EBITDA ajustado mediano",
    "Margen EBITDA ajustado conservador", "Años EBITDA", "Fuente EBITDA ajustado",
    "Margen neto mediano", "Margen neto conservador", "Años utilidad neta",
    "Base FCL", "Base NOPAT", "Base EBITDA ajustado", "Base utilidad neta",
    "PV flujos FCL", "PV terminal FCL", "PV flujos EBIT", "PV terminal EBIT",
    "PV flujos EBITDA", "PV terminal EBITDA", "PV flujos utilidad neta",
    "PV terminal utilidad neta", "Empresa financiera", "Notas",
]


def crear_resultado_error(ticker: str, error: Exception) -> tuple[dict, dict]:
    """Conserva el contrato tabular aunque falle la adquisición de una empresa."""
    identidad = {
        "Mercado": mercado_de_ticker(ticker), "Ticker": ticker,
        "Empresa": ticker, "Notas": str(error),
    }
    principal = dict.fromkeys(COLUMNAS_PRINCIPAL)
    principal.update(identidad, Estado="ERROR")
    detalle = dict.fromkeys(COLUMNAS_DETALLE)
    detalle.update(identidad)
    return principal, detalle


# ---------------------------------------------------------------------------
# Utilidades de datos
# ---------------------------------------------------------------------------

def numero_valido(valor) -> float | None:
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return None
    return numero if math.isfinite(numero) else None


def normalizar_etiqueta(texto: object) -> str:
    return "".join(caracter.lower() for caracter in str(texto) if caracter.isalnum())


def obtener_fila(
    estado: pd.DataFrame | None,
    candidatos: list[str],
) -> pd.Series:
    """Busca una línea contable ignorando mayúsculas, espacios y signos."""
    if estado is None or estado.empty:
        return pd.Series(dtype=float)

    mapa = {normalizar_etiqueta(indice): indice for indice in estado.index}

    for candidato in candidatos:
        indice_real = mapa.get(normalizar_etiqueta(candidato))
        if indice_real is not None:
            fila = estado.loc[indice_real]
            if isinstance(fila, pd.DataFrame):
                fila = fila.iloc[0]
            fila = pd.to_numeric(fila, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
            return fila.sort_index()

    return pd.Series(dtype=float)


def ultimo_valor(serie: pd.Series) -> float | None:
    if serie is None or serie.empty:
        return None
    serie = pd.to_numeric(serie, errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
    if serie.empty:
        return None
    return numero_valido(serie.iloc[-1])


def alinear_series(*series: pd.Series) -> pd.DataFrame:
    limpias = []
    for posicion, serie in enumerate(series):
        if serie is None:
            serie = pd.Series(dtype=float)
        limpia = pd.to_numeric(serie, errors="coerce").replace([np.inf, -np.inf], np.nan)
        limpias.append(limpia.rename(f"s{posicion}"))
    if not limpias:
        return pd.DataFrame()
    return pd.concat(limpias, axis=1, join="inner").dropna()


def obtener_info_segura(accion: yf.Ticker) -> dict:
    try:
        info = accion.get_info()
        return info if isinstance(info, dict) else {}
    except Exception:
        try:
            info = accion.info
            return info if isinstance(info, dict) else {}
        except Exception:
            return {}


def obtener_precio_actual(accion: yf.Ticker) -> float | None:
    try:
        fast_info = accion.fast_info
        for clave in ("last_price", "lastPrice", "regular_market_price"):
            try:
                valor = numero_valido(fast_info[clave])
            except Exception:
                valor = None
            if valor is not None and valor > 0:
                return valor
    except Exception:
        pass

    try:
        historia = accion.history(period="5d", auto_adjust=False)
        if not historia.empty:
            cierre = pd.to_numeric(historia["Close"], errors="coerce").dropna()
            if not cierre.empty:
                valor = numero_valido(cierre.iloc[-1])
                return valor if valor is not None and valor > 0 else None
    except Exception:
        pass

    return None


def obtener_objetivo_analistas(accion: yf.Ticker, info: dict) -> float | None:
    """Usa la API específica y conserva info como fallback."""
    try:
        objetivos = accion.analyst_price_targets
        if isinstance(objetivos, dict):
            for clave in ("mean", "median"):
                valor = numero_valido(objetivos.get(clave))
                if valor is not None and valor > 0:
                    return valor
    except Exception:
        pass

    for clave in ("targetMeanPrice", "targetMedianPrice"):
        valor = numero_valido(info.get(clave))
        if valor is not None and valor > 0:
            return valor
    return None


def obtener_acciones(accion: yf.Ticker, info: dict, precio: float | None) -> float | None:
    for clave in ("sharesOutstanding", "impliedSharesOutstanding"):
        valor = numero_valido(info.get(clave))
        if valor is not None and valor > 0:
            return valor

    try:
        fast_info = accion.fast_info
        for clave in ("shares", "shares_outstanding"):
            try:
                valor = numero_valido(fast_info[clave])
            except Exception:
                valor = None
            if valor is not None and valor > 0:
                return valor
    except Exception:
        pass

    market_cap = numero_valido(info.get("marketCap"))
    if market_cap and precio and precio > 0:
        return market_cap / precio

    try:
        historial_acciones = accion.get_shares_full()
        if historial_acciones is not None and not historial_acciones.empty:
            valor = numero_valido(pd.to_numeric(historial_acciones, errors="coerce").dropna().iloc[-1])
            if valor is not None and valor > 0:
                return valor
    except Exception:
        pass

    return None


def ultimo_cierre_simbolo(simbolo: str) -> float | None:
    try:
        datos = yf.Ticker(simbolo).history(period="5d", auto_adjust=False)
        if datos.empty:
            return None
        cierres = pd.to_numeric(datos["Close"], errors="coerce").dropna()
        return numero_valido(cierres.iloc[-1]) if not cierres.empty else None
    except Exception:
        return None


def obtener_tipo_cambio(moneda_financiera: str, moneda_cotizacion: str) -> float | None:
    """
    Devuelve cuántas unidades de la moneda de cotización equivalen a una unidad
    de la moneda financiera.
    """
    origen = (moneda_financiera or "").upper()
    destino = (moneda_cotizacion or "").upper()

    if not origen or not destino or origen == destino:
        return 1.0

    clave = (origen, destino)
    if clave in CACHE_FX:
        return CACHE_FX[clave]

    directo = ultimo_cierre_simbolo(f"{origen}{destino}=X")
    if directo is not None and directo > 0:
        CACHE_FX[clave] = directo
        return directo

    inverso = ultimo_cierre_simbolo(f"{destino}{origen}=X")
    if inverso is not None and inverso > 0:
        CACHE_FX[clave] = 1.0 / inverso
        return CACHE_FX[clave]

    CACHE_FX[clave] = None
    return None


def convertir_serie(serie: pd.Series, fx: float) -> pd.Series:
    return pd.to_numeric(serie, errors="coerce") * fx


# ---------------------------------------------------------------------------
# Normalización financiera
# ---------------------------------------------------------------------------

def calcular_cagr(serie: pd.Series) -> float | None:
    valores = pd.to_numeric(serie, errors="coerce").dropna()
    valores = valores[valores > 0]
    if len(valores) < 2:
        return None

    primero = float(valores.iloc[0])
    ultimo = float(valores.iloc[-1])

    try:
        fechas = pd.to_datetime(valores.index)
        anos = (fechas[-1] - fechas[0]).days / 365.25
    except Exception:
        anos = len(valores) - 1

    if anos <= 0 or primero <= 0 or ultimo <= 0:
        return None

    return (ultimo / primero) ** (1.0 / anos) - 1.0


def estimar_tasa_impuestos(
    provision_impuestos: pd.Series,
    utilidad_antes_impuestos: pd.Series,
    config: Configuracion,
) -> float:
    alineado = alinear_series(provision_impuestos, utilidad_antes_impuestos)
    if alineado.empty:
        return config.tasa_impuestos_fallback

    alineado.columns = ["impuestos", "pretax"]
    alineado = alineado[alineado["pretax"] > 0]
    tasas = alineado["impuestos"] / alineado["pretax"]
    tasas = tasas.replace([np.inf, -np.inf], np.nan).dropna()
    tasas = tasas[(tasas >= -0.05) & (tasas <= 0.60)]

    if tasas.empty:
        return config.tasa_impuestos_fallback

    tasa = float(tasas.tail(config.max_anos_historicos).median())
    return float(np.clip(
        tasa,
        config.tasa_impuestos_minima,
        config.tasa_impuestos_maxima,
    ))


def construir_fcl(flujo: pd.DataFrame) -> tuple[pd.Series, str]:
    fcl = obtener_fila(flujo, ["Free Cash Flow"])
    if not fcl.empty:
        return fcl, "Yahoo: Free Cash Flow"

    cfo = obtener_fila(
        flujo,
        [
            "Operating Cash Flow",
            "Total Cash From Operating Activities",
            "Cash Flow From Continuing Operating Activities",
        ],
    )
    capex = obtener_fila(
        flujo,
        [
            "Capital Expenditure",
            "Capital Expenditures",
            "Purchase Of PPE",
            "Investments In Property Plant And Equipment",
        ],
    )

    alineado = alinear_series(cfo, capex)
    if alineado.empty:
        return pd.Series(dtype=float), "No disponible"

    alineado.columns = ["cfo", "capex"]
    fcl_calculado = alineado["cfo"] - alineado["capex"].abs()
    return fcl_calculado, "Calculado: CFO - |CapEx|"


def construir_ebitda(
    resultados: pd.DataFrame,
    flujo: pd.DataFrame,
    ebit: pd.Series,
) -> tuple[pd.Series, str]:
    ebitda = obtener_fila(resultados, ["EBITDA", "Normalized EBITDA"])
    if not ebitda.empty:
        return ebitda, "Yahoo: EBITDA"

    depreciacion = obtener_fila(
        flujo,
        [
            "Depreciation And Amortization",
            "Depreciation Amortization Depletion",
            "Depreciation",
        ],
    )
    alineado = alinear_series(ebit, depreciacion)
    if alineado.empty:
        return pd.Series(dtype=float), "No disponible"

    alineado.columns = ["ebit", "da"]
    return alineado["ebit"] + alineado["da"].abs(), "Calculado: EBIT + D&A"


def margen_normalizado(
    metrica: pd.Series,
    ingresos: pd.Series,
    config: Configuracion,
) -> tuple[float | None, int, float | None]:
    alineado = alinear_series(metrica, ingresos)
    if alineado.empty:
        return None, 0, None

    alineado.columns = ["metrica", "ingresos"]
    alineado = alineado[alineado["ingresos"] > 0]
    margenes = alineado["metrica"] / alineado["ingresos"]
    margenes = margenes.replace([np.inf, -np.inf], np.nan).dropna()
    margenes = margenes[(margenes > -2.0) & (margenes < 2.0)]
    margenes = margenes.tail(config.max_anos_historicos)

    if margenes.empty:
        return None, 0, None

    mediana = float(margenes.median())
    conservador = (
        mediana * config.factor_margen_conservador
        if mediana > 0
        else mediana
    )
    return conservador, len(margenes), mediana


def proyectar_valor(
    metrica_base: float | None,
    crecimiento_1_5: float,
    crecimiento_6_10: float,
    tasa_descuento: float,
    anos: int,
    multiplo_terminal: float,
) -> tuple[float | None, float | None, float | None]:
    if isinstance(anos, bool) or not isinstance(anos, int) or anos <= 0:
        raise ValueError("El horizonte en años debe ser un entero positivo.")
    parametros = [numero_valido(valor) for valor in (
        metrica_base, crecimiento_1_5, crecimiento_6_10, tasa_descuento, multiplo_terminal,
    )]
    if any(valor is None for valor in parametros):
        return None, None, None
    metrica_base, crecimiento_1_5, crecimiento_6_10, tasa_descuento, multiplo_terminal = parametros
    if metrica_base <= 0 or tasa_descuento <= -1:
        return None, None, None

    metrica = metrica_base
    pv_flujos = 0.0

    try:
        for ano in range(1, anos + 1):
            crecimiento = crecimiento_1_5 if ano <= 5 else crecimiento_6_10
            metrica *= 1.0 + crecimiento
            pv_flujos += metrica / ((1.0 + tasa_descuento) ** ano)
            if not math.isfinite(pv_flujos):
                return None, None, None

        pv_terminal = (
            metrica * multiplo_terminal
            / ((1.0 + tasa_descuento) ** anos)
        )
    except (OverflowError, ZeroDivisionError):
        return None, None, None
    total = pv_flujos + pv_terminal
    if not all(math.isfinite(valor) for valor in (total, pv_flujos, pv_terminal)):
        return None, None, None
    return total, pv_flujos, pv_terminal


def por_accion(valor_total: float | None, acciones: float | None) -> float | None:
    if valor_total is None or acciones is None or acciones <= 0:
        return None
    resultado = valor_total / acciones
    return resultado if math.isfinite(resultado) and resultado > 0 else None


def rendimiento(valor: float | None, precio: float | None) -> float | None:
    valor, precio = numero_valido(valor), numero_valido(precio)
    if valor is None or precio is None or precio <= 0:
        return None
    resultado = valor / precio - 1.0
    return resultado if math.isfinite(resultado) else None


def es_financiera(info: dict) -> bool:
    texto = " ".join(
        str(info.get(clave, ""))
        for clave in ("sector", "industry", "quoteType")
    ).lower()
    palabras = (
        "financial", "bank", "insurance", "capital markets",
        "credit services", "asset management",
    )
    return any(palabra in texto for palabra in palabras)


# ---------------------------------------------------------------------------
# Análisis por ticker
# ---------------------------------------------------------------------------

def analizar_ticker(
    ticker: str,
    config: Configuracion,
    mercado: str | None = None,
) -> tuple[dict, dict]:
    mercado = mercado or mercado_de_ticker(ticker)
    accion = yf.Ticker(ticker)
    notas: list[str] = []

    info = obtener_info_segura(accion)
    precio = obtener_precio_actual(accion)
    objetivo = obtener_objetivo_analistas(accion, info)
    acciones = obtener_acciones(accion, info, precio)

    try:
        resultados = accion.income_stmt
    except Exception:
        resultados = pd.DataFrame()

    try:
        flujo = accion.cashflow
    except Exception:
        flujo = pd.DataFrame()

    try:
        balance = accion.balance_sheet
    except Exception:
        balance = pd.DataFrame()

    ingresos = obtener_fila(
        resultados,
        ["Total Revenue", "Operating Revenue", "Revenue"],
    )
    ebit = obtener_fila(
        resultados,
        ["EBIT", "Operating Income", "Operating Income Loss"],
    )
    utilidad_neta = obtener_fila(
        resultados,
        [
            "Net Income Common Stockholders",
            "Net Income",
            "Net Income Including Noncontrolling Interests",
        ],
    )
    impuestos = obtener_fila(
        resultados,
        ["Tax Provision", "Income Tax Expense"],
    )
    pretax = obtener_fila(
        resultados,
        ["Pretax Income", "Income Before Tax", "Earnings Before Tax"],
    )

    fcl, fuente_fcl = construir_fcl(flujo)
    ebitda, fuente_ebitda = construir_ebitda(resultados, flujo, ebit)

    capex = obtener_fila(
        flujo,
        [
            "Capital Expenditure",
            "Capital Expenditures",
            "Purchase Of PPE",
            "Investments In Property Plant And Equipment",
        ],
    )

    deuda = obtener_fila(
        balance,
        ["Total Debt", "Long Term Debt And Capital Lease Obligation"],
    )
    efectivo = obtener_fila(
        balance,
        [
            "Cash Cash Equivalents And Short Term Investments",
            "Cash And Short Term Investments",
            "Cash And Cash Equivalents",
        ],
    )

    moneda_financiera = str(
        info.get("financialCurrency")
        or info.get("currency")
        or "USD"
    ).upper()
    moneda_cotizacion = str(info.get("currency") or "USD").upper()
    fx = obtener_tipo_cambio(moneda_financiera, moneda_cotizacion)

    if fx is None:
        fx = 1.0
        notas.append(
            f"No se encontró FX {moneda_financiera}/{moneda_cotizacion}; "
            "se usó 1.0."
        )
    elif moneda_financiera != moneda_cotizacion:
        notas.append(
            f"Estados convertidos de {moneda_financiera} a "
            f"{moneda_cotizacion} con FX {fx:.6f}."
        )

    # Convertir estados a la moneda en la que cotiza la acción.
    ingresos = convertir_serie(ingresos, fx)
    ebit = convertir_serie(ebit, fx)
    utilidad_neta = convertir_serie(utilidad_neta, fx)
    impuestos = convertir_serie(impuestos, fx)
    pretax = convertir_serie(pretax, fx)
    fcl = convertir_serie(fcl, fx)
    ebitda = convertir_serie(ebitda, fx)
    capex = convertir_serie(capex, fx)
    deuda = convertir_serie(deuda, fx)
    efectivo = convertir_serie(efectivo, fx)

    tasa_impuestos = estimar_tasa_impuestos(impuestos, pretax, config)

    # EBIT se transforma a NOPAT.
    nopat = ebit * (1.0 - tasa_impuestos)

    # Proxy de caja basado en EBITDA:
    # EBITDA - impuestos sobre EBIT - mantenimiento (aprox. CapEx).
    alineado_ebitda = alinear_series(ebitda, ebit, capex)
    if not alineado_ebitda.empty:
        alineado_ebitda.columns = ["ebitda", "ebit", "capex"]
        ebitda_ajustado = (
            alineado_ebitda["ebitda"]
            - alineado_ebitda["ebit"].clip(lower=0) * tasa_impuestos
            - alineado_ebitda["capex"].abs()
        )
        fuente_ebitda_ajustado = (
            f"{fuente_ebitda}; EBITDA - impuestos EBIT - |CapEx|"
        )
    else:
        ebitda_ajustado = pd.Series(dtype=float)
        fuente_ebitda_ajustado = "No disponible"

    ingreso_actual = ultimo_valor(ingresos)

    cagr = calcular_cagr(ingresos)
    if cagr is None:
        crecimiento_info = numero_valido(info.get("revenueGrowth"))
        if crecimiento_info is not None:
            cagr = crecimiento_info
            notas.append("CAGR no disponible; se usó revenueGrowth de Yahoo.")
        else:
            cagr = config.crecimiento_fallback
            notas.append("Crecimiento no disponible; se usó fallback de 3 %.")

    crecimiento_1_5 = float(np.clip(
        cagr * config.factor_crecimiento_inicial,
        config.crecimiento_minimo,
        config.crecimiento_maximo,
    ))
    crecimiento_6_10 = crecimiento_1_5 * config.factor_crecimiento_final

    margen_fcl, anos_fcl, margen_fcl_sin_descuento = margen_normalizado(
        fcl, ingresos, config
    )
    margen_ebit, anos_ebit, margen_ebit_sin_descuento = margen_normalizado(
        nopat, ingresos, config
    )
    margen_ebitda, anos_ebitda, margen_ebitda_sin_descuento = margen_normalizado(
        ebitda_ajustado, ingresos, config
    )
    margen_neto, anos_neto, margen_neto_sin_descuento = margen_normalizado(
        utilidad_neta, ingresos, config
    )

    base_fcl = ingreso_actual * margen_fcl if ingreso_actual and margen_fcl else None
    base_ebit = ingreso_actual * margen_ebit if ingreso_actual and margen_ebit else None
    base_ebitda = (
        ingreso_actual * margen_ebitda
        if ingreso_actual and margen_ebitda
        else None
    )
    base_neto = (
        ingreso_actual * margen_neto
        if ingreso_actual and margen_neto
        else None
    )

    deuda_actual = ultimo_valor(deuda)
    efectivo_actual = ultimo_valor(efectivo)

    if deuda_actual is None:
        deuda_actual = numero_valido(info.get("totalDebt"))
        if deuda_actual is not None:
            deuda_actual *= fx

    if efectivo_actual is None:
        efectivo_actual = numero_valido(info.get("totalCash"))
        if efectivo_actual is not None:
            efectivo_actual *= fx

    deuda_actual = deuda_actual or 0.0
    efectivo_actual = efectivo_actual or 0.0
    deuda_neta = deuda_actual - efectivo_actual

    valor_fcl_total, pv_fcl, terminal_fcl = proyectar_valor(
        base_fcl,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_fcl,
    )

    valor_ebit_empresa, pv_ebit, terminal_ebit = proyectar_valor(
        base_ebit,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_ebit,
    )

    valor_ebitda_empresa, pv_ebitda, terminal_ebitda = proyectar_valor(
        base_ebitda,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_ebitda,
    )

    valor_neto_total, pv_neto, terminal_neto = proyectar_valor(
        base_neto,
        crecimiento_1_5,
        crecimiento_6_10,
        config.tasa_descuento,
        config.anos_proyeccion,
        config.multiplo_terminal_utilidad_neta,
    )

    financiera = es_financiera(info)

    # FCL y utilidad neta se consideran flujos del accionista.
    # EBIT/NOPAT y EBITDA ajustado se consideran valores de empresa.
    valor_ebit_capital = (
        valor_ebit_empresa - deuda_neta
        if valor_ebit_empresa is not None
        else None
    )
    valor_ebitda_capital = (
        valor_ebitda_empresa - deuda_neta
        if valor_ebitda_empresa is not None
        else None
    )

    if financiera:
        notas.append(
            "Empresa financiera: deuda, FCL, EBIT y EBITDA no son directamente "
            "comparables con compañías industriales; priorizar utilidad neta."
        )

    valor_fcl_accion = por_accion(valor_fcl_total, acciones)
    valor_ebit_accion = por_accion(valor_ebit_capital, acciones)
    valor_ebitda_accion = por_accion(valor_ebitda_capital, acciones)
    valor_neto_accion = por_accion(valor_neto_total, acciones)

    valores_modelos = [
        valor for valor in (
            valor_fcl_accion,
            valor_ebit_accion,
            valor_ebitda_accion,
            valor_neto_accion,
        )
        if valor is not None
    ]
    mediana_modelos = (
        float(np.median(valores_modelos))
        if valores_modelos
        else None
    )

    if ingreso_actual is None:
        notas.append("Ingresos no disponibles.")
    if acciones is None:
        notas.append("Acciones en circulación no disponibles.")
    if precio is None:
        notas.append("Precio de mercado no disponible.")
    if margen_fcl is None or margen_fcl <= 0:
        notas.append("FCL normalizado no positivo o no disponible.")
    if margen_ebit is None or margen_ebit <= 0:
        notas.append("NOPAT normalizado no positivo o no disponible.")
    if margen_ebitda is None or margen_ebitda <= 0:
        notas.append("EBITDA ajustado no positivo o no disponible.")
    if margen_neto is None or margen_neto <= 0:
        notas.append("Utilidad neta normalizada no positiva o no disponible.")
    if objetivo is None:
        notas.append("Precio objetivo de analistas no disponible.")

    estado = "OK"
    if precio is None or acciones is None or ingreso_actual is None:
        estado = "DATOS INCOMPLETOS"
    elif len(valores_modelos) < 2:
        estado = "REVISAR"

    nombre = (
        info.get("shortName")
        or info.get("longName")
        or ticker
    )

    principal = {
        "Mercado": mercado,
        "Ticker": ticker,
        "Empresa": nombre,
        "Moneda": moneda_cotizacion,
        "Precio de mercado": precio,
        "Valor intrínseco FCL": valor_fcl_accion,
        "Upside FCL": rendimiento(valor_fcl_accion, precio),
        "Valor intrínseco EBIT": valor_ebit_accion,
        "Upside EBIT": rendimiento(valor_ebit_accion, precio),
        "Valor intrínseco EBITDA": valor_ebitda_accion,
        "Upside EBITDA": rendimiento(valor_ebitda_accion, precio),
        "Valor intrínseco utilidad neta": valor_neto_accion,
        "Upside utilidad neta": rendimiento(valor_neto_accion, precio),
        "Mediana de modelos": mediana_modelos,
        "Upside mediana": rendimiento(mediana_modelos, precio),
        "Precio objetivo analistas": objetivo,
        "Upside analistas": rendimiento(objetivo, precio),
        "Estado": estado,
        "Notas": " ".join(notas),
    }

    detalle = {
        "Mercado": mercado,
        "Ticker": ticker,
        "Empresa": nombre,
        "Sector": info.get("sector"),
        "Industria": info.get("industry"),
        "Moneda estados": moneda_financiera,
        "Moneda cotización": moneda_cotizacion,
        "Tipo de cambio": fx,
        "Ingresos actuales": ingreso_actual,
        "Acciones en circulación": acciones,
        "Deuda": deuda_actual,
        "Efectivo": efectivo_actual,
        "Deuda neta": deuda_neta,
        "Tasa de impuestos": tasa_impuestos,
        "CAGR histórico ingresos": cagr,
        "Crecimiento años 1-5": crecimiento_1_5,
        "Crecimiento años 6-10": crecimiento_6_10,
        "Margen FCL mediano": margen_fcl_sin_descuento,
        "Margen FCL conservador": margen_fcl,
        "Años FCL": anos_fcl,
        "Fuente FCL": fuente_fcl,
        "Margen NOPAT mediano": margen_ebit_sin_descuento,
        "Margen NOPAT conservador": margen_ebit,
        "Años EBIT": anos_ebit,
        "Margen EBITDA ajustado mediano": margen_ebitda_sin_descuento,
        "Margen EBITDA ajustado conservador": margen_ebitda,
        "Años EBITDA": anos_ebitda,
        "Fuente EBITDA ajustado": fuente_ebitda_ajustado,
        "Margen neto mediano": margen_neto_sin_descuento,
        "Margen neto conservador": margen_neto,
        "Años utilidad neta": anos_neto,
        "Base FCL": base_fcl,
        "Base NOPAT": base_ebit,
        "Base EBITDA ajustado": base_ebitda,
        "Base utilidad neta": base_neto,
        "PV flujos FCL": pv_fcl,
        "PV terminal FCL": terminal_fcl,
        "PV flujos EBIT": pv_ebit,
        "PV terminal EBIT": terminal_ebit,
        "PV flujos EBITDA": pv_ebitda,
        "PV terminal EBITDA": terminal_ebitda,
        "PV flujos utilidad neta": pv_neto,
        "PV terminal utilidad neta": terminal_neto,
        "Empresa financiera": financiera,
        "Notas": " ".join(notas),
    }

    return principal, detalle


# ---------------------------------------------------------------------------
# Excel
# ---------------------------------------------------------------------------

def escribir_excel(
    principales: list[dict],
    detalles: list[dict],
    archivo_salida: Path,
    config: Configuracion,
) -> None:
    """Genera un libro legible en Excel con hojas separadas por mercado."""
    archivo_salida = Path(archivo_salida)
    archivo_salida.parent.mkdir(parents=True, exist_ok=True)

    df_principal = pd.DataFrame(principales).reindex(columns=COLUMNAS_PRINCIPAL)
    df_detalle = pd.DataFrame(detalles).reindex(columns=COLUMNAS_DETALLE)
    df_principal = df_principal.replace([np.inf, -np.inf], np.nan)
    df_detalle = df_detalle.replace([np.inf, -np.inf], np.nan)

    if not df_principal.empty:
        df_principal = df_principal.sort_values(
            by=["Mercado", "Upside mediana"],
            ascending=[True, False],
            na_position="last",
        )

    if not df_detalle.empty and "Mercado" in df_detalle.columns:
        df_detalle = df_detalle.sort_values(["Mercado", "Ticker"])

    df_usa = df_principal[df_principal["Mercado"] == "USA"].copy()
    df_mx = df_principal[df_principal["Mercado"] == "MX"].copy()

    df_supuestos = pd.DataFrame(
        [
            ("Años de proyección", config.anos_proyeccion, "Años"),
            ("Tasa de descuento", config.tasa_descuento, "%"),
            ("Factor crecimiento años 1-5", config.factor_crecimiento_inicial, "% del CAGR histórico"),
            ("Factor crecimiento años 6-10", config.factor_crecimiento_final, "% del crecimiento inicial"),
            ("Crecimiento mínimo", config.crecimiento_minimo, "%"),
            ("Crecimiento máximo", config.crecimiento_maximo, "%"),
            ("Crecimiento fallback", config.crecimiento_fallback, "%"),
            ("Factor margen conservador", config.factor_margen_conservador, "% de la mediana histórica"),
            ("Múltiplo terminal FCL", config.multiplo_terminal_fcl, "x"),
            ("Múltiplo terminal EBIT/NOPAT", config.multiplo_terminal_ebit, "x"),
            ("Múltiplo terminal EBITDA ajustado", config.multiplo_terminal_ebitda, "x"),
            ("Múltiplo terminal utilidad neta", config.multiplo_terminal_utilidad_neta, "x"),
            ("Tratamiento FCL", "Flujo del accionista; no se resta deuda neta", ""),
            ("Tratamiento EBIT", "NOPAT; se resta deuda neta", ""),
            ("Tratamiento EBITDA", "EBITDA - impuestos sobre EBIT - |CapEx|; se resta deuda neta", ""),
            ("Tratamiento utilidad neta", "Flujo del accionista; no se resta deuda neta", ""),
        ],
        columns=["Supuesto", "Valor", "Unidad / comentario"],
    )

    universo = []
    for mercado, tickers in (("USA", EMPRESAS_USA), ("MX", EMPRESAS_MX)):
        for orden, ticker in enumerate(tickers, start=1):
            universo.append({"Mercado": mercado, "Orden": orden, "Ticker": ticker})
    df_universo = pd.DataFrame(universo)
    df_fuentes = pd.DataFrame(FUENTES_UNIVERSO)

    hojas = {
        "Resumen": df_principal,
        "USA": df_usa,
        "MX": df_mx,
        "Detalle": df_detalle,
        "Supuestos": df_supuestos,
        "Universo": df_universo,
        "Fuentes": df_fuentes,
    }

    with pd.ExcelWriter(archivo_salida, engine="openpyxl") as writer:
        for nombre, df in hojas.items():
            df.to_excel(writer, sheet_name=nombre, index=False, startrow=2)

    libro = load_workbook(archivo_salida)

    azul_oscuro = "17365D"
    azul = "4472C4"
    blanco = "FFFFFF"
    amarillo = "FFF2CC"
    verde_claro = "E2F0D9"
    rojo_claro = "FCE4D6"
    borde_fino = Side(style="thin", color="D9E1F2")

    formato_moneda = '$#,##0.00;[Red]($#,##0.00);-'
    formato_numero = '#,##0.00;[Red](#,##0.00);-'
    formato_entero = '#,##0;[Red](#,##0);-'
    formato_porcentaje = '0.0%;[Red](0.0%);-'
    formato_multiplo = '0.0x'
    formato_fx = '0.000000'

    fecha_generacion = pd.Timestamp.now().strftime("%Y-%m-%d %H:%M")
    tablas = {
        "Resumen": "TablaResumen",
        "USA": "TablaUSA",
        "MX": "TablaMX",
        "Detalle": "TablaDetalle",
        "Supuestos": "TablaSupuestos",
        "Universo": "TablaUniverso",
        "Fuentes": "TablaFuentes",
    }

    for hoja in libro.worksheets:
        hoja.sheet_view.showGridLines = False
        hoja.freeze_panes = "D4" if hoja.title in {"Resumen", "USA", "MX"} else "A4"
        ultima_columna = max(1, hoja.max_column)
        hoja.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ultima_columna)
        titulo = hoja.cell(row=1, column=1)
        titulo.value = f"{hoja.title} — generado {fecha_generacion}"
        titulo.fill = PatternFill("solid", fgColor=azul_oscuro)
        titulo.font = Font(color=blanco, bold=True, size=14)
        titulo.alignment = Alignment(horizontal="left", vertical="center")
        hoja.row_dimensions[1].height = 25

        for celda in hoja[3]:
            celda.fill = PatternFill("solid", fgColor=azul)
            celda.font = Font(color=blanco, bold=True)
            celda.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            celda.border = Border(bottom=borde_fino)
        hoja.row_dimensions[3].height = 38

        if hoja.max_row >= 4 and hoja.max_column >= 1:
            ref = f"A3:{get_column_letter(hoja.max_column)}{hoja.max_row}"
            tabla = Table(displayName=tablas[hoja.title], ref=ref)
            tabla.tableStyleInfo = TableStyleInfo(
                name="TableStyleMedium2",
                showFirstColumn=False,
                showLastColumn=False,
                showRowStripes=True,
                showColumnStripes=False,
            )
            hoja.add_table(tabla)

        for fila in hoja.iter_rows(min_row=4):
            for celda in fila:
                celda.alignment = Alignment(vertical="top")

    columnas_moneda = {
        "Precio de mercado", "Valor intrínseco FCL", "Valor intrínseco EBIT",
        "Valor intrínseco EBITDA", "Valor intrínseco utilidad neta",
        "Mediana de modelos", "Precio objetivo analistas",
    }
    columnas_porcentaje = {
        "Upside FCL", "Upside EBIT", "Upside EBITDA", "Upside utilidad neta",
        "Upside mediana", "Upside analistas",
    }

    for nombre_hoja in ("Resumen", "USA", "MX"):
        ws = libro[nombre_hoja]
        encabezados = {celda.value: celda.column for celda in ws[3]}
        for nombre in columnas_moneda:
            columna = encabezados.get(nombre)
            if columna:
                for fila in range(4, ws.max_row + 1):
                    ws.cell(fila, columna).number_format = formato_moneda
        for nombre in columnas_porcentaje:
            columna = encabezados.get(nombre)
            if columna:
                letra = get_column_letter(columna)
                for fila in range(4, ws.max_row + 1):
                    ws.cell(fila, columna).number_format = formato_porcentaje
                if ws.max_row >= 4:
                    ws.conditional_formatting.add(
                        f"{letra}4:{letra}{ws.max_row}",
                        ColorScaleRule(
                            start_type="num", start_value=-0.30, start_color="F8696B",
                            mid_type="num", mid_value=0.00, mid_color="FFEB84",
                            end_type="num", end_value=0.50, end_color="63BE7B",
                        ),
                    )
        columna_estado = encabezados.get("Estado")
        if columna_estado:
            for fila in range(4, ws.max_row + 1):
                celda = ws.cell(fila, columna_estado)
                if celda.value == "OK":
                    celda.fill = PatternFill("solid", fgColor=verde_claro)
                elif celda.value == "REVISAR":
                    celda.fill = PatternFill("solid", fgColor=amarillo)
                else:
                    celda.fill = PatternFill("solid", fgColor=rojo_claro)

    ws_detalle = libro["Detalle"]
    encabezados_detalle = {celda.value: celda.column for celda in ws_detalle[3]}
    porcentaje_detalle = {
        "Tasa de impuestos", "CAGR histórico ingresos", "Crecimiento años 1-5",
        "Crecimiento años 6-10", "Margen FCL mediano", "Margen FCL conservador",
        "Margen NOPAT mediano", "Margen NOPAT conservador",
        "Margen EBITDA ajustado mediano", "Margen EBITDA ajustado conservador",
        "Margen neto mediano", "Margen neto conservador",
    }
    numero_detalle = {
        "Ingresos actuales", "Acciones en circulación", "Deuda", "Efectivo", "Deuda neta",
        "Base FCL", "Base NOPAT", "Base EBITDA ajustado", "Base utilidad neta",
        "PV flujos FCL", "PV terminal FCL", "PV flujos EBIT", "PV terminal EBIT",
        "PV flujos EBITDA", "PV terminal EBITDA", "PV flujos utilidad neta",
        "PV terminal utilidad neta",
    }
    for nombre, columna in encabezados_detalle.items():
        if nombre in porcentaje_detalle:
            formato = formato_porcentaje
        elif nombre == "Tipo de cambio":
            formato = formato_fx
        elif isinstance(nombre, str) and nombre.startswith("Años"):
            formato = formato_entero
        elif nombre in numero_detalle:
            formato = formato_numero
        else:
            formato = None
        if formato:
            for fila in range(4, ws_detalle.max_row + 1):
                ws_detalle.cell(fila, columna).number_format = formato

    ws_sup = libro["Supuestos"]
    for fila in range(4, ws_sup.max_row + 1):
        celda = ws_sup.cell(fila, 2)
        supuesto = str(ws_sup.cell(fila, 1).value or "")
        celda.fill = PatternFill("solid", fgColor=amarillo)
        celda.font = Font(color="0000FF")
        if isinstance(celda.value, (int, float)):
            if any(p in supuesto for p in ("Tasa", "Factor", "Crecimiento")):
                celda.number_format = formato_porcentaje
            elif "Múltiplo" in supuesto:
                celda.number_format = formato_multiplo
            else:
                celda.number_format = formato_numero

    for hoja in libro.worksheets:
        for columna in range(1, hoja.max_column + 1):
            letra = get_column_letter(columna)
            max_len = 0
            for fila in range(3, min(hoja.max_row, 120) + 1):
                valor = hoja.cell(fila, columna).value
                max_len = max(max_len, len(str(valor)) if valor is not None else 0)
            hoja.column_dimensions[letra].width = min(max(max_len + 2, 10), 34)

    for nombre_hoja in ("Resumen", "USA", "MX"):
        ws = libro[nombre_hoja]
        encabezados = {celda.value: celda.column for celda in ws[3]}
        columna_notas = encabezados.get("Notas")
        if columna_notas:
            letra = get_column_letter(columna_notas)
            ws.column_dimensions[letra].width = 60
            for fila in range(4, ws.max_row + 1):
                ws.cell(fila, columna_notas).alignment = Alignment(wrap_text=True, vertical="top")

    if "Notas" in encabezados_detalle:
        columna = encabezados_detalle["Notas"]
        letra = get_column_letter(columna)
        ws_detalle.column_dimensions[letra].width = 65
        for fila in range(4, ws_detalle.max_row + 1):
            ws_detalle.cell(fila, columna).alignment = Alignment(wrap_text=True, vertical="top")

    libro.save(archivo_salida)


# ---------------------------------------------------------------------------
# Ejecución
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Valora acciones de USA y México y genera un archivo Excel."
    )
    parser.add_argument(
        "--output",
        default="valoraciones_empresas.xlsx",
        help="Ruta del archivo .xlsx de salida.",
    )
    parser.add_argument(
        "--mercado",
        choices=["USA", "MX", "TODOS"],
        default="TODOS",
        help="Universo predeterminado cuando no se indican tickers.",
    )
    parser.add_argument(
        "--ticker",
        action="append",
        dest="tickers",
        help="Ticker específico. Puede repetirse.",
    )
    argumentos = parser.parse_args()

    if argumentos.tickers:
        tickers = eliminar_duplicados(argumentos.tickers)
    elif argumentos.mercado == "USA":
        tickers = EMPRESAS_USA
    elif argumentos.mercado == "MX":
        tickers = EMPRESAS_MX
    else:
        tickers = EMPRESAS

    salida = Path(argumentos.output).expanduser().resolve()
    principales: list[dict] = []
    detalles: list[dict] = []

    print(f"Analizando {len(tickers)} empresas...")
    for posicion, ticker in enumerate(tickers, start=1):
        print(f"[{posicion:02d}/{len(tickers):02d}] {ticker}...", end=" ", flush=True)
        mercado = mercado_de_ticker(ticker)
        try:
            principal, detalle = analizar_ticker(ticker, CONFIG, mercado)
            principales.append(principal)
            detalles.append(detalle)
            print(principal["Estado"])
        except Exception as exc:
            print(f"ERROR: {exc}")
            principal, detalle = crear_resultado_error(ticker, exc)
            principales.append(principal)
            detalles.append(detalle)
        time.sleep(CONFIG.pausa_entre_tickers)

    escribir_excel(principales, detalles, salida, CONFIG)
    print(f"\nArchivo generado: {salida}")


if __name__ == "__main__":
    main()
