"""Libro de resultados; recibe datos calculados y no consulta el mercado."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from openpyxl import load_workbook
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

from ..configuracion import Configuracion
from ..metodologia import VERSION_METODOLOGIA, VERSION_CONTRATO
from ..presentacion.etiquetas import ETIQUETAS, etiqueta
from ..modelos import COLUMNAS_PRINCIPAL, COLUMNAS_DETALLE
from ..universo import EMPRESAS_USA, EMPRESAS_MX, FUENTES_UNIVERSO


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
            ("Tasa descuento accionista", config.tasa_descuento, "%; supuesto manual"),
            ("Tasa descuento empresa", config.descuento_empresa, "%; supuesto manual, no WACC calibrado"),
            ("Versión metodología", VERSION_METODOLOGIA, ""),
            ("Versión contrato", VERSION_CONTRATO, ""),
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
            ("Tratamiento FCL", "Proxy del accionista; no es FCFE conciliado; no se resta deuda neta", ""),
            ("Tratamiento EBIT", "Proxy NOPAT sin reinversión completa; se resta deuda neta", ""),
            ("Tratamiento EBITDA", "EBITDA - impuestos sobre EBIT - |CapEx|; se resta deuda neta", ""),
            ("Tratamiento utilidad neta", "Proxy de utilidad contable, no caja distribuible; no se resta deuda neta", ""),
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
            df.rename(columns=ETIQUETAS).to_excel(writer, sheet_name=nombre, index=False, startrow=2)

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
            columna = encabezados.get(etiqueta(nombre))
            if columna:
                for fila in range(4, ws.max_row + 1):
                    ws.cell(fila, columna).number_format = formato_moneda
        for nombre in columnas_porcentaje:
            columna = encabezados.get(etiqueta(nombre))
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
    porcentaje_detalle.update({"Tasa descuento accionista", "Tasa descuento empresa"})
    porcentaje_detalle = {etiqueta(n) for n in porcentaje_detalle}
    numero_detalle = {etiqueta(n) for n in numero_detalle}
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
