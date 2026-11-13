from __future__ import annotations

import tempfile
import time
from dataclasses import asdict
from pathlib import Path

import pandas as pd
import plotly.express as px
import streamlit as st

from valoracion.configuracion import Configuracion
from valoracion.exportacion.excel import escribir_excel
from valoracion.metodologia import VERSION_METODOLOGIA
from valoracion.modelos import COLUMNAS_DETALLE, COLUMNAS_PRINCIPAL, crear_resultado_error
from valoracion.normalizacion import mercado_de_ticker
from valoracion.presentacion.etiquetas import ETIQUETAS, etiqueta
from valoracion.presentacion.formatos import format_money, format_percent
from valoracion.presentacion.graficas import grafica_valoraciones
from valoracion.servicio import (
    analizar_ticker,
    obtener_historicos_financieros,
    obtener_precio_historico,
)
from valoracion.universo import EMPRESAS_MX, EMPRESAS_USA

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
    return obtener_precio_historico(ticker, periodo)


@st.cache_data(ttl=3600, show_spinner=False)
def historicos_financieros(ticker: str, config_values: tuple) -> tuple[pd.DataFrame, pd.DataFrame]:
    config = Configuracion(**dict(config_values))
    return obtener_historicos_financieros(ticker, config)


def construir_configuracion() -> Configuracion:
    st.sidebar.subheader("Supuestos")
    tasa_descuento_pct = st.sidebar.slider(
        "Tasa descuento accionista (%)",
        min_value=5.0,
        max_value=20.0,
        value=10.0,
        step=0.5,
    )
    tasa_descuento = tasa_descuento_pct / 100.0
    tasa_empresa_pct = st.sidebar.slider(
        "Tasa descuento empresa (%)",
        min_value=5.0,
        max_value=20.0,
        value=10.0,
        step=0.5,
        help="Supuesto manual para NOPAT y EBITDA ajustado; no es un WACC estimado automáticamente.",
    )
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
        multiplo_ebit = st.number_input("Múltiplo terminal NOPAT", 4.0, 30.0, 12.0, 0.5)
        multiplo_ebitda = st.number_input("Múltiplo terminal EBITDA ajustado", 4.0, 30.0, 12.0, 0.5)
        multiplo_neto = st.number_input("Múltiplo terminal utilidad neta", 4.0, 35.0, 15.0, 0.5)

    return Configuracion(
        tasa_descuento=tasa_descuento,
        tasa_descuento_empresa=tasa_empresa_pct / 100.0,
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
        "Mercado",
        "Ticker",
        "Empresa",
        "Moneda",
        "Precio de mercado",
        "Valor intrínseco FCL",
        "Valor intrínseco EBIT",
        "Valor intrínseco EBITDA",
        "Valor intrínseco utilidad neta",
        "Mediana de modelos",
        "Precio objetivo analistas",
        "Upside mediana",
        "Upside analistas",
        "Estado",
        "Modelos en mediana",
        "Clase de empresa",
    ]
    presentes = [col for col in columnas if col in df.columns]
    return df[presentes].rename(columns=ETIQUETAS).copy()


def render_table(df: pd.DataFrame) -> None:
    tabla = preparar_tabla(df)
    column_config = {}
    for campo in VALOR_COLUMNS:
        col = etiqueta(campo)
        if col in tabla.columns:
            column_config[col] = st.column_config.NumberColumn(col, format="$%.2f")
    for campo in UPSIDE_COLUMNS:
        col = etiqueta(campo)
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


def mostrar_detalle(
    df_principal: pd.DataFrame, df_detalle: pd.DataFrame, config_tuple: tuple
) -> None:
    st.subheader("Detalle de empresa")
    if df_principal.empty:
        st.info("No hay empresas disponibles para mostrar el detalle.")
        return
    opciones = df_principal.sort_values(["Mercado", "Ticker"])["Ticker"].tolist()
    ticker = st.selectbox("Empresa", opciones, key="detalle_ticker")
    fila = df_principal[df_principal["Ticker"] == ticker].iloc[0]
    detalle = (
        df_detalle[df_detalle["Ticker"] == ticker].iloc[0]
        if ticker in set(df_detalle["Ticker"])
        else pd.Series(dtype=object)
    )
    moneda = str(fila.get("Moneda") or "")

    st.markdown(f"### {fila.get('Empresa', ticker)} · `{ticker}` · {fila.get('Mercado', '')}")
    cols = st.columns(4)
    cols[0].metric("Precio de mercado", format_money(fila.get("Precio de mercado"), moneda))
    cols[1].metric(
        "Mediana de proxies",
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

    st.caption(
        f"Metodología {fila.get('Versión metodología', VERSION_METODOLOGIA)} · "
        f"{fila.get('Modelos en mediana', 0)} proxies en la mediana · "
        "Mediana descriptiva; no representa modelos independientes ni una probabilidad de retorno."
    )
    if fila.get("Estado") != "OK":
        st.warning(str(fila.get("Notas") or "Revisar disponibilidad y aplicabilidad de los datos."))

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
            df_plot = (
                (margenes * 100)
                .reset_index()
                .melt(id_vars="Año", var_name="Margen", value_name="Porcentaje")
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
            "Crecimiento bruto utilizado": format_percent(detalle.get("CAGR histórico ingresos")),
            "Crecimiento años 1-5": format_percent(detalle.get("Crecimiento años 1-5")),
            "Crecimiento años 6-10": format_percent(detalle.get("Crecimiento años 6-10")),
            "Margen FCL conservador": format_percent(detalle.get("Margen FCL conservador")),
            "Margen NOPAT conservador": format_percent(detalle.get("Margen NOPAT conservador")),
            "Margen EBITDA ajustado": format_percent(
                detalle.get("Margen EBITDA ajustado conservador")
            ),
            "Margen neto conservador": format_percent(detalle.get("Margen neto conservador")),
            "Deuda neta": format_money(detalle.get("Deuda neta"), moneda),
            "Notas": fila.get("Notas") or "Sin observaciones.",
        }
        for campo in [
            "Versión metodología",
            "Versión contrato",
            "Fuente de datos",
            "Obtenido en UTC",
            "Fuente del precio",
            "Fecha del precio",
            "Fuente del objetivo",
            "Estadístico del objetivo",
            "Cobertura de analistas",
            "Fecha del objetivo",
            "Horizonte del objetivo",
            "Fuente FX",
            "Obtenido FX en UTC",
            "Fecha FX",
            "Período ingresos",
            "Período deuda",
            "Período efectivo",
            "Fuente deuda",
            "Fuente efectivo",
            "Períodos por modelo",
            "Fuentes por métrica",
            "Configuración efectiva",
            "Crecimiento utilizado",
            "Impuestos utilizados",
            "Modelos incluidos",
            "Modelos excluidos",
        ]:
            datos[campo] = detalle.get(campo)
        datos["Tasa descuento accionista"] = format_percent(
            detalle.get("Tasa descuento accionista")
        )
        datos["Tasa descuento empresa"] = format_percent(detalle.get("Tasa descuento empresa"))
        st.dataframe(
            pd.DataFrame(
                [(k, "—" if v is None else str(v)) for k, v in datos.items()],
                columns=["Campo", "Valor"],
            ),
            use_container_width=True,
            hide_index=True,
        )
        if bool(detalle.get("Empresa financiera")):
            st.warning(
                "Es una empresa financiera sin modelo sectorial implementado. Los cuatro proxies se excluyen de la mediana."
            )


def main() -> None:
    st.title("Valoración de acciones · USA y México")
    st.caption(
        "Compara precio de mercado, proxies de FCL, NOPAT, EBITDA ajustado y utilidad neta, y objetivo de analistas. "
        "Los cálculos son aproximaciones para análisis, no recomendaciones de inversión."
    )

    st.sidebar.title("Universo y análisis")
    mercado = st.sidebar.radio("Mercado", ["USA", "MX", "Todos"], horizontal=True)
    universo = (
        EMPRESAS_USA
        if mercado == "USA"
        else EMPRESAS_MX
        if mercado == "MX"
        else EMPRESAS_USA + EMPRESAS_MX
    )

    seleccionar_todas = st.sidebar.checkbox("Seleccionar todo el mercado", value=False)
    predeterminadas = universo[:6] if mercado != "MX" else universo[:10]
    seleccion = (
        universo
        if seleccionar_todas
        else st.sidebar.multiselect(
            "Tickers",
            options=universo,
            default=predeterminadas,
        )
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
        df_principal["Mercado"].isin(filtro_mercado) & df_principal["Estado"].isin(filtro_estado)
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
