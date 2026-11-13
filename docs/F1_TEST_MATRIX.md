# Trazabilidad de la matriz de F1

Los 101 IDs originales de la SDD se relacionan aquí con pruebas ejecutables.
F3 migra deliberadamente expectativas de FX, balance, financieras y etiquetas;
la justificación está en [metodología](methodology.md) y sus pruebas adicionales
en [TDD de F3](TDD_F3.md). Esta matriz conserva los IDs de F1.
Los nombres son funciones de pytest; varias están parametrizadas y generan
múltiples casos. Las rutas son relativas a la raíz del repositorio.

## Utilidades y métricas

| IDs SDD | Archivo | Pruebas |
| --- | --- | --- |
| U-01 | `tests/unit/test_utilidades.py` | `test_mercado` |
| U-02 | `tests/unit/test_utilidades.py` | `test_duplicados_conservan_orden` |
| U-03 | `tests/unit/test_utilidades.py` | `test_numero_valido` |
| U-04, U-05, U-07 | `tests/unit/test_utilidades.py` | `test_fila_normaliza_prioriza_ordena_y_no_muta` |
| U-06 | `tests/unit/test_utilidades.py` | `test_fila_ausente` |
| U-08 | `tests/unit/test_utilidades.py` | `test_alinear_conserva_fechas_comunes_y_limpia_ausencias` |
| U-09 | `tests/unit/test_utilidades.py` | `test_ultimo_valor` |
| U-10 | `tests/unit/test_utilidades.py` | `test_conversion_conserva_indice_y_entrada` |
| U-11 | `tests/unit/test_utilidades.py` | `test_normalizacion_descarta_infinitos` |
| U-12 | `tests/unit/test_presentacion.py` | `test_ausencias_se_presentan_como_guion`, `test_formatos_numericos_y_tabla_no_mutan_entradas` |
| U-13 | `tests/unit/test_presentacion.py` | `test_formatos_numericos_y_tabla_no_mutan_entradas` |
| C-01 | `tests/unit/test_metricas.py` | `test_cagr_conocido` |
| C-02 | `tests/unit/test_metricas.py` | `test_cagr_sin_datos_suficientes` |
| C-03 | `tests/unit/test_metricas.py` | `test_cagr_descarta_no_positivos_y_caracteriza_fechas_no_interpretables` |
| C-04, C-05 | `tests/unit/test_metricas.py` | `test_impuestos_mediana_ventana_limites_y_fallback` |
| C-06 | `tests/unit/test_metricas.py` | `test_fcl_directo_prioritario_y_ausente` |
| C-07 | `tests/unit/test_metricas.py` | `test_fcl_cfo_menos_capex_absoluto` |
| C-08 | `tests/unit/test_metricas.py` | `test_ebitda_directo_calculado_y_ausente` |
| C-09, C-10 | `tests/unit/test_metricas.py` | `test_margen_conservador_mediana_ventana_y_negativos`, `test_margen_sin_observaciones_admitidas` |
| C-11, C-12, C-13 | `tests/unit/test_proyeccion.py` | `test_proyecciones_con_esperados_independientes` |
| C-14 | `tests/unit/test_proyeccion.py` | `test_proyeccion_no_calculable` |
| C-15 | `tests/unit/test_proyeccion.py` | `test_configuracion_invalida_se_rechaza_antes_de_consultar`, `test_proyeccion_no_propaga_parametros_no_finitos`, `test_horizonte_invalido_tiene_error_explicito`, `test_desbordamiento_no_produce_valoracion_infinita` |
| C-16 | `tests/unit/test_proyeccion.py` | `test_por_accion` |
| C-17 | `tests/unit/test_proyeccion.py` | `test_rendimiento`, `test_rendimiento_no_finito_es_ausente` |
| C-18 | `tests/unit/test_proyeccion.py` | `test_clasificacion_financiera` |

## Adquisición e integración

| IDs SDD | Archivo | Pruebas |
| --- | --- | --- |
| P-01, P-02 | `tests/integration/test_proveedor_yahoo_simulado.py` | `test_info_y_fallback` |
| P-03, P-04 | `tests/integration/test_proveedor_yahoo_simulado.py` | `test_precio_prioridad_y_fallback`, `test_precio_historico_no_positivo_o_no_finito_no_es_valido` |
| P-05, P-06 | `tests/integration/test_proveedor_yahoo_simulado.py` | `test_objetivos_analistas` |
| P-07, P-08 | `tests/integration/test_proveedor_yahoo_simulado.py` | `test_acciones_prioridad_y_limites` |
| P-09 | `tests/integration/test_proveedor_yahoo_simulado.py` | `test_fx_identidad_actual_sin_consultas` |
| P-10, P-11 | `tests/integration/test_proveedor_yahoo_simulado.py` | `test_fx_directo_inverso_y_cache` |
| P-12 | `tests/integration/test_proveedor_yahoo_simulado.py` | `test_ultimo_cierre`, `test_precio_prioridad_y_fallback` |
| A-01, A-12 | `tests/integration/test_analizar_ticker.py` | `test_industrial_completa_concilia_cuatro_modelos`, `test_balance_fallback_sector_y_nombre` |
| A-02, A-03 | `tests/integration/test_analizar_ticker.py` | `test_empresa_mx_y_conversion_controlada` |
| A-04 | `tests/integration/test_analizar_ticker.py` | `test_f3_fx_ausente_bloquea_valoracion` |
| A-05, A-06, A-07 | `tests/integration/test_analizar_ticker.py` | `test_datos_basicos_incompletos` |
| A-08, A-09 | `tests/integration/test_analizar_ticker.py` | `test_modelos_parciales_excluyen_ausencias_de_mediana` |
| A-10, A-11 | `tests/integration/test_analizar_ticker.py` | `test_crecimiento_fallback_y_limites` |
| A-13 | `tests/integration/test_analizar_ticker.py` | `test_balance_fallback_sector_y_nombre` |
| A-14 | `tests/integration/test_analizar_ticker.py` | `test_estado_financiero_fallido_es_localizado` |
| A-15 | `tests/integration/test_analizar_ticker.py` | `test_infinitos_en_datos_no_llegan_a_valoraciones` |
| A-16 | `tests/integration/test_analizar_ticker.py` | `test_analisis_no_muta_los_datos_de_entrada` |

## Interfaz

Todas las siguientes funciones están en `tests/ui/test_app.py`, excepto UI-18.

| IDs SDD | Pruebas |
| --- | --- |
| UI-01 | `test_arranque_no_consulta_el_proveedor` |
| UI-02 | `test_seleccion_vacia_advierte_y_conserva_analisis_anterior` |
| UI-03 | `test_extras_normalizados_sin_duplicados` |
| UI-04, UI-20 | `test_flujo_completo_con_motor_real_y_excel` |
| UI-05 | `test_todos_los_analisis_fallan_sin_romper_la_interfaz` |
| UI-06 | `test_solo_datos_incompletos_sigue_funcionando` |
| UI-07, UI-08, UI-10 | `test_lote_mixto_filtros_y_descarga_completa` |
| UI-09 | `test_filtro_upside_conserva_ausencias_y_excluye_numeros_bajos` |
| UI-11 | `test_limpiar_devuelve_a_pantalla_inicial` |
| UI-12, UI-19 | `test_configuracion_exportada_no_cambia_hasta_reanalizar` |
| UI-13 | `test_nuevo_lote_restablece_selector_de_empresa` |
| UI-14, UI-15 | `test_historico_vacio_o_fallido_no_rompe_resumen` |
| UI-16 | `test_fallo_al_obtener_estados_del_detalle_es_localizado`, `test_solo_datos_incompletos_sigue_funcionando` |
| UI-17 | `test_error_exportacion_conserva_resultados` |
| UI-18 | `tests/unit/test_presentacion.py::test_grafica_conserva_solo_modelos_disponibles` |

También se prueba el análisis almacenado vacío, la selección de todo el mercado
con universos pequeños y la advertencia para empresas financieras.

## Excel, terminal y cachés

| IDs SDD | Archivo | Pruebas |
| --- | --- | --- |
| X-01, X-02 | `tests/integration/test_excel.py` | `test_excel_particion_orden_valores_formatos_y_supuestos` |
| X-03, X-04 | `tests/integration/test_excel.py` | `test_excel_con_errores_o_vacio_conserva_el_esquema` |
| X-05, X-07, X-08, X-09, X-10 | `tests/integration/test_excel.py` | `test_excel_particion_orden_valores_formatos_y_supuestos` |
| X-06 | `tests/integration/test_excel.py` | `test_excel_escribe_no_finitos_como_celdas_vacias`, `test_excel_particion_orden_valores_formatos_y_supuestos` |
| X-11 | `tests/integration/test_excel.py` | `test_error_de_escritura_se_propaga_sin_afirmar_exito` |
| X-12 | `tests/ui/test_app.py` | `test_lote_mixto_filtros_y_descarga_completa` |
| CLI-01, CLI-04 | `tests/integration/test_cli.py` | `test_cli_tickers_repetidos_error_y_continuacion` |
| CLI-02, CLI-03 | `tests/integration/test_cli.py` | `test_cli_seleccion_de_universo_y_ruta_con_espacios` |
| CLI-05 | `tests/integration/test_cli.py` | `test_cli_todos_fallan_y_salida_predeterminada` |
| CLI-06 | `tests/integration/test_cli.py` | `test_cli_ayuda_y_argumentos_invalidos_no_consultan` |
| CACHE-01, CACHE-02 | `tests/integration/test_cache.py` | `test_cache_analisis_usa_ticker_y_configuracion_y_devuelve_copias` |
| CACHE-03 | `tests/integration/test_cache.py` | `test_cache_historico_distingue_periodos_y_preserva_datos` |
| CACHE-04 | `tests/integration/test_cache.py` | `test_caches_se_limpian_para_otra_prueba`; fixture automática de aislamiento |

## Comprobaciones adicionales y límites

- `test_no_se_admiten_consultas_o_sockets_sin_preparar` comprueba las defensas
  de red de `conftest.py`, además del uso del proveedor falso en el resto.
- `test_ci_ejecuta_suite_y_reportes_sin_desplegar` inspecciona el contrato del
  workflow local. No representa una ejecución remota de GitHub Actions.
- Los tests de carácter financiero verifican aritmética y comportamiento actual.
  Los casos FX ausente y sectores no sustituyen la validación metodológica de F3.
- Los tests de UI verifican lógica e interacción con AppTest; no certifican diseño
  visual en navegadores ni todas las versiones de las dependencias.
