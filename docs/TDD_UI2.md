# UI-2 — Catálogo único y selección escalable

Fecha: 2026-11-15. Base: `c832fb1` (UI-1). Alcance autorizado: el siguiente incremento de [SDD_UI.md, 16.3](SDD_UI.md#163-secuencia-de-implementación), UI-2. No se inicia UI-3 ni se modifica el anexo HTML.

## Resultado

El formulario conectado usa una única lista con vistas Catálogo y Seleccionadas. Cada vista conserva búsqueda, mercado y página; ambos contextos se recuperan al recargar. Nombre disponible y símbolo se normalizan una vez por catálogo, ignorando mayúsculas y diacríticos. La búsqueda y el mercado se aplican al conjunto antes de paginar. Se montan como máximo 25 empresas; las cuatro acciones de paginación reflejan los límites y el rango global.

La selección pertenece al borrador y se mantiene entre páginas, mercados y vistas. Seleccionar página tiene estado marcado/parcial/vacío nativo. La acción global aparece tras seleccionar una página cuando quedan coincidencias sin elegir e identifica su alcance por número. Limpiar vacía la selección completa y los símbolos adicionales, conservando el análisis y su Excel. Al retirar la última seleccionada se vuelve al catálogo y a su buscador; al retirar una fila de la última página se ajustan página y foco.

Enter en el buscador añade una coincidencia única y nunca inicia un análisis. Se respeta la composición de texto. Analizar sigue siendo una acción explícita; los supuestos se envían al mismo motor y por el mismo transporte.

## Datos y límites

`EmpresaCatalogo` añade `name` y `currency` opcionales. El endpoint publica la identidad local de la demo mediante `ProveedorDemo.catalogo()`, sin obtener estados financieros por empresa. Para mercado mantiene sólo los datos disponibles: símbolo y mercado. No deduce una moneda ni asigna nombres ficticios, ni consulta Yahoo para completar filas. Se regeneran `contracts/openapi.v1.json` y los tipos TypeScript; se siguen aceptando catálogos sin los campos nuevos. La versión financiera y las solicitudes de análisis no cambian.

La prueba con 1,203 empresas acredita búsqueda, selección y DOM acotado de la interfaz. **No acredita capacidad de análisis del servidor.** La UI conserva la selección completa si excede `meta.limits.max_tickers` (650 en esta configuración), comunica el límite e impide el POST por validación. No aumenta el límite, no trunca el lote y no pide ajustes de infraestructura al usuario.

La selección usa `sessionStorage` separado por API, fuente y versión de catálogo:

- `intval.selection.v1:{api}:{source}:{dataset}`: versión 1, símbolos y entrada adicional.
- La misma clave con sufijo `:views`: vista y búsqueda/mercado/página de cada contexto.

Un valor válido puede contener una selección vacía intencional. Se eliminan desconocidos y duplicados y se conserva el orden de elección. La selección se restaura antes de habilitar las filas; no se crea un trabajo al recuperarla. Al recuperar referencias anteriores se conservan los símbolos adicionales de mercado. El almacenamiento corrupto o bloqueado no impide usar la vista. No se alteran `intval.analysis.v1:{api}`, las claves de apariencia, los IDs de trabajo ni los snapshots aceptados.

## Ciclo TDD y trazabilidad

Antes de implementar se ejecutaron cinco casos de UI nuevos sobre el formulario anterior: fallaron por la ausencia del selector de página, las vistas y la búsqueda por nombre. La prueba API nueva falló porque el catálogo no incluía la identidad. Se implementó el cambio y se ampliaron los escenarios para cubrir persistencia, última página, foco, envío completo y conservación del Excel.

| Criterio           | Evidencia                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-T02 / SEL-01–04 | `CompanyPicker.test.tsx`: nombre/símbolo normalizados, búsqueda global, mercado, contextos independientes y filas completas con checkbox                                              |
| UI-T03 / SEL-05–10 | El mismo archivo: 1,203 empresas, 25 filas, estado parcial, última página de 3 filas, selección entre páginas/mercados, vacío persistente, foco y límite sin POST                     |
| Lote completo      | Prueba de 604 empresas: el cuerpo enviado incluye las páginas no montadas; limpiar selección conserva el Excel del análisis                                                           |
| Persistencia       | `catalog-model.test.ts`: símbolos canónicos/conocidos/únicos, separación de claves, versiones/contenido inválidos y almacenamiento bloqueado; prueba de recarga en el componente real |
| Catálogo local     | `tests/api/test_fundamentos.py`: identidad real de la demo sin llamadas a `obtener_empresa`, ausencia de metadatos inventados en mercado y filtros existentes                         |
| Regresiones        | Suite frontend completa y suite Python completa; recuperación, desconexión, cancelación, caducidad, respuesta tardía, fórmulas y exportación existentes                               |

La prueba anterior que enviaba 604 empresas desde una acción de selección indiferente a la búsqueda se sustituye por los casos nuevos de alcance página/coincidencias. Se conserva la comprobación del cuerpo completo del POST. Los tests de UI y helpers E2E utilizan los controles reales nuevos; los tests de transporte mantienen sus escenarios y aserciones.

## Verificación local

Desde `frontend/`:

| Comando                | Resultado                                                |
| ---------------------- | -------------------------------------------------------- |
| `npm run test:unit`    | **78 aprobadas**, 14 archivos                            |
| `npm run check`        | 0 errores, 0 advertencias, 0 sugerencias                 |
| `npm run lint`         | Aprobado                                                 |
| `npm run format:check` | Aprobado                                                 |
| `npm run build`        | 4 páginas compiladas                                     |
| `npm run test:shell`   | 69 aprobadas, incluidos los 58 casos del anexo           |
| `npm run test:assets`  | 2 pruebas del medidor y presupuestos del build cumplidos |

Cobertura frontend: **93.54 % sentencias, 86.72 % ramas, 92.21 % funciones y 95.47 % líneas**. Todos los mínimos vigentes del 85 % se mantienen. El build inicial del analizador mide **110.78 KiB gzip de JS y 11.04 KiB de CSS** (1.81 KiB más de JS que UI-1); las gráficas conservan su carga diferida y los presupuestos no cambian.

Desde la raíz:

| Comando                                                          | Resultado                                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `.venv/bin/python -m pytest`                                     | **461 aprobadas**, 95.28 % de cobertura combinada; dos avisos de bibliotecas registrados por pytest |
| Ruff check y format sobre los cuatro archivos Python modificados | Aprobados                                                                                           |
| `.venv/bin/python -m valoracion.web.contratos --check`           | OpenAPI reproducible y actualizado                                                                  |
| `npm run types:generate` desde `frontend/`                       | Tipos regenerados desde ese contrato                                                                |

## Navegador y continuidad

Se añaden dos escenarios Playwright: catálogo/API real de demo con selección por nombre y envío explícito de una empresa; y catálogo sintético de 1,203 filas para comprobar página/global, límite real, persistencia y reflow. La colección enumera 72 casos en siete archivos para los seis proyectos. **Enumerar no equivale a ejecutarlos.**

La sesión restringe navegador y puertos locales. No se han ejecutado aquí los E2E, capturas, auditoría renderizada ni mediciones de interacción de UI-2, y no se presenta un resultado del CI remoto. La validación del conjunto continúa en UI-5; las pruebas DOM no acreditan contraste renderizado, distribución visual o latencia en dispositivos reales.

UI-3 continúa con resultados, detalle, ajustes e historial. El formulario conserva mientras tanto sus controles existentes de fuente, símbolos adicionales y supuestos. UI-4 concilia la integración y el Excel; UI-5 verifica el conjunto. No se cambian fórmulas, exportador, capacidad de servicio, lanzadores o dependencias. No se ha hecho commit, push ni despliegue.
