# F10 — Calidad integrada y validación visual/operativa

Fecha: 2026-11-13. Base: `6c7ffbf`, cierre de F9. Alcance: SDD_WEB.md 18.5,
WEBT-34 a WEBT-38. **Implementada y verificada localmente con el alcance
actualizado solicitado por el usuario.** No se implementa F11 ni se cambia
el arranque, metodología, contrato financiero, proveedores o catálogo.

## Línea base

458 pruebas Python, dos warnings y 95.28 % combinado en 73.56 s. Frontend:
60 pruebas, statements 92.09 %, branches 85.29 %, functions 90.94 %, lines
94.12 %. No se rebajan umbrales ni se excluyen módulos del dashboard.

## RED → GREEN y verificaciones

| Incremento | Evidencia inicial | Cambio / verificación |
| --- | --- | --- |
| Desconexión/recuperación | Tres caracterizaciones pasan directamente | No se fabrica un RED: reconexión sin POST/filas duplicadas, 410 conserva parciales y segundo lote no mezcla selección/resultados |
| Presupuestos del build | Falta asset-budget.mjs | Parser de JS/HTML que incluye imports estáticos e isla/renderer; tests de límites, dependencias, errores y no doble conteo |
| Imports de Vite | Una prueba con import dinámico en backticks no contaba Charts | Reconocer StringLiteralLike, no sólo StringLiteral; se diferencia el chunk diferido real |
| Capacidad integrada | Falta benchmarks.web_capacity | Proveedor local independiente por símbolo, procesos reales, ASGI/cola/caché/páginas y XLSX reabierto |
| Error numérico accesible | aria-invalid=true no tenía explicación enlazada | Mensaje visible de intervalo con aria-describedby sólo mientras es inválido; se retira al corregir |
| Nombre del botón de empresa | Axe detecta label-content-name-mismatch y el test encuentra texto adicional en el botón | El nombre de empresa permanece en el encabezado de fila, fuera del botón de ticker; área del botón ≥44 px y nombre accesible coherente |
| Tabulación nativa | La prueba del diálogo rechazaba el paso por el chrome del navegador | Se admite sólo ese paso nativo y se conserva la prohibición de foco en controles del fondo; sin añadir trampas de foco |
| WebKit/macOS | Tab no enfocaba el skip link | Probar el atajo nativo Option-Tab sin modificar preferencias globales o semántica del producto |
| Tablas con teclado | WebKit móvil no desplazaba la región del dashboard y luego reprodujo el fallo en la landing al 200 % | Helper compartido sólo cuando la región misma tiene el foco; se respetan botones y Tab; regresión de componente previa y E2E de landing en RED |
| Axe/Firefox | analyze y la lectura directa de ariaLabelledByElements cierran el proceso de la app | Nombres equivalentes mediante aria-label en los cuatro contenedores, compartidos con sus títulos; tres pruebas de aislamiento pasan sin omitir reglas; pendiente matriz normal completa |

Los fallos de ENOSPC al crear perfiles, escribir trazas y terminar pytest son
incidencias del entorno, no RED de comportamiento. Se retiró sólo la caché npm
temporal de F9; el usuario liberó espacio adicional. Las ejecuciones afectadas
no se presentan como aprobadas y se repiten después de recuperar espacio.
La siguiente ejecución no encontró los navegadores cacheados y falló antes de
visitar páginas; se añadió al helper una preparación idempotente de los motores
fijados. No se atribuyen esos fallos de arranque al código de la aplicación.

El diagnóstico posterior separó el fallo de Firefox del espacio disponible:
el proceso de contenido termina con SIGSEGV durante la auditoría. La edición
de campos pasa tanto con ventana como sin ella. De 70 reglas WCAG aisladas,
64 pasan y seis cierran el proceso: aria-allowed-attr, aria-conditional-attr,
aria-prohibited-attr, label-content-name-mismatch, nested-interactive y
target-size. Contraste pasa. La espera de networkidle/fuentes/gráfica no evita
el cierre. No se presenta esta ejecución como una auditoría aprobada ni se
descartan reglas para obtener un resultado verde.

La traza localizó nombres de contenedores. Leer directamente la propiedad
`ariaLabelledByElements` en el formulario real también cierra el proceso; los
mínimos HTML, custom element y documento del mismo origen pasan. Convertir
sólo el nombre del formulario no basta, porque quedan otras regiones con
referencias. Sustituir todas las referencias de nombre por textos equivalentes
hace pasar las auditorías completas de mercado/demo y el control del mismo
origen: tres pruebas, 13.4 s. Se aplica a los cuatro contenedores del producto,
con constantes compartidas con sus títulos. No se modifica ARIA global ni el
motor. Se retiran el fallback legacy, los ajustes experimentales y el diagnóstico
opt-in; la matriz normal debe comprobar ahora la corrección sin excepciones.

## Capacidad medida

Se ejecutó en un proceso nuevo, CPython 3.12.2, Darwin 27.0.0, ARM64 y ocho
CPU lógicas. ASGI TestClient sin TCP, gestor/dominio/Excel reales y procesos
spawn. Se inyectó un proveedor local distinto del de producto, con 500 símbolos
sintéticos USA y 104 MX, copias de datos independientes y precios diferentes.
No se consultó Yahoo ni se amplió la demo. La pausa market de 0.15 s se conserva.

| Medida | Resultado |
| --- | ---: |
| Símbolos/filas únicos | 604 / 604 |
| Estado financiero | 604 OK |
| Tiempo del lote | 109.73 s |
| Cola | Dos pendientes; siguiente solicitud 429; UUID repetido devuelve mismo ID |
| Payload administrado | 6169968 bytes dentro de 67108864 |
| Caché | 512 entradas, límite conservado |
| RSS máximo padre antes | 143097856 bytes |
| RSS máximo padre de campaña | 232128512 bytes |
| RSS máximo de un hijo recolectado | 149340160 bytes |
| Excel | Siete hojas, 604 filas; 393496 bytes; preparación 2.60 s |
| Health durante ejecución | Cinco llamadas in-process entre 0.23 y 0.68 ms |
| Demo tres casos sin caché | 1.396 s |
| Demo con caché, dos repeticiones | 0.002879 s / 0.001388 s |

El tiempo incluye inicio de proceso, orquestación y pausas; no es latencia de
adquisición financiera real. `ru_maxrss` de padre e hijo son máximos separados,
no un pico simultáneo del árbol ni capacidad acreditada para un PaaS. El
presupuesto JSON no mide overhead del intérprete, librerías, copias o buffers.
La campaña es una medición local, sin extrapolación de carga concurrente real.

Resultado seleccionado con contexto y fecha:
[f10-capacity.json](quality/f10-capacity.json). No es una salida financiera
del producto ni una fixture para cambiar sus valores esperados.

## Herramientas y alcance

Se conservan versiones y resoluciones. Playwright 1.65.0 ahora ejecuta los tres
motores a dos viewports; CI instala Chromium, Firefox y WebKit. El perfil de
rendimiento CDP sólo se ejecuta una vez en Chromium y omite sus cinco duplicados
en los demás proyectos; los recorridos funcionales se mantienen en todos.

Los presupuestos se comprueban sobre el build, incluyendo JS inline y runtime
de la isla. El navegador mide tres contextos nuevos, CPU 4×, caché deshabilitada,
viewport móvil y red localhost sin limitación. LCP/CLS son de laboratorio; click
a dos frames es un indicador de respuesta, no INP de campo. No se añade
telemetría al producto ni un service worker.

Las guías Modern Web Guidance de performance/accessibility se consultaron antes
de los cambios. Reglas aplicadas: «DO use dynamic imports» para verificar la
carga diferida existente, y «a description (the actual human readable error
message) is required» para enlazar el error numérico. El texto visible y el
nombre accesible del botón se hacen coherentes sin esconder contenido con ARIA.
El diálogo conserva showModal/close y comportamiento nativo de foco/Esc.

También se verifican combinaciones críticas de texto, error, controles y foco
en la paleta normal mediante el cálculo de luminancia/contraste de
[W3C G18](https://www.w3.org/WAI/WCAG21/Techniques/general/G18) y el criterio
[1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast).
Es una regresión que ya pasa, complementaria a axe y a los estados renderizados;
no acredita por sí sola todas las combinaciones visuales o el alto contraste.

Procedimiento permanente y baselines: [QA_F10.md](QA_F10.md). Las capturas se
inspeccionaron antes de incorporarlas y su comparación posterior pasó.

## Validación posterior y mejora progresiva de la landing

La matriz normal tras el cambio de nombres consiguió 54 aprobadas y cinco
omisiones deliberadas de rendimiento duplicado; quedó un fallo en la landing
WebKit móvil. Las auditorías completas de ambos Firefox y el scroll del dashboard
pasaron. El fallo restante reproduce el mismo problema de flechas en la tabla
estática de la landing al 200 %.

Se comparte el helper entre la región React y la figura Astro. La landing añade
un módulo mínimo de teclado, sin hidratar React ni requerir JS para leer sus
contenidos/enlaces. Se retira la suposición histórica de cero scripts externos
del test HTML; se conserva la ausencia de islas y el presupuesto real de 50 KiB
para todo el JS inicial. No se eleva ese límite. La cobertura incluye ahora todos
los helpers directos de src/lib, además del dashboard; no se mueve código fuera
de su alcance para mejorar porcentajes.

## Resultados finales automatizados y visuales

| Comprobación | Resultado |
| --- | --- |
| Python | 460 aprobadas, dos warnings; 95.28 % combinado; 73.78 s |
| Unitarias frontend | 65 aprobadas, 11 archivos; statements 92.65 %, branches 85.89 %, functions 91.35 %, lines 94.54 % |
| HTML del build / contraste | Seis aprobadas, contenido disponible sin JavaScript |
| Medidor de assets | Dos pruebas aprobadas y presupuestos del build dentro del límite |
| Navegador real | 55 aprobadas en 2.0 min; cinco omisiones sólo del perfil CDP duplicado |
| Píxeles de referencia | Tres comparaciones aprobadas en 8.5 s; panel desktop omitido porque sólo existe en móvil |
| Estilo / tipos / dependencias | Ruff, ESLint, Prettier, Astro check y pip check pasan |
| Contratos / generación | OpenAPI, tipos TS y ejemplo demo sin drift |

Las 54 comprobaciones funcionales recorren los seis proyectos; el perfil CDP
se ejecuta una vez en Chromium. Los PNG candidatos se inspeccionaron antes de
copiar sus bytes como referencias; no se usó update-snapshots para aprobarlos.
La comparación posterior usa el mismo Darwin/Chromium 158.0.8127.18 y viewport.
No equivale a aprobar baselines de Ubuntu ni a probar teléfonos físicos.

| Medida de laboratorio | Resultado final |
| --- | ---: |
| JS inicial de landing | 0.35 KiB gzip |
| CSS de landing | 4.91 KiB gzip |
| JS inicial de app | 106.79 KiB gzip |
| CSS de app | 8.95 KiB gzip |
| Chunk de gráficas | Diferido, ausente del JS inicial |
| LCP de landing, tres visitas nuevas | 156 / 156 / 156 ms |
| CLS de landing, tres visitas | 0 / 0 / 0 |
| Click DOM de filtro a dos frames | 23.5–36.7 ms, doce muestras |
| Event Timing | Sin muestras en este recorrido; no se acredita INP |

Perfil: Apple M1/ARM64, ocho CPU lógicas, Chromium de Playwright, viewport
390 × 844, CPU 4×, caché HTTP deshabilitada y red localhost sin limitación.
Los tiempos no describen una conexión móvil ni experiencia de campo. La demo
caliente medida por servidor tarda menos de 3 s en la campaña descrita arriba.
Reportes seleccionados: [assets](quality/f10-assets.json),
[navegador](quality/f10-browser.json) y [capacidad](quality/f10-capacity.json).

Capturas nuevas revisadas en [images/README.md](images/README.md) y procedencia
en [captura-f10.json](images/captura-f10.json). Referencias de píxeles en
frontend/tests/e2e/__screenshots__/darwin, con entorno, hashes y huella de fuentes.
Los reportes completos y archivos XLSX siguen ignorados en Git.

## Cierre y alcance final

El usuario solicitó eliminar la revisión manual externa. Se retira como requisito
de cierre y como pendiente de F10; no se atribuye una prueba no ejecutada.
Se conservan las comprobaciones automáticas de accesibilidad, teclado, zoom,
foco y contraste, los tres motores y la revisión visual real. Esto no supone
una certificación WCAG global.

F10 queda implementada y verificada localmente. No se cambian las fórmulas,
datos, contratos, API, proveedores, CLI, Streamlit ni arranque. F11 es la siguiente
fase, únicamente al solicitarla. CI remoto y publicación se verifican por
separado; no hubo commit, push ni despliegue durante esta entrega.
