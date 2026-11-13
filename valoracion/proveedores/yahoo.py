"""Único adaptador de yfinance, compartido por análisis e históricos."""

from __future__ import annotations

import pandas as pd
import yfinance as yf

from ..modelos import DatosEmpresa
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

def ultimo_cierre_simbolo(simbolo: str, *, ticker_factory=None) -> float | None:
    try:
        datos = (ticker_factory or yf.Ticker)(simbolo).history(period="5d", auto_adjust=False)
        if datos.empty:
            return None
        cierres = pd.to_numeric(datos["Close"], errors="coerce").dropna()
        return numero_valido(cierres.iloc[-1]) if not cierres.empty else None
    except Exception:
        return None

def _obtener_tipo_cambio(moneda_financiera: str, moneda_cotizacion: str, cache: dict, obtener_cierre) -> float | None:
    """
    Devuelve cuántas unidades de la moneda de cotización equivalen a una unidad
    de la moneda financiera.
    """
    origen = (moneda_financiera or "").upper()
    destino = (moneda_cotizacion or "").upper()

    if not origen or not destino or origen == destino:
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


def _monedas(info: dict) -> tuple[str, str]:
    financiera = str(info.get("financialCurrency") or info.get("currency") or "USD").upper()
    cotizacion = str(info.get("currency") or "USD").upper()
    return financiera, cotizacion


class ProveedorYahoo:
    def __init__(self, *, ticker_factory=None, cache_fx=None):
        self._ticker_factory = ticker_factory
        self._cache_fx = {} if cache_fx is None else cache_fx

    def _ticker(self, ticker: str):
        return (self._ticker_factory or yf.Ticker)(ticker)

    def _tipo_cambio(self, financiera: str, cotizacion: str) -> float | None:
        def cierre(simbolo):
            return ultimo_cierre_simbolo(simbolo, ticker_factory=self._ticker)
        return _obtener_tipo_cambio(financiera, cotizacion, self._cache_fx, cierre)

    def obtener_empresa(self, ticker: str) -> DatosEmpresa:
        accion = self._ticker(ticker)
        info = obtener_info_segura(accion)
        precio = obtener_precio_actual(accion)
        objetivo = obtener_objetivo_analistas(accion, info)
        acciones = obtener_acciones(accion, info, precio)
        resultados = _estado_seguro(accion, "income_stmt")
        flujo = _estado_seguro(accion, "cashflow")
        balance = _estado_seguro(accion, "balance_sheet")
        financiera, cotizacion = _monedas(info)
        fx = self._tipo_cambio(financiera, cotizacion)
        return DatosEmpresa(
            ticker=ticker, info=info, precio=precio, objetivo_analistas=objetivo,
            acciones=acciones, resultados=resultados, flujo=flujo, balance=balance,
            moneda_financiera=financiera, moneda_cotizacion=cotizacion, tipo_cambio=fx,
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
