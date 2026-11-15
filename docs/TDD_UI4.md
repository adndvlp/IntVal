# UI-4 — Paridad de datos, configuración y Excel

Fecha: 2026-11-15. Base: `afea906` (UI-3). Alcance: UI-4 de [SDD_UI.md, 16.3](SDD_UI.md#163-secuencia-de-implementación). UI-5 continúa pendiente. No se modifica el HTML normativo ni se despliega.

## Cambios de producto

La validación de respuestas ya no usa los intervalos del formulario. La API permite factores de crecimiento de 0 y múltiplo de utilidad de 35; son snapshots legítimos aunque el formulario nuevo ofrezca intervalos más estrechos. El cliente conserva esas respuestas y valida los nueve valores con los límites publicados por OpenAPI. También exige las nueve constantes efectivas de lectura: no rellena un horizonte o una tasa ausente con un valor supuesto. El contrato del servidor permanece igual.

El detalle muestra la fecha de referencia de la empresa guardada en el snapshot. Ya no la sustituye por la referencia de metadatos actuales; una fecha ausente se indica como No disponible. El formateador conserva UTC explícito para que una fecha de calendario no retroceda un día según la zona del navegador. No se incorpora una dependencia de calendario para esta presentación sin aritmética temporal.

Precio histórico y Finanzas verifican fuente, símbolo, versión del conjunto y moneda contra el snapshot abierto. Una respuesta ajena produce un error localizado con reintento; no se presenta como datos de la empresa ni rompe Resumen. Márgenes comparte el mismo recurso financiero validado. Los importes ya convertidos a la moneda de cotización, millones y ratios se reciben de Python sin recalcularlos en JS.

La preferencia de configuración confirmada exige números finitos antes de validar rango y paso. Un texto numérico o un booleano en almacenamiento no se convierte implícitamente en una tasa o factor. La sesión corrupta se descarta; Guardar, Restablecer y la inmutabilidad del trabajo mantienen las reglas transaccionales de UI-3.

## Excel real y oráculo de paridad

`frontend/scripts/export_contract.py` abre el XLSX con openpyxl y lo compara con el snapshot HTTP completo. No importa el motor, el adaptador ni el generador del Excel para producir sus valores esperados. Comprueba:

- Siete hojas, sin reemplazarlas por las hojas del prototipo: Resumen, USA, MX, Detalle, Supuestos, Universo y Fuentes.
- Todas las empresas y particiones por mercado, sin duplicados ni reducción por búsqueda/página/empresa abierta.
- Las 24 columnas de resumen: precio, cuatro métodos y sus diferencias, mediana, analistas, estado, notas, versiones, inclusión y clase.
- Los 73 campos de auditoría por empresa, junto con moneda de estados/cotización, FX, fuentes, fechas y períodos del DTO.
- Los nueve ajustes y las constantes efectivas, versiones y cuatro tratamientos financieros en Supuestos; configuración por empresa cuando existe.
- Universo y sus fuentes canónicas en los cuatro casos de integración. Estas hojas describen el universo, no las empresas efectivamente analizadas; esas empresas están en Resumen/USA/MX/Detalle.

Se comparan valores numéricos originales, con tolerancia de serialización XLSX (`rel_tol=1e-12`, `abs_tol=1e-9`), no cifras redondeadas de pantalla. Una ausencia debe seguir vacía: cero no la sustituye. El oráculo se prueba alterando mediana, auditoría, configuración, lote, moneda, fuente y una celda ausente; rechaza las divergencias.

`verify-export.py` conserva la comprobación anterior de la demo y admite `--snapshot` para conciliar cualquier configuración del lote descargado. Se ejecutaron ambos modos, con el libro inicial y el recalculado. El escenario de navegador ahora conserva el snapshot y usa este cotejo para las descargas desde Resultados y Detalle; su ejecución real queda en UI-5.

Esta verificación acredita paridad de transporte/exportación. La corrección de fórmulas se conserva mediante los oráculos financieros independientes existentes y la suite Python completa; no se presenta esta comparación como una validación económica nueva del método.

## Intercambios reproducibles entre Python y React

`tests/fixtures/intercambio_ui4.py` ejecuta FastAPI con TestClient ASGI, el gestor real y proveedores locales. Genera JSON y XLSX nuevos en un directorio temporal para cuatro casos:

| Caso | Datos y comprobación |
| --- | --- |
| Inicial | Tres empresas de demo, USD/MXN, cuatro métodos y una empresa sin estimación; mediana USA de 116.1879930510067 |
| Ajustes guardados | Los nueve valores cambian: tasas 15.5/6.5 %, factores 72.5/40.5/32.5 % y múltiplos 13/16/17/18; Python recalcula y cambia los resultados |
| Compatibilidad API | Crecimiento 0/7.5 %, tasa 5.75 % y múltiplo de utilidad 35; lectura legítima sin ampliar las opciones del formulario |
| Mercado sintético | FX USD→MXN de 20, métodos excluidos por balance incompleto, diferencia negativa, FX ausente y error del proveedor; no son cotizaciones reales ni hay llamadas a Yahoo |

El colector drena los resultados de una fila por página incluso cuando `done=true`: ese indicador significa trabajo terminal, no fin de las páginas disponibles. El cursor debe alcanzar `processed` antes de comparar el lote completo.

`parity.test.tsx` genera esos intercambios durante Vitest y suministra al `fetch` del cliente las respuestas reales guardadas, incluidos los bytes reales del XLSX. No usa un servidor TCP. Valida que el transporte conserve todos los valores, históricos y unidades. En el flujo de componentes se seleccionan tres empresas, se busca/ordena, se cambian los nueve campos, se abre Detalle y se descarga desde ambos botones. Mientras hay una descarga ambos botones están ocupados. Los bytes descargados corresponden al libro completo anterior, aunque el borrador tenga otros ajustes. Cambiar paleta y modo oscuro mediante los controles reales no crea otro POST ni cambia ese libro. El POST siguiente coincide con los nueve ajustes que Python recalculó; Historial recupera el análisis anterior sin un tercer POST.

El proveedor local sustituye sólo la adquisición remota. No sustituye cálculo, gestor, validación HTTP, adaptación ni exportación. El adaptador de `fetch` de la prueba React reproduce intercambios capturados; no se declara una prueba de navegador o una conexión TCP completa. Los archivos temporales de Vitest se eliminan al terminar y no se añaden binarios ni fixtures financieras congeladas al repositorio.

## Ciclo TDD

Antes de modificar producto, 12 casos de transporte fallaron: tres límites API legítimos se rechazaban y nueve constantes ausentes se aceptaban. Cinco casos de Detalle fallaron por fecha ajena al snapshot y por aceptar dataset/moneda ajenos en los dos recursos históricos. Dos casos posteriores de preferencia corrupta fallaron por coerción implícita de texto/booleano. Se implementaron los cambios y se repitieron las suites afectadas y la suite frontend completa.

El oráculo nuevo se incorporó tras un fallo de importación observado; después se verificó tanto un lote correcto como sus mutaciones. Durante su preparación se corrigió el colector de la prueba para agotar cursores en trabajos terminales. No se modificó el servidor para ajustar sus respuestas a la prueba.

## Verificación local

| Comprobación | Resultado |
| --- | --- |
| `python -m pytest -q` con `.venv` | **476 aprobadas**, incluidos 15 casos nuevos de paridad; cobertura combinada **95.44 %** |
| `npm run test:unit` | **120 aprobadas**, 20 archivos |
| `npm run check` | 0 errores, advertencias o sugerencias |
| `npm run lint` y `npm run format:check` | Aprobados |
| Ruff check y format check de todo el proyecto | Aprobados |
| `npm run build` | Cuatro páginas estáticas |
| `npm run test:shell` | **69 aprobadas**, incluidas las 58 del anexo |
| `npm run test:assets` | **2 aprobadas** y presupuestos del build aprobados |
| OpenAPI y demo pública con `--check` | Sin divergencias |
| `npx playwright test --list` | **72 escenarios recopilados** en siete archivos; sin ejecución |

Cobertura frontend: **93.52 % sentencias, 86.23 % ramas, 92.28 % funciones, 95.54 % líneas**; todas superan el mínimo del 85 %. Python conserva dos avisos existentes: parseo de fechas de una prueba y deprecación del transporte TestClient/httpx de Starlette. No afectan al resultado de las pruebas.

Para las pruebas frontend ahora se requiere la `.venv` de desarrollo de la raíz, ya preparada en CI antes de Vitest. Se documenta en [development.md](development.md). No hay instalación adicional ni puertos para la comprobación de paridad.

## Continuidad

La matriz de resolución de GAP-01–08 está en SDD_UI §14.2; GAP-09 corresponde a UI-5. El límite inferior de descuento de empresa sigue en 5 % conforme al servidor, con la diferencia de 4 % del anexo documentada. Se conserva el contrato financiero 2.0, metodología proxies-1.0, OpenAPI, exportador, colas, límites y recuperación.

La siguiente entrega es **UI-5: revisión del conjunto en navegador, responsive, apariencia y rendimiento**. Esta sesión no ejecutó Chrome/Firefox/WebKit ni abrió puertos locales; las pruebas E2E actualizadas sólo se recopilaron. No hay capturas o baselines nuevos aprobados, ni comprobación de CI remoto, publicación o despliegue. Tampoco hay commit/push realizado por el agente.

El HTML normativo permanece intacto, con SHA-256 `06694e7ba2628dbb0910243e72f80118f3caaa6c861e1ab505905fb16fafdb8f`.
