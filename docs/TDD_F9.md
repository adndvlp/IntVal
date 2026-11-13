# F9 — Dashboard React e integración con la API

Fecha: 2026-11-13. Base: `93a143a`, cierre de F8. Alcance: sección 18.4 de
[SDD_WEB.md](SDD_WEB.md), APP-01 a APP-18 y WEBT-24 a WEBT-33. Sin commit,
push ni despliegue en esta implementación. El arranque por defecto sigue siendo
Streamlit; F10 y F11 no se implementan aquí.

## Línea base y método

Antes del cambio pasan **458 pruebas Python**, dos warnings y **95.28 % de
cobertura combinada**, en 87.57 s. El frontend anterior tiene 14 pruebas
unitarias y cinco de HTML. Se conservan los oráculos, datos de demo, fórmulas,
metodología proxies-1.0, contrato financiero 2.0, catálogo, CLI y API de F8.

Se escribieron primero las pruebas de modelo, transporte, estado y componentes;
se observaron los fallos antes de implementar los módulos. Las regresiones que
ya pasaban se registran como tales, sin fabricar un RED. Las correcciones
visuales parten de capturas del navegador real y mantienen sus exigencias de
legibilidad y ancho. No se rebajó el umbral del 85 % ni se excluyeron los módulos
del dashboard de la cobertura. Se excluyen únicamente tests, fixtures, servidor
de prueba y alias de tipos sin ejecución.

## Ciclos RED → GREEN y revisión

| Incremento | Fallo observado | Cambio y evidencia |
| --- | --- | --- |
| Modelo | Cinco pruebas sin implementación de normalización/filtros/reducer | Símbolos, null, KPI del conjunto filtrado, configuración y generaciones; cinco pasan |
| Transporte | Ausencia de AnalysisApi; AbortError de DOMException se traducía a error de red | DTO runtime, errores públicos, señales, UUID, cursores, históricos y XLSX; once pruebas pasan |
| Estado | Hook inexistente y escenarios de creación/limpieza sin flujo ejecutable | Query keys por contexto, generaciones, UUID estable, cancelación tardía, recuperación y borrador separado |
| Dashboard | Ausencia de formulario/resultados/detalle utilizables | Formulario explícito, tabla paginada, filtros, KPI, detalle y descarga; componentes probados con transporte controlado |
| Recuperación | Un trabajo expirado seguía anunciando «Enviando análisis…» | Se distingue recuperación de creación y se retira el progreso tras error de transporte; sin POST nuevo |
| Históricos parciales | Con estados disponibles y márgenes vacíos se dibujaba una gráfica sin datos | Estado vacío localizado del panel de márgenes, conservando valoración y recurso financiero compartido |
| Campos numéricos | Un campo vacío al perder foco mantenía aria-invalid=false | Validación tras interacción mediante validity.valid; no se envía hasta corregirlo |
| Eventos React | El updater diferido leía currentTarget=null | Capturar validez durante el evento; no retener el evento dentro del updater |
| Primera revisión Chrome | Cuatro fallos nuevos, ocho recorridos anteriores correctos | Dos eran un selector ambiguo de SVG/leyendas; dos eran overflow real con texto al 200 % |
| Reflow | Padding mínimo y botones/opciones impedían redistribuir el texto | Espacio adaptable, opciones flexibles y diálogo dentro del viewport; sin ocultar overflow global |
| Revisión visual al 200 % | Palabras partidas aunque el documento ya no desbordaba | Mayor ancho útil y tipografía adaptable; la prueba exige que «análisis.» ocupe una línea dentro de cada título relevante |
| CTA de demo | La acción esperada «Explorar la demo» no existía en el estado inicial | Se unifica con la landing y se acorta la etiqueta que partía su última letra al ampliar el texto; prueba de navegación por la acción |
| Conteos financieros | Un lote enteramente ERROR terminaba con observaciones, pero faltaba su conteo visible | Se muestran los cuatro conteos del trabajo sin confundirlos con su estado de transporte; diagnóstico y Excel permanecen |
| HTML estático | El HTML anterior mantenía textos de vista previa/preparación | Se presenta el dashboard real y un noscript útil; cinco comprobaciones del build |

La primera ejecución ampliada de cobertura tenía todas sus 39 pruebas verdes,
pero no cumplía los umbrales. Se añadieron recorridos de usuario relevantes:
catálogo de 604 empresas, páginas, validación, recuperación, descarga/limpieza
de Blob, estados financieros y tabla completa. No se cambió la política de CI.
La primera carga diferida de Recharts, instrumentada bajo cobertura, necesitó
una espera explícita de hasta 5 s en su test; el DOM mostraba el fallback de
Suspense. No se sustituyó la gráfica real en sus pruebas específicas.

Durante la verificación se corrigieron errores de las propias pruebas:
`exact` pertenece a Playwright y no a ByRoleOptions de Testing Library; el
catálogo de 604 elementos debía declarar total=604; los enteros porcentuales
se presentan como +12 %, sin decimales obligatorios. Son ajustes de fixtures y
selectores, no cambios de fórmulas ni de los valores públicos esperados.

## Paridad e invariantes verificadas

| Casos | Protección y evidencia |
| --- | --- |
| APP-01–05 / WEBT-25 | Fuente, catálogo, selección total, extras normalizados y nueve supuestos; AnalysisApp.test, model.test y use-analysis.test |
| APP-06–07 | Progreso, conteos por estado, lote mixto o enteramente ERROR y descarga conservada; componentes y API real |
| APP-08–11 / WEBT-28–29 | Filtros que conservan null, orden, KPI filtrados y tabla vacía sin perder detalle/Excel; modelo, tabla y E2E |
| APP-12 / WEBT-30–31 | Selección propia del nuevo lote y cuatro gráficas con unidades/fechas/null/colores estables; modelo, Charts/CompanyDetail y E2E |
| APP-13–14 / WEBT-26 | Borrador separado, configuración efectiva del snapshot y descarga completa; hook y XLSX real |
| APP-15–16 / WEBT-24/27 | Mercado sin POST al abrir, demo una vez en StrictMode, limpiar/cambiar fuente ignora respuestas antiguas; hook/reducer/E2E |
| APP-17–18 / WEBT-32 | Históricos y Excel fallidos localizados, descarga reintentable; componentes y transporte |
| WEBT-33 | Landing → demo → filtros → cuatro vistas → XLSX real reabierto, teclado, móvil y zoom; Playwright |

Los tests del hook comprueban también tres páginas de 201 resultados y su
drenaje antes del cierre, cambio de fuente con respuestas pendientes, borrado
durante POST, cancelación fallida con reintento, almacenamiento bloqueado y
ausencia de datos financieros en sessionStorage. Mercado no se analiza al
abrir. La demo se inicia una sola vez, incluso en StrictMode, y limpiar no la
vuelve a iniciar. La tabla pagina veinte filas y conserva la página al elegir
una empresa; todas sus columnas financieras pueden mostrarse con encabezados
semánticos y guiones para valores ausentes.

La descarga E2E modifica la tasa del borrador de 10 % a 15 % sin reanalizar,
filtra hasta vaciar la tabla y descarga el snapshot completo. El verificador
Python reabre las **siete hojas**, encuentra las tres empresas, comprueba los
73 campos de Detalle y la tasa aceptada de **0.1**. Las medianas siguen siendo
**116.1879930510067 USD** y **209.138387491812 MXN**. Las cifras esperadas
proceden del ejemplo público anterior, no de una ejecución nueva del motor.

## Guías y decisiones de interfaz

Se consultaron Modern Web Guidance y el flujo local de Sites; se conserva el
repositorio Astro y no se registra ni publica un sitio externo. Las guías se
buscaron y recuperaron con el CLI instalado en un prefijo temporal. No forman
parte de las dependencias del producto.

| Guía | Instrucción aplicada y resultado |
| --- | --- |
| responsive-table | «Add a tabindex="0" attribute to the container»: tabla semántica, región nombrada, scroll propio, primera columna/encabezados fijos |
| forms | «DON'T auto-submit a form when a user changes»: análisis con envío explícito; fieldsets, labels, restricciones nativas, helper buttons type=button y foco en error |
| accessible-error-announcement | aria-invalid tras interacción y mensajes localizados; no se anuncian excepciones privadas ni errores prematuros de todos los campos |
| dialog | «DON'T set display on dialog unconditionally»: showModal/close, ::backdrop y comportamiento nativo de foco/Esc, sin trampas manuales o bloqueo global del body |
| responsive-design | «Use @container queries»: componentes adaptables al ancho útil; unidades rem con límites y unidades dinámicas para el diálogo |

Se inspeccionaron además las guías y tipos de las versiones instaladas de
TanStack Table v9 y Query. La aplicación usa useTable y features de v9; no
contiene un adaptador de v8. Recharts no usa Cell, ya obsoleto en la versión
instalada. Los componentes nativos no justifican incorporar shadcn/ui en esta
fase. No se actualizó otra dependencia por avisos del instalador.

## Dependencias y comprobaciones

Node **26.13.1**, npm **11.12.1**, CPython **3.12.2**, macOS ARM64.
El usuario preparó el lock real y completó `npm ci` desde cero: 524 paquetes.
Se añaden sólo TanStack Query **5.107.1**, Table **9.3.1**, Recharts **3.10.1**
y axe Playwright **4.14.0** como dependencia de desarrollo. Las versiones de
Astro, React, TypeScript, Playwright y las resoluciones Python se conservan.

El agente no puede abrir los puertos locales/Chrome por las restricciones de
la sesión. El usuario ejecutó el helper temporal con los runtimes fijados y el
build real, compartiendo sus resultados. Se revisaron los archivos producidos;
no se atribuye esa ejecución al sandbox del agente. Los comandos permanentes
para reproducirla están en [development.md, sección 11](development.md#11-dashboard-react-f9).

| Comprobación | Resultado |
| --- | --- |
| Python completo | 458 pasan, dos warnings, 95.28 % combinado, 79.91 s |
| Unitarias frontend | 60 pasan; statements 92.09 %, branches 85.29 %, functions 90.94 %, lines 94.12 %; umbrales del 85 % conservados |
| Navegador real | 12 pasan en 29.3 s: escritorio y viewport móvil; sin errores JS en el recorrido de demo |
| Excel descargado | Reabierto y conciliado por Python en ambos viewports |
| axe | Sin infracciones en el estado del dashboard recorrido para las etiquetas WCAG seleccionadas |
| Capturas | Escritorio, móvil y diálogo revisados; PNG seleccionados y procedencia en docs/images |
| Contratos | OpenAPI y ejemplo demo sin drift; tipos generados conservados |

Los avisos Python son los conocidos de la suite, sin nuevas llamadas de mercado.
Lint, formato, tipos, build estático y sus cinco pruebas HTML pasan; la
implementación no modifica la metodología, el servicio de F8 ni el arranque.

## Límites y continuidad

Los viewports móviles se prueban en Chrome de escritorio; no equivalen a un
dispositivo físico, Safari o Firefox. Axe y teclado/Esc no certifican toda la
accesibilidad: lector de pantalla, contraste manual completo y varios motores
se revisan en F10. Las capturas son evidencia de UI real; no son baselines
automáticos de comparación de píxeles ni imágenes de diseño conceptual.

La API conserva sus trabajos/cachés temporales en un proceso ASGI. Un reinicio
puede perder el ID; guardar la referencia en la pestaña no evita esa pérdida.
No se han medido aquí RSS, carga PaaS, LCP/INP o capacidad real del alojamiento.
No se consultó Yahoo en el recorrido de demostración. La primera descarga de
estáticos y las dependencias requieren los medios habituales de distribución;
«demo sin red financiera» no implica un service worker offline.

La última ejecución de navegador de 29.3 s incluye los conteos por estado,
el CTA abreviado y las correcciones de layout/campos. El CI remoto del nuevo
commit y una URL publicada se verifican por separado.

**Siguiente fase: F10**, sólo cuando se solicite. Leer SDD_WEB.md 18.5 y 21.8:
calidad integrada, varios motores, revisión manual y mediciones con contexto.
Conservar TDD, fórmulas, contratos y Streamlit. F11 prepara la distribución
agnóstica y cambia la entrada; no aplicar un Blueprint o desplegar por inferencia.
