from __future__ import annotations

import math
import tempfile
import time
from dataclasses import asdict
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf

from motor_valoracion import (
    COLUMNAS_DETALLE,
    COLUMNAS_PRINCIPAL,
    EMPRESAS_MX,
    EMPRESAS_USA,
    Configuracion,
    alinear_series,
    analizar_ticker,
    construir_ebitda,
    construir_fcl,
    convertir_serie,
    crear_resultado_error,
    escribir_excel,
    estimar_tasa_impuestos,
    mercado_de_ticker,
    obtener_fila,
    obtener_info_segura,
    obtener_tipo_cambio,
)


st.set_page_config(
    page_title="Valoración de acciones USA y México",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
      .block-container {padding-top: 1.35rem; padding-bottom: 2rem;}
      [data-testid="stMetric"] {
        border: 1px solid rgba(128,128,128,.22);
        border-radius: 14px;
        padding: .8rem 1rem;
        background: rgba(128,128,128,.035);
      }
      [data-testid="stSidebar"] {border-right: 1px solid rgba(128,128,128,.18);}
      .small-note {font-size: .84rem; opacity: .78;}
      .status-ok {color: #15803d; font-weight: 700;}
      .status-review {color: #b45309; font-weight: 700;}
    </style>
    """,
    unsafe_allow_html=True,
)


VALOR_COLUMNS = [
    "Precio de mercado",
    "Valor intrínseco FCL",
    "Valor intrínseco EBIT",
    "Valor intrínseco EBITDA",
    "Valor intrínseco utilidad neta",
    "Mediana de modelos",
    "Precio objetivo analistas",
]

UPSIDE_COLUMNS = [
    "Upside FCL",
    "Upside EBIT",
    "Upside EBITDA",
    "Upside utilidad neta",
    "Upside mediana",
    "Upside analistas",
]


@st.cache_data(ttl=3600, show_spinner=False)
def analizar_cached(ticker: str, config_values: tuple) -> tuple[dict, dict]:
    config = Configuracion(**dict(config_values))
    return analizar_ticker(ticker, config, mercado_de_ticker(ticker))


@st.cache_data(ttl=1800, show_spinner=False)
def precio_historico(ticker: str, periodo: str) -> pd.DataFrame:
    accion = yf.Ticker(ticker)
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


@st.cache_data(ttl=3600, show_spinner=False)
def historicos_financieros(ticker: str, config_values: tuple) -> tuple[pd.DataFrame, pd.DataFrame]:
    config = Configuracion(**dict(config_values))
    accion = yf.Ticker(ticker)
    info = obtener_info_segura(accion)

    try:
        resultados = accion.income_stmt
    except Exception:
        resultados = pd.DataFrame()
    try:
        flujo = accion.cashflow
    except Exception:
        flujo = pd.DataFrame()

    ingresos = obtener_fila(resultados, ["Total Revenue", "Operating Revenue", "Revenue"])
    ebit = obtener_fila(resultados, ["EBIT", "Operating Income", "Operating Income Loss"])
    utilidad = obtener_fila(
        resultados,
        ["Net Income Common Stockholders", "Net Income", "Net Income Including Noncontrolling Interests"],
    )
    impuestos = obtener_fila(resultados, ["Tax Provision", "Income Tax Expense"])
    pretax = obtener_fila(resultados, ["Pretax Income", "Income Before Tax", "Earnings Before Tax"])
    fcl, _ = construir_fcl(flujo)
    ebitda, _ = construir_ebitda(resultados, flujo, ebit)

    moneda_financiera = str(info.get("financialCurrency") or info.get("currency") or "USD").upper()
    moneda_cotizacion = str(info.get("currency") or "USD").upper()
    fx = obtener_tipo_cambio(moneda_financiera, moneda_cotizacion) or 1.0

    series = {
        "Ingresos": convertir_serie(ingresos, fx),
        "FCL": convertir_serie(fcl, fx),
        "EBIT": convertir_serie(ebit, fx),
        "EBITDA": convertir_serie(ebitda, fx),
        "Utilidad neta": convertir_serie(utilidad, fx),
    }

    marco = pd.concat(series, axis=1).sort_index()
    if marco.empty:
        return pd.DataFrame(), pd.DataFrame()

    indice = pd.to_datetime(marco.index, errors="coerce")
    marco = marco.loc[~indice.isna()].copy()
    indice = pd.to_datetime(marco.index)
    marco.index = indice.year.astype(str)
    marco = marco.groupby(level=0).last().sort_index()
    marco = marco / 1_000_000.0
    marco.index.name = "Año"

    tasa = estimar_tasa_impuestos(
        convertir_serie(impuestos, fx),
        convertir_serie(pretax, fx),
        config,
    )
    ingresos_base = series["Ingresos"]
    nopat = series["EBIT"] * (1.0 - tasa)

    margenes = {}
    for nombre, serie in {
        "Margen FCL": series["FCL"],
        "Margen EBIT": nopat,
        "Margen EBITDA": series["EBITDA"],
        "Margen neto": series["Utilidad neta"],
    }.items():
        alineado = alinear_series(serie, ingresos_base)
        if alineado.empty:
            continue
        alineado.columns = ["metrica", "ingresos"]
        valor = alineado["metrica"] / alineado["ingresos"].replace(0, np.nan)
        margenes[nombre] = valor

    df_margenes = pd.concat(margenes, axis=1).sort_index() if margenes else pd.DataFrame()
    if not df_margenes.empty:
        idx = pd.to_datetime(df_margenes.index, errors="coerce")
        df_margenes = df_margenes.loc[~idx.isna()].copy()
        df_margenes.index = pd.to_datetime(df_margenes.index).year.astype(str)
        df_margenes = df_margenes.groupby(level=0).last().sort_index()
        df_margenes.index.name = "Año"

    return marco, df_margenes


def format_money(value: object, currency: str | None = None) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "—"
    if not math.isfinite(number):
        return "—"
    symbol = "$"
    suffix = f" {currency}" if currency else ""
    return f"{symbol}{number:,.2f}{suffix}"


def format_percent(value: object) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "—"
    if not math.isfinite(number):
        return "—"
    return f"{number:.1%}"


def construir_configuracion() -> Configuracion:
    st.sidebar.subheader("Supuestos")
    tasa_descuento_pct = st.sidebar.slider(
        "Tasa de descuento (%)",
        min_value=5.0,
        max_value=20.0,
        value=10.0,
        step=0.5,
    )
    tasa_descuento = tasa_descuento_pct / 100.0
    factor_margen_pct = st.sidebar.slider(
        "Factor conservador de margen (%)",
        min_value=40,
        max_value=100,
        value=80,
        step=5,
    )
    factor_margen = factor_margen_pct / 100.0

    with st.sidebar.expander("Crecimiento y múltiplos", expanded=False):
        factor_crecimiento_inicial_pct = st.slider(
            "Crecimiento 1-5 como % del CAGR",
            0,
            100,
            25,
            5,
        )
        factor_crecimiento_final_pct = st.slider(
            "Crecimiento 6-10 como % del inicial",
            0,
            100,
            50,
            5,
        )
        factor_crecimiento_inicial = factor_crecimiento_inicial_pct / 100.0
        factor_crecimiento_final = factor_crecimiento_final_pct / 100.0
        multiplo_fcl = st.number_input("Múltiplo terminal FCL", 4.0, 30.0, 12.0, 0.5)
        multiplo_ebit = st.number_input("Múltiplo terminal EBIT", 4.0, 30.0, 12.0, 0.5)
        multiplo_ebitda = st.number_input("Múltiplo terminal EBITDA", 4.0, 30.0, 12.0, 0.5)
        multiplo_neto = st.number_input("Múltiplo terminal utilidad neta", 4.0, 35.0, 15.0, 0.5)

    return Configuracion(
        tasa_descuento=tasa_descuento,
        factor_margen_conservador=factor_margen,
        factor_crecimiento_inicial=factor_crecimiento_inicial,
        factor_crecimiento_final=factor_crecimiento_final,
        multiplo_terminal_fcl=multiplo_fcl,
        multiplo_terminal_ebit=multiplo_ebit,
        multiplo_terminal_ebitda=multiplo_ebitda,
        multiplo_terminal_utilidad_neta=multiplo_neto,
        pausa_entre_tickers=0.15,
    )


def preparar_tabla(df: pd.DataFrame) -> pd.DataFrame:
    columnas = [
        "Mercado", "Ticker", "Empresa", "Moneda", "Precio de mercado",
        "Valor intrínseco FCL", "Valor intrínseco EBIT", "Valor intrínseco EBITDA",
        "Valor intrínseco utilidad neta", "Mediana de modelos", "Precio objetivo analistas",
        "Upside mediana", "Upside analistas", "Estado",
    ]
    presentes = [col for col in columnas if col in df.columns]
    return df[presentes].copy()


def render_table(df: pd.DataFrame) -> None:
    tabla = preparar_tabla(df)
    column_config = {}
    for col in VALOR_COLUMNS:
        if col in tabla.columns:
            column_config[col] = st.column_config.NumberColumn(col, format="$%.2f")
    for col in UPSIDE_COLUMNS:
        if col in tabla.columns:
            tabla[col] = pd.to_numeric(tabla[col], errors="coerce") * 100.0
            column_config[col] = st.column_config.NumberColumn(col, format="%.1f%%")
    st.dataframe(
        tabla,
        use_container_width=True,
        hide_index=True,
        height=min(680, 72 + 35 * max(1, len(tabla))),
        column_config=column_config,
    )


def grafica_valoraciones(fila: pd.Series) -> go.Figure:
    datos = pd.DataFrame(
        {
            "Método": ["Mercado", "FCL", "EBIT", "EBITDA", "Utilidad neta", "Mediana", "Analistas"],
            "Valor": [
                fila.get("Precio de mercado"),
                fila.get("Valor intrínseco FCL"),
                fila.get("Valor intrínseco EBIT"),
                fila.get("Valor intrínseco EBITDA"),
                fila.get("Valor intrínseco utilidad neta"),
                fila.get("Mediana de modelos"),
                fila.get("Precio objetivo analistas"),
            ],
        }
    ).dropna()
    fig = px.bar(datos, x="Método", y="Valor", text_auto=".2f")
    fig.update_layout(
        title="Valor por acción según metodología",
        xaxis_title=None,
        yaxis_title=f"Precio por acción ({fila.get('Moneda', '')})",
        showlegend=False,
        margin=dict(l=20, r=20, t=55, b=20),
    )
    return fig


def mostrar_detalle(df_principal: pd.DataFrame, df_detalle: pd.DataFrame, config_tuple: tuple) -> None:
    st.subheader("Detalle de empresa")
    if df_principal.empty:
        st.info("No hay empresas disponibles para mostrar el detalle.")
        return
    opciones = df_principal.sort_values(["Mercado", "Ticker"])["Ticker"].tolist()
    ticker = st.selectbox("Empresa", opciones, key="detalle_ticker")
    fila = df_principal[df_principal["Ticker"] == ticker].iloc[0]
    detalle = df_detalle[df_detalle["Ticker"] == ticker].iloc[0] if ticker in set(df_detalle["Ticker"]) else pd.Series(dtype=object)
    moneda = str(fila.get("Moneda") or "")

    st.markdown(f"### {fila.get('Empresa', ticker)} · `{ticker}` · {fila.get('Mercado', '')}")
    cols = st.columns(4)
    cols[0].metric("Precio de mercado", format_money(fila.get("Precio de mercado"), moneda))
    cols[1].metric(
        "Mediana de modelos",
        format_money(fila.get("Mediana de modelos"), moneda),
        format_percent(fila.get("Upside mediana")),
    )
    cols[2].metric(
        "Objetivo de analistas",
        format_money(fila.get("Precio objetivo analistas"), moneda),
        format_percent(fila.get("Upside analistas")),
    )
    cols[3].metric("Estado", str(fila.get("Estado") or "—"))

    if fila.get("Estado") == "ERROR":
        st.warning(f"{ticker}: {fila.get('Notas') or 'No se pudo analizar la empresa.'}")
        return

    col_a, col_b = st.columns([1, 1])
    with col_a:
        st.plotly_chart(grafica_valoraciones(fila), use_container_width=True)
    with col_b:
        periodo = st.selectbox("Periodo del precio", ["1y", "2y", "5y", "10y"], index=2)
        try:
            historia = precio_historico(ticker, periodo)
        except Exception as exc:
            st.warning(f"No se pudo cargar el historial de precio: {exc}")
            historia = pd.DataFrame()
        if historia.empty:
            st.info("Yahoo Finance no devolvió historial de precio.")
        else:
            fig = px.line(historia, x="Fecha", y="Cierre")
            fig.update_layout(
                title=f"Precio ajustado · {periodo}",
                xaxis_title=None,
                yaxis_title=f"{moneda} por acción",
                margin=dict(l=20, r=20, t=55, b=20),
            )
            st.plotly_chart(fig, use_container_width=True)

    try:
        financieros, margenes = historicos_financieros(ticker, config_tuple)
    except Exception as exc:
        st.warning(f"No se pudieron cargar los estados financieros del detalle: {exc}")
        financieros, margenes = pd.DataFrame(), pd.DataFrame()
    col_c, col_d = st.columns([1, 1])
    with col_c:
        if financieros.empty:
            st.info("No hay estados financieros históricos suficientes para graficar.")
        else:
            df_plot = financieros.reset_index().melt(
                id_vars="Año", var_name="Métrica", value_name="Valor"
            )
            fig = px.bar(df_plot, x="Año", y="Valor", color="Métrica", barmode="group")
            fig.update_layout(
                title=f"Históricos financieros ({moneda} millones)",
                xaxis_title=None,
                yaxis_title=f"{moneda} millones",
                legend_title=None,
                margin=dict(l=20, r=20, t=55, b=20),
            )
            st.plotly_chart(fig, use_container_width=True)
    with col_d:
        if margenes.empty:
            st.info("No hay márgenes históricos suficientes para graficar.")
        else:
            df_plot = (margenes * 100).reset_index().melt(
                id_vars="Año", var_name="Margen", value_name="Porcentaje"
            )
            fig = px.line(df_plot, x="Año", y="Porcentaje", color="Margen", markers=True)
            fig.update_layout(
                title="Márgenes históricos",
                xaxis_title=None,
                yaxis_title="Porcentaje",
                legend_title=None,
                margin=dict(l=20, r=20, t=55, b=20),
            )
            fig.update_yaxes(ticksuffix="%")
            st.plotly_chart(fig, use_container_width=True)

    with st.expander("Supuestos y diagnóstico de esta empresa"):
        datos = {
            "Sector": detalle.get("Sector"),
            "Industria": detalle.get("Industria"),
            "CAGR histórico": format_percent(detalle.get("CAGR histórico ingresos")),
            "Crecimiento años 1-5": format_percent(detalle.get("Crecimiento años 1-5")),
            "Crecimiento años 6-10": format_percent(detalle.get("Crecimiento años 6-10")),
            "Margen FCL conservador": format_percent(detalle.get("Margen FCL conservador")),
            "Margen NOPAT conservador": format_percent(detalle.get("Margen NOPAT conservador")),
            "Margen EBITDA ajustado": format_percent(detalle.get("Margen EBITDA ajustado conservador")),
            "Margen neto conservador": format_percent(detalle.get("Margen neto conservador")),
            "Deuda neta": format_money(detalle.get("Deuda neta"), moneda),
            "Notas": fila.get("Notas") or "Sin observaciones.",
        }
        st.dataframe(
            pd.DataFrame(datos.items(), columns=["Campo", "Valor"]),
            use_container_width=True,
            hide_index=True,
        )
        if bool(detalle.get("Empresa financiera")):
            st.warning(
                "Es una empresa financiera. La utilidad neta suele ser más interpretable que FCL, EBIT o EBITDA; "
                "la deuda forma parte de la operación bancaria."
            )


def main() -> None:
    st.title("Valoración de acciones · USA y México")
    st.caption(
        "Compara precio de mercado, FCL, EBIT/NOPAT, EBITDA ajustado, utilidad neta y objetivo de analistas. "
        "Los cálculos son aproximaciones para análisis, no recomendaciones de inversión."
    )

    st.sidebar.title("Universo y análisis")
    mercado = st.sidebar.radio("Mercado", ["USA", "MX", "Todos"], horizontal=True)
    universo = EMPRESAS_USA if mercado == "USA" else EMPRESAS_MX if mercado == "MX" else EMPRESAS_USA + EMPRESAS_MX

    seleccionar_todas = st.sidebar.checkbox("Seleccionar todo el mercado", value=False)
    predeterminadas = universo[:6] if mercado != "MX" else universo[:10]
    seleccion = universo if seleccionar_todas else st.sidebar.multiselect(
        "Tickers",
        options=universo,
        default=predeterminadas,
    )
    ticker_extra = st.sidebar.text_input(
        "Ticker adicional",
        placeholder="Ej.: MELI o KOFUBL.MX",
        help="Separa varios tickers con comas.",
    )
    extras = [x.strip().upper() for x in ticker_extra.split(",") if x.strip()]
    tickers = list(dict.fromkeys(seleccion + extras))

    config = construir_configuracion()
    config_tuple = tuple(asdict(config).items())

    analizar = st.sidebar.button("Analizar empresas", type="primary", use_container_width=True)
    borrar = st.sidebar.button("Limpiar resultados", use_container_width=True)

    with st.sidebar.expander("Universo mexicano", expanded=False):
        st.markdown(
            "La selección MX prioriza emisoras grandes y líquidas del mercado mexicano. "
            "Los símbolos terminan en `.MX` para Yahoo Finance."
        )
        st.markdown(
            "[S&P/BMV IPC](https://www.spglobal.com/spdji/en/indices/equity/sp-bmv-ipc/) · "
            "[Componentes INMEX en Yahoo](https://es.finance.yahoo.com/quote/INMEX.MX/components/)"
        )

    if borrar:
        st.session_state.pop("principales", None)
        st.session_state.pop("detalles", None)
        st.session_state.pop("config", None)
        st.rerun()

    if analizar:
        if not tickers:
            st.warning("Selecciona al menos un ticker.")
        else:
            principales: list[dict] = []
            detalles: list[dict] = []
            progreso = st.progress(0, text="Preparando análisis...")
            estado = st.empty()

            for i, ticker in enumerate(tickers, start=1):
                estado.write(f"Analizando **{ticker}** ({i}/{len(tickers)})")
                try:
                    principal, detalle = analizar_cached(ticker, config_tuple)
                except Exception as exc:
                    principal, detalle = crear_resultado_error(ticker, exc)
                principales.append(principal)
                detalles.append(detalle)
                progreso.progress(i / len(tickers), text=f"{i}/{len(tickers)} completadas")
                time.sleep(config.pausa_entre_tickers)

            st.session_state["principales"] = principales
            st.session_state["detalles"] = detalles
            st.session_state["config"] = config_tuple
            estado.empty()
            progreso.empty()
            conteos = pd.Series([fila["Estado"] for fila in principales]).value_counts()
            balance = "; ".join(
                f"{estado}: {int(conteos.get(estado, 0))}"
                for estado in ("OK", "DATOS INCOMPLETOS", "REVISAR", "ERROR")
            )
            if conteos.get("OK", 0) == len(tickers):
                st.success(f"Análisis completado. {balance}")
            else:
                st.warning(f"Análisis finalizado con observaciones. {balance}")

    if "principales" not in st.session_state:
        st.info(
            "Selecciona las empresas en la barra lateral y pulsa **Analizar empresas**. "
            "Conviene probar primero con 5–10 tickers porque Yahoo Finance puede limitar consultas masivas."
        )
        col1, col2, col3 = st.columns(3)
        col1.metric("Empresas USA disponibles", len(EMPRESAS_USA))
        col2.metric("Empresas MX disponibles", len(EMPRESAS_MX))
        col3.metric("Métodos de valoración", 4)
        return

    df_principal = pd.DataFrame(st.session_state["principales"]).reindex(columns=COLUMNAS_PRINCIPAL)
    df_detalle = pd.DataFrame(st.session_state["detalles"]).reindex(columns=COLUMNAS_DETALLE)
    config_tuple_actual = st.session_state.get("config", config_tuple)
    config_actual = Configuracion(**dict(config_tuple_actual))

    st.subheader("Resumen del análisis")
    filtro_mercado = st.multiselect(
        "Filtrar mercado",
        options=sorted(df_principal["Mercado"].dropna().unique().tolist()),
        default=sorted(df_principal["Mercado"].dropna().unique().tolist()),
    )
    estados = sorted(df_principal["Estado"].dropna().unique().tolist())
    filtro_estado = st.multiselect("Filtrar estado", options=estados, default=estados)
    minimo_upside = st.slider("Upside mínimo de la mediana", -100, 200, -100, 5) / 100

    filtrado = df_principal[
        df_principal["Mercado"].isin(filtro_mercado)
        & df_principal["Estado"].isin(filtro_estado)
    ].copy()
    upside = pd.to_numeric(filtrado["Upside mediana"], errors="coerce")
    filtrado = filtrado[upside.isna() | (upside >= minimo_upside)]
    filtrado = filtrado.sort_values("Upside mediana", ascending=False, na_position="last")

    validos = pd.to_numeric(filtrado["Upside mediana"], errors="coerce").dropna()
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("Empresas mostradas", len(filtrado))
    k2.metric("Upside mediano", format_percent(validos.median()) if not validos.empty else "—")
    k3.metric("Con upside > 15%", int((validos > 0.15).sum()) if not validos.empty else 0)
    k4.metric("Con estado OK", int((filtrado.get("Estado") == "OK").sum()))

    render_table(filtrado)

    try:
        with tempfile.TemporaryDirectory() as temporal:
            ruta = Path(temporal) / "valoraciones_USA_MX.xlsx"
            escribir_excel(
                st.session_state["principales"],
                st.session_state["detalles"],
                ruta,
                config_actual,
            )
            excel_bytes = ruta.read_bytes()
    except Exception as exc:
        st.warning(f"No se pudo preparar el Excel: {exc}")
    else:
        st.download_button(
            "Descargar Excel completo",
            data=excel_bytes,
            file_name="valoraciones_USA_MX.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=False,
        )

    st.divider()
    mostrar_detalle(df_principal, df_detalle, config_tuple_actual)


if __name__ == "__main__":
    main()
