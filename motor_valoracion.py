"""Compatibilidad con F1. La implementación vive en el paquete valoracion."""

from valoracion.calculos import (
    calcular_cagr,
    construir_ebitda,
    construir_fcl,
    es_financiera,
    estimar_tasa_impuestos,
    margen_normalizado,
    por_accion,
    proyectar_valor,
    rendimiento,
)
from valoracion.cli import main
from valoracion.configuracion import CONFIG, Configuracion
from valoracion.exportacion.excel import escribir_excel
from valoracion.modelos import COLUMNAS_DETALLE, COLUMNAS_PRINCIPAL, crear_resultado_error
from valoracion.normalizacion import (
    alinear_series,
    convertir_serie,
    eliminar_duplicados,
    mercado_de_ticker,
    normalizar_etiqueta,
    numero_valido,
    obtener_fila,
    ultimo_valor,
)
from valoracion.proveedores.yahoo import (
    CACHE_FX,
    obtener_acciones,
    obtener_info_segura,
    obtener_objetivo_analistas,
    obtener_precio_actual,
    obtener_tipo_cambio,
    ultimo_cierre_simbolo,
)
from valoracion.servicio import analizar_ticker
from valoracion.universo import EMPRESAS, EMPRESAS_MX, EMPRESAS_USA, FUENTES_UNIVERSO

if __name__ == "__main__":
    main()
