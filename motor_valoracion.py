"""Compatibilidad con F1. La implementación vive en el paquete valoracion."""

from valoracion.configuracion import CONFIG, Configuracion
from valoracion.calculos import (
    calcular_cagr, estimar_tasa_impuestos, construir_fcl, construir_ebitda,
    margen_normalizado, proyectar_valor, por_accion, rendimiento, es_financiera,
)
from valoracion.normalizacion import (
    mercado_de_ticker, eliminar_duplicados, numero_valido, normalizar_etiqueta,
    obtener_fila, ultimo_valor, alinear_series, convertir_serie,
)
from valoracion.modelos import COLUMNAS_PRINCIPAL, COLUMNAS_DETALLE, crear_resultado_error
from valoracion.proveedores.yahoo import (
    CACHE_FX, obtener_info_segura, obtener_precio_actual, obtener_objetivo_analistas,
    obtener_acciones, ultimo_cierre_simbolo, obtener_tipo_cambio,
)
from valoracion.universo import EMPRESAS_USA, EMPRESAS_MX, EMPRESAS, FUENTES_UNIVERSO
from valoracion.servicio import analizar_ticker
from valoracion.exportacion.excel import escribir_excel
from valoracion.cli import main


if __name__ == "__main__":
    main()
