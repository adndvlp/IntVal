"""Único adaptador de yfinance, compartido por análisis e históricos."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd
import yfinance as yf

from ..modelos import DatosEmpresa, TrazabilidadDatos
from ..normalizacion import numero_valido


CACHE_FX: dict[tuple[str, str], float | None] = {}


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

def _fecha_indice(indice, posicion=-1) -> str | None:
    if isinstance(indice, pd.DatetimeIndex) and len(indice):
        return indice[posicion].isoformat()
    return None


def _ahora_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _precio_con_fuente(accion):
    try:
        fast_info = accion.fast_info
        for clave in ("last_price", "lastPrice", "regular_market_price"):
            try:
                valor = numero_valido(fast_info[clave])
            except Exception:
                valor = None
            if valor is not None and valor > 0:
                return valor, f"fast_info.{clave}", None
    except Exception:
        pass
    try:
        historia = accion.history(period="5d", auto_adjust=False)
        if historia is not None and not historia.empty:
            cierres = pd.to_numeric(historia["Close"], errors="coerce").dropna()
            if not cierres.empty:
                valor = numero_valido(cierres.iloc[-1])
                if valor is not None and valor > 0:
                    return valor, "history.Close", _fecha_indice(cierres.index)
    except Exception:
        pass
    return None, None, None


def obtener_precio_actual(accion: yf.Ticker) -> float | None:
    return _precio_con_fuente(accion)[0]

def _objetivo_con_fuente(accion, info):
    try:
        objetivos = accion.analyst_price_targets
        if isinstance(objetivos, dict):
            for clave in ("mean", "median"):
                valor = numero_valido(objetivos.get(clave))
                if valor is not None and valor > 0:
                    return valor, f"analyst_price_targets.{clave}", clave
    except Exception:
        pass
    for clave, estadistico in (("targetMeanPrice", "mean"), ("targetMedianPrice", "median")):
        valor = numero_valido(info.get(clave))
        if valor is not None and valor > 0:
            return valor, f"info.{clave}", estadistico
    return None, None, None


def obtener_objetivo_analistas(accion: yf.Ticker, info: dict) -> float | None:
    return _objetivo_con_fuente(accion, info)[0]

def _acciones_con_fuente(accion: yf.Ticker, info: dict, precio: float | None):
    for clave in ("sharesOutstanding", "impliedSharesOutstanding"):
        valor = numero_valido(info.get(clave))
        if valor is not None and valor > 0:
            return valor, f"info.{clave}", None

    try:
        fast_info = accion.fast_info
        for clave in ("shares", "shares_outstanding"):
            try:
                valor = numero_valido(fast_info[clave])
            except Exception:
                valor = None
            if valor is not None and valor > 0:
                return valor, f"fast_info.{clave}", None
    except Exception:
        pass

    market_cap = numero_valido(info.get("marketCap"))
    if market_cap and precio and precio > 0:
        return market_cap / precio, "Calculado: info.marketCap / precio", None

    try:
        historial_acciones = accion.get_shares_full()
        if historial_acciones is not None and not historial_acciones.empty:
            valores = pd.to_numeric(historial_acciones, errors="coerce").dropna()
            valor = numero_valido(valores.iloc[-1])
            if valor is not None and valor > 0:
                return valor, "get_shares_full", _fecha_indice(valores.index)
    except Exception:
        pass

    return None, None, None

def obtener_acciones(accion: yf.Ticker, info: dict, precio: float | None) -> float | None:
    return _acciones_con_fuente(accion, info, precio)[0]


def _cierre_con_fecha(simbolo: str, *, ticker_factory=None):
    try:
        datos = (ticker_factory or yf.Ticker)(simbolo).history(period="5d", auto_adjust=False)
        if datos is not None and not datos.empty:
            cierres = pd.to_numeric(datos["Close"], errors="coerce").dropna()
            if not cierres.empty:
                return numero_valido(cierres.iloc[-1]), _fecha_indice(cierres.index)
    except Exception:
        pass
    return None, None


def ultimo_cierre_simbolo(simbolo: str, *, ticker_factory=None) -> float | None:
    return _cierre_con_fecha(simbolo, ticker_factory=ticker_factory)[0]

def _obtener_tipo_cambio(moneda_financiera: str, moneda_cotizacion: str, cache: dict, obtener_cierre) -> float | None:
    """
    Devuelve cuántas unidades de la moneda de cotización equivalen a una unidad
    de la moneda financiera.
    """
    origen = (moneda_financiera or "").upper()
    destino = (moneda_cotizacion or "").upper()

    if not origen or not destino:
        return None
    if origen == destino:
        return 1.0

    clave = (origen, destino)
    if clave in cache:
        return cache[clave]

    directo = obtener_cierre(f"{origen}{destino}=X")
    if directo is not None and directo > 0:
        cache[clave] = directo
        return directo

    inverso = obtener_cierre(f"{destino}{origen}=X")
    if inverso is not None and inverso > 0:
        cache[clave] = 1.0 / inverso
        return cache[clave]

    cache[clave] = None
    return None


def obtener_tipo_cambio(moneda_financiera: str, moneda_cotizacion: str) -> float | None:
    return _obtener_tipo_cambio(moneda_financiera, moneda_cotizacion, CACHE_FX, ultimo_cierre_simbolo)


def _estado_seguro(accion, nombre: str) -> pd.DataFrame:
    try:
        estado = getattr(accion, nombre)
    except Exception:
        return pd.DataFrame()
    return pd.DataFrame() if estado is None else estado


def _monedas(info: dict) -> tuple[str | None, str | None]:
    financiera = str(info.get("financialCurrency")).strip().upper() if info.get("financialCurrency") else None
    cotizacion = str(info.get("currency")).strip().upper() if info.get("currency") else None
    return financiera, cotizacion


class ProveedorYahoo:
    def __init__(self, *, ticker_factory=None, cache_fx=None):
        self._ticker_factory = ticker_factory
        self._cache_fx = {} if cache_fx is None else cache_fx
        self._trazas_fx = {}

    def _ticker(self, ticker: str):
        return (self._ticker_factory or yf.Ticker)(ticker)

    def _tipo_cambio(self, financiera, cotizacion) -> float | None:
        clave = (financiera, cotizacion)
        cacheado = clave in self._cache_fx
        consultas = []
        def cierre(simbolo):
            valor, fecha = _cierre_con_fecha(simbolo, ticker_factory=self._ticker)
            consultas.append((simbolo, valor, fecha))
            return valor
        valor = _obtener_tipo_cambio(financiera, cotizacion, self._cache_fx, cierre)
        if financiera and financiera == cotizacion:
            meta = dict(fuente=f"Identidad {financiera}/{cotizacion}", obtenido_en=None, fecha=None)
        elif cacheado:
            anterior = self._trazas_fx.get(clave)
            meta = anterior if anterior and anterior.get('valor') == valor else dict(fuente="Caché suministrada; fecha desconocida", obtenido_en=None, fecha=None)
        elif valor is not None:
            simbolo, _, fecha = next(c for c in consultas if c[1] is not None and c[1] > 0)
            meta = dict(fuente=f"history.Close {simbolo}" + (" (inverso)" if simbolo != f"{financiera}{cotizacion}=X" else ""), obtenido_en=_ahora_utc(), fecha=fecha)
        else:
            meta = dict(fuente="FX no disponible", obtenido_en=None, fecha=None)
        self._trazas_fx[clave] = {**meta, 'valor': valor}
        return valor

    def _trazabilidad(self, info, financiera, cotizacion, fuente_precio=None, fecha_precio=None, fuente_objetivo=None, estadistico=None, fuente_acciones=None, fecha_acciones=None):
        fx = self._trazas_fx.get((financiera, cotizacion), {})
        cobertura = numero_valido(info.get('numberOfAnalystOpinions'))
        return TrazabilidadDatos(
            fuente="Yahoo Finance vía yfinance", obtenido_en=_ahora_utc(),
            fuente_precio=fuente_precio, fecha_precio=fecha_precio,
            fuente_objetivo=fuente_objetivo, estadistico_objetivo=estadistico,
            fuente_acciones=fuente_acciones, fecha_acciones=fecha_acciones,
            cobertura_analistas=int(cobertura) if cobertura is not None and cobertura > 0 and cobertura.is_integer() else None,
            fuente_fx=fx.get('fuente'), fx_obtenido_en=fx.get('obtenido_en'), fecha_fx=fx.get('fecha'),
        )

    def obtener_empresa(self, ticker: str) -> DatosEmpresa:
        accion = self._ticker(ticker)
        info = obtener_info_segura(accion)
        precio, fuente_precio, fecha_precio = _precio_con_fuente(accion)
        objetivo, fuente_objetivo, estadistico = _objetivo_con_fuente(accion, info)
        acciones, fuente_acciones, fecha_acciones = _acciones_con_fuente(accion, info, precio)
        resultados = _estado_seguro(accion, "income_stmt")
        flujo = _estado_seguro(accion, "cashflow")
        balance = _estado_seguro(accion, "balance_sheet")
        financiera, cotizacion = _monedas(info)
        fx = self._tipo_cambio(financiera, cotizacion)
        return DatosEmpresa(
            ticker=ticker, info=info, precio=precio, objetivo_analistas=objetivo,
            acciones=acciones, resultados=resultados, flujo=flujo, balance=balance,
            moneda_financiera=financiera, moneda_cotizacion=cotizacion, tipo_cambio=fx,
            trazabilidad=self._trazabilidad(info, financiera, cotizacion, fuente_precio, fecha_precio, fuente_objetivo, estadistico, fuente_acciones, fecha_acciones),
        )

    def obtener_estados_historicos(self, ticker: str) -> DatosEmpresa:
        accion = self._ticker(ticker)
        info = obtener_info_segura(accion)
        resultados = _estado_seguro(accion, "income_stmt")
        flujo = _estado_seguro(accion, "cashflow")
        financiera, cotizacion = _monedas(info)
        fx = self._tipo_cambio(financiera, cotizacion)
        return DatosEmpresa(
            ticker=ticker, info=info, resultados=resultados, flujo=flujo,
            moneda_financiera=financiera, moneda_cotizacion=cotizacion, tipo_cambio=fx,
            trazabilidad=self._trazabilidad(info, financiera, cotizacion),
        )

    def obtener_precio_historico(self, ticker: str, periodo: str) -> pd.DataFrame:
        accion = self._ticker(ticker)
        historia = accion.history(period=periodo, auto_adjust=True)
        if historia is None or historia.empty:
            return pd.DataFrame(columns=["Fecha", "Cierre"])
        historia = historia.reset_index()
        fecha_col = "Date" if "Date" in historia.columns else historia.columns[0]
        return pd.DataFrame(
            {
                "Fecha": pd.to_datetime(historia[fecha_col]).dt.tz_localize(None),
                "Cierre": pd.to_numeric(historia["Close"], errors="coerce"),
            }
        ).dropna()


PROVEEDOR_YAHOO = ProveedorYahoo(cache_fx=CACHE_FX)
