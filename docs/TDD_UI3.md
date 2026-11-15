# UI-3 — Resultados, detalle, ajustes e historial

Fecha: 2026-11-15. Base: `aa1e533` (UI-2). Alcance autorizado: el siguiente incremento de [SDD_UI.md, 16.3](SDD_UI.md#163-secuencia-de-implementación), UI-3. Se conserva el HTML normativo y el backend. UI-4 y UI-5 quedan pendientes.

## Resultado

Resultados presenta Empresa, Precio, Valor estimado y Diferencia. Búsqueda y orden se aplican al lote completo antes de paginar a 25 filas. La ordenación inicial es Diferencia descendente; una columna nueva empieza ascendente, las ausencias quedan al final en ambos sentidos y los valores originales conservan su precisión. Las tres columnas numéricas comparten ancho y eje con sus encabezados; la flecha no ocupa espacio dentro del texto centrado. Se mantienen encabezado y empresa durante el desplazamiento. Se retiran filtros, columnas opcionales, KPI y enlaces repetidos por fila.

El nombre abre un `dialog` nativo sobre la comparación. Resumen contiene una sola comparación de precio/estimación, los cuatro Métodos y los Supuestos siempre visibles. Precio histórico, Finanzas y Márgenes reutilizan recursos, validación, caché y errores del transporte existente. Recorrer pestañas con flechas no solicita datos hasta activarlas. No se consulta un histórico al abrir Resumen. La empresa desconocida no se sustituye por la primera del lote. Cerrar conserva búsqueda, orden y página de resultados.

Ajustes abre nueve campos visibles en tres grupos. El formulario trabaja sobre una copia: Guardar confirma para el siguiente análisis; Restablecer modifica esa copia; cerrar sin guardar descarta incluso el restablecimiento. Se validan valores requeridos, rango y paso, con error asociado y foco en el campo. Los porcentajes se convierten a ratios al enviar. El snapshot y su Excel mantienen los ajustes aceptados por su propio trabajo.

Historial reúne referencias reales de esta sesión de navegador con fuente, nombres/símbolos, cantidad, estado y fecha. Reabrir consulta el mismo ID, recupera sus empresas y no hace otro POST. No se importan los trabajos ficticios del HTML. Los trabajos activos conocidos actualizan su estado en segundo plano cada cinco segundos, dentro de la retención comunicada por la API; no se adquieren sus filas financieras hasta abrirlos.

## Continuidad de trabajos y persistencia

Se conservan generaciones, revisiones, cursores, recuperación, resultados parciales, cola, cancelación y reintentos idempotentes. Navegar, abrir otro análisis o editar la fuente del borrador no cancela un trabajo aceptado. La misma intención activa —fuente, símbolos y nueve ajustes— reabre el trabajo; cambiar los ajustes distingue una intención nueva. No se copian temporizadores del prototipo ni se crean procesos desde el cliente.

Cancelar solicitud antes de recibir el ID descarta esa vista y cancela el trabajo si el servidor lo acepta después. Una aceptación tardía tras navegar se registra en Historial y no sustituye el trabajo visible ni se cancela automáticamente. Se sigue tratando la cancelación explícita, caducidad, desconexión y respuesta antigua por separado.

Persistencia en `sessionStorage`, separada por API y con versión 1:

- `intval.configuration.v1:{api}`: sólo los nueve valores confirmados, validados y sin propiedades desconocidas.
- `intval.history.v1:{api}`: referencias, revisiones, datos de identificación y solicitud aceptada; hasta tres etiquetas por entrada, acotado por `meta.limits.max_retained`.
- Se mantienen `intval.analysis.v1:{api}`, las claves de selección de UI-2 y las claves independientes de apariencia.

No se guardan filas financieras, auditoría de 73 campos, históricos ni objetos del proveedor. Lectura corrupta, duplicados o almacenamiento bloqueado no impiden trabajar durante la visita. Historial no ofrece persistencia remota ni garantiza recuperar un ID después de reiniciar el servidor.

## Diferencias explícitas del anexo

- Descuento de empresa usa **5–20 %**, porque la API vigente exige al menos 5 %. El anexo conserva 4–20 %. Se documenta en SDD_UI §8; no se amplía el dominio financiero desde esta entrega visual.
- Los factores de crecimiento y múltiplo de utilidad usan los límites de la SDD visual. La API conserva sus intervalos anteriores más amplios. Sus valores iniciales y fórmulas no cambian.
- GAP-03 queda resuelto en producción mediante borrador transaccional. El comportamiento del botón Restablecer del HTML permanece como referencia histórica explícita.
- Para GAP-02 el frontend envía los ajustes confirmados y muestra los supuestos del snapshot real. No simula un recálculo con números precargados. La conciliación completa de todos los datos y hojas pertenece a UI-4.
- Historial usa los límites del servidor, no las seis entradas ni los temporizadores de demostración.

## Ciclo TDD y trazabilidad

Los nuevos casos de ResultsTable se ejecutaron sobre la tabla anterior y fallaron antes de implementarla. Se añadieron pruebas del flujo conectado, modales, ajustes, referencias e historial, y se adaptaron las regresiones existentes a los controles nuevos. Un último caso de Historial falló por no mostrar la fuente de cada entrada; después de incorporar ese dato y retirar el rótulo fijo «Servicio conectado», la suite completa quedó en verde.

| Criterio | Evidencia local |
| --- | --- |
| UI-T04–05 | `use-analysis.test.tsx`, `AnalysisApp.test.tsx`, `UI3.test.tsx`: recuperación, cursores/revisiones, resultados parciales, edición sin cancelar, intención activa, aceptación tardía y cancelación antes del ID |
| UI-T06 | `ResultsTable.test.tsx`: cuatro columnas, orden global numérico/textual, ausencias, identidad DOM/foco, 1,203 filas con páginas de 25 y búsqueda normalizada |
| UI-T07 | `CompanyDetail.test.tsx`, `Charts.test.tsx`: Resumen sin consultas, Métodos/Supuestos visibles, pestañas, carga bajo demanda, períodos, fallos/vacíos y reintento local |
| UI-T08 | `SettingsDialog.test.tsx`, `accessibility.test.tsx`, `AnalysisApp.test.tsx`, `UI3.test.tsx`: nueve campos, escala de envío, límites/paso, error asociado, copia transaccional y conservación del snapshot |
| UI-T13 | `Modal.test.tsx`: cierre exterior por geometría, clic/padding interiores, arrastre, cancelación del cierre y fallback; foco nativo y Escape reales pendientes de navegador |
| Persistencia | `analysis-history.test.ts`, `SettingsDialog.test.tsx`, `workspace-route.test.ts`: IDs/revisiones, retención, solicitud, sesión corrupta/bloqueada y rutas de detalle válidas |
| Exportación | `AnalysisApp.test.tsx`: mismo ID pese a búsqueda, fallo y reintento, validación de descarga y conservación de resultados; dos regresiones Python dirigidas mantienen configuración y números del Excel anterior |

JSDOM no implementa `showModal`, `close` y `requestClose`: `tests/support/dialog.ts` suministra exclusivamente métodos de prueba y eventos. No simula ni acredita render, inert nativo, Escape o restauración real del foco. La implementación de producto usa el elemento nativo, con `closedby="any"` y fallback geométrico cuando falta soporte.

## Verificación local

Desde `frontend/`:

| Comando | Resultado |
| --- | --- |
| `npm run test:unit` | **92 aprobadas**, 19 archivos |
| `npm run check` | 0 errores, 0 advertencias, 0 sugerencias |
| `npm run lint` | Aprobado |
| `npm run format:check` | Aprobado |
| `npm run build` | Aprobado, cuatro páginas estáticas |
| `npm run test:shell` | **69 aprobadas**, incluidas las 58 del anexo |
| `npm run test:assets` | **2 aprobadas** y presupuestos del build aprobados |
| `npx playwright test --list` | **72 escenarios recopilados**, siete archivos; sin ejecución |

Cobertura frontend: **93.16 % sentencias, 85.45 % ramas, 92.03 % funciones y 95.25 % líneas**. Las cuatro métricas superan su mínimo del 85 %.

Desde la raíz se ejecutaron estas dos pruebas Python, sin cobertura global por ser una selección dirigida:

```sh
.venv/bin/python -m pytest tests/api/test_operaciones_f8.py::test_excel_conserva_tasa_y_numeros_de_analisis_anterior_a_otro_lote tests/api/test_fundamentos.py::test_supuestos_web_convierten_a_dominio_sin_cambiar_los_defaults_heredados -o addopts='' -q
```

Resultado: **2 aprobadas**. Hay un aviso de deprecación de Starlette sobre su transporte de TestClient/httpx. No se cambian dependencias para resolverlo dentro de UI-3. La suite Python completa de UI-2 no se repitió en esta entrega, que no modifica código Python ni contratos.

## Límites y siguiente incremento

Los escenarios E2E se actualizaron para el flujo real, alineación de ejes, descarga, pestañas, cierre exterior, teclado y reflow, pero **no se ejecutaron**: esta sesión sigue restringiendo navegador y puertos locales. La recopilación sólo valida descubrimiento de tests. No se aprobaron baselines visuales nuevos; las referencias F10 no acreditan el render actual. UI-5 debe comprobar foco nativo, los tres motores, alineación óptica, móviles, ampliación al 200 %, contraste renderizado y rendimiento.

UI-4 continúa con paridad completa de datos, exportación real y diferencias de integración. No se instalan dependencias nuevas ni se modifican fórmulas, contratos, lanzadores o despliegue. No se realiza commit, push ni publicación. El SHA-256 del anexo permanece `06694e7ba2628dbb0910243e72f80118f3caaa6c861e1ab505905fb16fafdb8f`.
