# UI-5 — Revisión integrada en navegador

Estado: **cerrada y verificada en navegador** (2026-11-21). Base de producto: `629b3cd` (UI-4). Inicio de preparación: 2026-11-15; continuación y correcciones: 2026-11-21. Alcance: UI-5 de [SDD_UI.md](SDD_UI.md), sin publicación ni cambios financieros.

## Resultado final

La ronda final `temp/ui5-qa/20261121T231111-940717Z/` aprueba **91 escenarios y omite 11 previstos**, sin fallos ni inestables, en 243.66 segundos. Se ejecutaron 102 escenarios en Chromium 158.0.8127.18, Firefox 159.0 y WebKit 27.2, cada uno con proyecto de escritorio y viewport móvil. Node 26.13.1, Python 3.12.2 y Playwright 1.65.0, en macOS arm64 con Apple M1. Los viewports no acreditan teléfonos físicos.

Las 11 omisiones son cinco del medidor exclusivo de Chromium/CDP y seis por ejecutar las dos matrices completas una vez por motor, sin duplicarlas en sus proyectos móviles. Pasan las 315 muestras de geometría de los tres motores; también paletas, colores extremos, cierre/foco, borradores, recorridos reales y exportaciones XLSX. Las gráficas conservan texto al 200 %, ejes y tooltips dentro de sus límites, separación entre años y unidades correctas. Los años de Finanzas pasan de 0.75 a 30.5 px de separación en el perfil de 375 px al 200 %.

Se inspeccionaron capturas del build final y se incorporaron **ocho imágenes reales, sin modificación**, a [docs/images/ui5](images/README.md#interfaz-vigente--ui-5), incluidas Resultados en ambos modos, Detalle, Ajustes ampliados, las tres gráficas y Selección. Su procedencia, dimensiones, modo, escala y SHA-256 están en [revision.json](images/ui5/revision.json). Las otras candidatas permanecen entre las 43 capturas de la ronda. El manifiesto automático conserva `automated_passed_visual_review_pending`: la revisión visual posterior se acredita en ese registro separado, sin alterar la evidencia original ni sustituir las baselines históricas de F10.

Build SHA-256: `082e7ef2584a12543656f45ceb320b4548a277b107c51e1826dc1a9ffbef2fd3`. Origen: `629b3cd20931b982a6bdc829974b233115cdeafa` con cambios locales; lock SHA-256 `ce3f8f62a3671a3843b72fc73c6d569371cf7cf995488484d35a61603b90a37a`.

En el perfil móvil de laboratorio declarado, las tres muestras finales dan LCP **284/252/268 ms**, CLS **0.06856/0.06856/0.08768** y un máximo de respuesta de ordenación hasta dos frames de **28.5 ms**. Caché HTTP deshabilitada, CPU 4×, localhost sin throttling y tres empresas ficticias; no son INP de campo ni tiempos de Yahoo. El build mantiene **102.91 KiB de JS y 12.58 KiB de CSS gzip** en el analizador y 2.56/6.42 KiB en Cómo se calcula, dentro de los presupuestos.

## Primera ejecución real

El usuario ejecutó `.venv/bin/python qa_ui5.py` en su terminal. El informe de Playwright y las capturas están en `temp/ui5-qa/20261115T084523-853713Z/`; no son referencias visuales aprobadas. Resultado: **48 aprobadas, 43 fallidas y 11 omitidas**, 102 escenarios en ocho archivos. Duración: 24.8 minutos. Navegadores y runtime declarados: Node 26.13.1, Playwright 1.65.0, Chromium 158.0.8127.18, Firefox 159.0 y WebKit 27.2.

El lanzador quedó sirviendo el reporte HTML al fallar. El usuario tuvo que interrumpirlo con Ctrl+C; por ese defecto el manifiesto conservó `status: started`, aunque había terminado de ejecutar las pruebas. Ese valor no acredita éxito. El JSON de Playwright conserva los fallos y se usa como evidencia de esta ronda.

## Causas identificadas y correcciones

| Evidencia de navegador | Corrección |
| --- | --- |
| En los tres motores, la columna fija de empresa mide 296 px dentro de una región de 278 px a 320 px de viewport; tapa las cifras e intercepta el encabezado Diferencia | Contenedor de tabla con tamaño consultable; cuando no cabe su ancho mínimo, la empresa usa 50cqw y las tres columnas numéricas comparten el espacio restante del ancho de tabla. El umbral se expresa en rem para incluir texto ampliado. Se mantienen 37/21/21/21 cuando cabe la tabla |
| Cerrar Detalle pierde el foco de la empresa al regresar por historial | Se registra el elemento que abre el detalle y se devuelve el foco después de completar la navegación atrás; se conservan las entradas del historial, sin duplicarlas ni crear una trampa de foco |
| WebKit no devuelve el foco al botón de Ajustes tras un clic | Se enfoca el botón que abre el modal antes de abrirlo, para que el diálogo nativo conserve el invocador correcto. Se aplica también al enlace de empresa |
| Las pruebas de paleta intentan pulsar un radio deliberadamente oculto y su muestra intercepta el clic | Las pruebas pulsan su etiqueta visible y comprueban el radio marcado. Se conserva el control nativo y no se usa `force` para sortear interacción |
| Varias pruebas pulsan (1,1) como supuesto exterior, pero la captura muestra que ese punto pertenece al rectángulo del modal móvil | El punto exterior se calcula desde el rectángulo y el viewport útil, excluyendo el gutter de scrollbar. Se mantienen las pruebas de padding y arrastres interior/exterior |
| Resumen contiene el selector de Apariencia, que usa un `details` legítimo | La aserción de Métodos/Supuestos sin desplegables excluye únicamente `#palette-switcher` |
| Al cambiar de gráfica, su desplegable Datos puede seguir abierto; la prueba lo cerraba y después buscaba una tabla visible | La prueba abre Datos sólo cuando está cerrado. No cambia la persistencia del control de producto |
| Una prueba del dashboard todavía espera el texto retirado Servicio conectado | Espera al control real de Ajustes habilitado; no se reincorpora un aviso fijo de conexión |
| La captura ampliada y el DOM de Recharts muestran texto de ejes con `fill="#666"`; el selector CSS apunta a una clase anterior de Recharts | Se aplica el token del tema a `.recharts-cartesian-axis-tick-value` y se comprueba el color realmente resuelto en el navegador |

La corrección de tabla se incorpora también al HTML normativo; no se mantiene un prototipo que repita ese defecto. No cambia la estructura lateral/contenido, las cifras, el orden financiero ni las fórmulas.

## Segunda ejecución real y correcciones restantes

La ronda `temp/ui5-qa/20261121T222909-549548Z/` terminó sin servidor HTML bloqueante: **14 aprobadas y 3 fallidas**, 17 escenarios del primer proyecto Chromium, en 1.2 minutos. El lanzador se detuvo antes de ejecutar los otros cinco proyectos; no se acredita esa matriz como aprobada.

- Accesibilidad y dashboard fallan al devolver el foco tras cerrar el detalle después de usar sus pestañas. El retorno se difiere hasta el frame posterior a la navegación por fragmentos, conservando el invocador entre `popstate` y `hashchange`. Una regresión que reproduce ese cambio tardío de foco falla antes y pasa después del ajuste.
- A 768/1024 px con texto al 200 %, el umbral fijo de 600 px dejaba una columna de empresa de 592 px dentro de 718/660 px disponibles. Se sustituye por el ancho mínimo relativo de la tabla: 50rem en la app y 43rem en el anexo.
- A 768 px, la regla `padding: 24px` de los modales borraba el espacio inferior de Ajustes. Ahora sólo modifica el inicio y los laterales, conservando la reserva inferior que crece con el texto para Apariencia. La siguiente ronda guarda también capturas de Ajustes a 768 px y 200 %.
- La inspección de la captura móvil de gráfica detecta ejes recortados aunque el caso automático pasaba. Se retiran los anchos fijos de los ejes numéricos y se permite dimensionarlos por su contenido, con altura automática del eje horizontal y margen superior suficiente. La prueba comprueba ahora los límites reales de cada cifra contra su SVG. La API `width="auto"` está documentada por [Recharts](https://recharts.github.io/en-US/api/YAxis/), y ambas dimensiones automáticas están disponibles en la versión instalada 3.10.1.

En esta ronda sí pasan paletas/colores extremos, cierre exterior y arrastres, datos/contraste/tamaño de gráficas, preferencias CSS y mediciones de rendimiento. Es evidencia del build de esa ronda; no sustituye la ejecución pendiente de las correcciones posteriores ni la revisión de sus capturas.

## Tercera ejecución real

La ronda `temp/ui5-qa/20261121T224014-123779Z/` produjo **15 aprobadas y dos fallidas**, 17 escenarios de Chromium en un minuto. Ya pasan accesibilidad/foco y las **105 muestras de diseño sin fallos**, incluidos los casos intermedios con texto al 200 %. Los otros cinco proyectos no se ejecutaron porque Chromium todavía falla.

Los fallos restantes son posteriores en el recorrido: al guardar ajustes, la etiqueta visible «Modificados» no forma parte del nombre accesible del botón; la comprobación nueva de límites de SVG detecta una fecha recortada en Precio histórico. El botón y su equivalente del anexo ahora incluyen el estado en su nombre. Se mantiene el tamaño del texto y se presentan fechas cortas `dd/mm/aa` sólo en el eje, con margen derecho adicional; tooltip y tabla conservan las fechas completas. La regresión del nombre falla antes de corregirlo y pasa después. Falta verificar estas dos correcciones en navegador.

La cuarta ronda, `temp/ui5-qa/20261121T224648-166658Z/`, repitió **15 aprobadas y dos fallidas**. Añadir el estado al final del nombre no bastaba: axe compara la secuencia de palabras visibles y el botón concatenaba «AjustesModificados»; el nombre intercalaba «de valoración». Ahora el texto visible tiene un espacio explícito y su nombre es «Ajustes Modificados de valoración». La regresión comprueba ambos valores. La fecha corta también sigue siendo señalada; la siguiente ejecución conserva captura y coordenadas de texto/SVG incluso cuando ese caso falla, con la gráfica desplazada a la vista antes de medir. El recorte no se da por resuelto.

La quinta ronda, `temp/ui5-qa/20261121T225301-582636Z/`, pasa a **16 aprobadas y una fallida**: el nombre del botón ya pasa axe. `ui5-ejes-375-Precio-histórico.json` mide el borde derecho de «03/01/25» en 341.805 px y el del SVG en 338 px: sobresale 3.805 px, sin recorte vertical. Se prepara un margen derecho de 48 px sólo en Precio histórico (antes 32 px); sigue pendiente verificarlo con la misma comprobación de límites, sin reducir el texto ni ocultar la fecha.

La sexta ronda, `temp/ui5-qa/20261121T225532-352229Z/`, mantiene **16 aprobadas y una fallida**. El margen estrecha el área de dibujo, pero Recharts reposiciona el texto en las mismas coordenadas. Se retira ese ajuste: las etiquetas horizontales ahora miden su SVG y sus glifos reales y desplazan sólo el texto que exceda sus límites, con una reserva interior de 2 px. La medición se convierte a unidades del viewBox y conserva tamaño, fecha y datos. La captura además mostró un tooltip recortado: se limita su ancho al de la gráfica y se permite partir sus líneas. La prueba lo activa y comprueba sus dos bordes horizontales, además de guardar la captura. Ambos cambios quedan pendientes de navegador.

La séptima ronda, `temp/ui5-qa/20261121T230059-881306Z/`, confirma las etiquetas de Precio histórico dentro del SVG. Mantiene **16 aprobadas y una fallida** porque el tooltip sale por la derecha: Recharts lo traduce 166 px desde el origen del SVG, aunque su ancho sea de 317 px. Se fija `position.x = 0` mediante la API del tooltip en las tres gráficas, conservando su colocación vertical, ancho adaptable y contenido. Falta verificar esa colocación y continuar hasta Finanzas/Márgenes y los otros motores; no se acredita todavía una pasada completa de gráficas.

## Primera matriz completa aprobada y revisión visual

La octava ronda, `temp/ui5-qa/20261121T230359-976710Z/`, completa los seis proyectos: **91 aprobadas, 11 omisiones previstas, cero fallos e inestables**, 102 escenarios en 239.52 segundos. Incluye 17 aprobadas en Chromium desktop y 74 aprobadas/11 omitidas en el resto. Manifiesto: `automated_passed_visual_review_pending`; build SHA-256 `9673c89b62c5d6ba412145a799396067acc16738ae735320da2de65d20e1cb6e`. Conserva 33 capturas.

Se inspeccionaron, entre otras, Resultados móvil oscuro, Detalle escritorio oscuro, paleta blanca en oscuro, gráficas móviles al 200 %, sus tooltips y Márgenes de escritorio. Ejes y tooltips quedan dentro de sus límites. La revisión encontró dos detalles adicionales: años de Finanzas separados sólo 0.75 px y un encabezado de Márgenes que heredaba «Millones de USD» del recurso financiero. Se añade separación mínima de 24 px al eje temporal de años y se cambia esa unidad a «Porcentaje de los ingresos» exclusivamente en Márgenes. La regresión de esa unidad falló antes y pasa con la corrección; el E2E exige además al menos 8 px reales entre etiquetas visibles. La ejecución final incorpora también capturas de Selección, Historial y Cómo se calcula. Estas correcciones posteriores requieren su propia validación; la pasada de esta octava ronda no se atribuye al build nuevo.

Mediciones de esta ronda, en el perfil declarado: LCP 260/260/264 ms; CLS 0.06856 en las tres muestras; máximo de respuesta de ordenación hasta dos frames 28 ms. Son resultados de laboratorio sobre localhost y tres empresas de demo, no latencias del proveedor ni métricas de campo.

## Lanzador reproducible

Desde la raíz:

```sh
.venv/bin/python qa_ui5.py
```

El mismo comando prepara Node 26.13.1 dentro de `temp/ui5-runtime` si el runtime temporal anterior ya desapareció. Reutiliza navegadores compatibles existentes o la caché `temp/ui5-browsers`; descarga sólo los que falten. No actualiza las herramientas globales ni instala dependencias de producto nuevas.

Primero ejecuta todos los casos del proyecto desktop de Chromium. Si falla, conserva su evidencia y se detiene antes de repetir las mismas causas en cinco proyectos más. Si pasa, ejecuta los cinco proyectos restantes. Cada escenario se ejecuta una sola vez en la ronda completa. Los informes se combinan sin perder fallos, omisiones o errores; no se acredita una ejecución vacía, parcial o inestable.

`PLAYWRIGHT_HTML_OPEN=never` evita abrir un servidor de informes. Ctrl+C se registra como interrupción con salida 130, no como cierre exitoso. El directorio de cada ronda conserva comandos, códigos de salida, estadísticas, capturas, mediciones, revisión del repositorio, estado de cambios y SHA-256 del build. Las capturas candidatas no se copian automáticamente sobre documentación ni baselines aprobadas. `npm run capture` usa el mismo lanzador.

## Matriz preparada

- Chromium, Firefox y WebKit, cada uno con proyectos de escritorio y viewport móvil. Un viewport móvil no acredita hardware de teléfono.
- Cinco anchos: 320, 375, 768, 1024 y 1440 px, con texto al 100/200 % y modos claro/oscuro. La matriz completa de anchos se ejecuta una vez por motor; los recorridos restantes cubren también los proyectos móviles.
- Selección, Resultados, Detalle, nueve Ajustes, Historial y Cómo se calcula; ausencia de scroll horizontal de todo el documento, cierre/foco y controles esenciales sin tapar.
- Seis paletas y colores personalizados negro, blanco y rojo, en ambos modos; auditoría automática de contraste sin otra solicitud de análisis.
- Datos de las tres gráficas históricas, tamaño de texto de los ejes, colores del tema y unidades.
- Vidrio CSS utilizable sin Canvas, movimiento/contraste reducidos y capacidades de emulación declaradas. Transparencia reducida mediante CDP en Chromium; no se atribuye a otros motores una emulación que no ofrecen.
- Tres visitas frías en el perfil móvil declarado, CPU 4×, caché HTTP deshabilitada y red local sin throttling. Se conservan LCP, CLS y Event Timing; la ordenación usa clics reales y mide hasta dos frames. Ese indicador no se presenta como INP de campo ni como tiempo de procesamiento de mil empresas.

La prueba de catálogo con 1,203 símbolos sigue separada de la capacidad del servidor: verifica búsqueda, selección y hasta 25 filas montadas, manteniendo el límite API de análisis.

## Verificación local tras las correcciones

- **122 pruebas frontend aprobadas**, 20 archivos; cobertura tras la revisión visual: 93.06 % sentencias, 86.07 % ramas, 92.40 % funciones y 95.13 % líneas.
- **9 pruebas del lanzador aprobadas**, incluidas combinación de informes, ausencia de falso cierre y reporte HTML sin servidor automático.
- El nuevo caso de retorno de foco falló antes del cambio y pasa después de simular la navegación que mueve el foco.
- Tipos: cero errores, advertencias y sugerencias. Lint, formato, build de cuatro páginas y presupuestos de assets aprobados.
- **69 pruebas de shell/anexo aprobadas**, incluidas las 58 del prototipo actualizado. Se recopilan 102 escenarios de navegador; la recopilación no se contabiliza como ejecución.

Las comprobaciones iniciales se ejecutaron con Node 26.0.0; tras la segunda ronda, las 122 pruebas frontend, tipos, lint, build y 69 pruebas de shell/anexo se repitieron con el runtime fijado 26.13.1 que ya preparó el lanzador. No se repitió la suite financiera Python completa de UI-4: sus 476 pruebas son evidencia histórica; el código de cálculo/exportación no se modifica aquí.

## Cierre y reproducción

UI-5 queda cerrada tras la ejecución final y la inspección de sus imágenes. El usuario ejecutó el lanzador en su terminal porque esta sesión no puede lanzar Chromium (`bootstrap_check_in ... Permission denied (1100)`). Se revisaron sus artefactos reales; no se atribuyen esas mediciones a JSDOM ni a las capturas de F10. Las capturas de modales conservan el viewport de la prueba, y las gráficas se fotografían antes de desplazar el modal a su tabla de datos.

El comando de reproducción sigue siendo `.venv/bin/python qa_ui5.py`. Cada ronda nueva requiere su propia revisión de candidatos; el lanzador no aprueba imágenes automáticamente. F11, publicación y verificación del CI remoto quedan separados. No se ha desplegado ni hecho commit/push.

## Seguimiento de CI Linux — `b725546`

El [workflow Web](https://github.com/adndvlp/IntVal/actions/runs/44964709034)
terminó con 90 escenarios aprobados, 11 omisiones previstas y un fallo en
«diseño integrado»: `detalle-light-320-200` y `detalle-dark-320-200` desbordan el
modal en Chromium/Linux. Firefox y WebKit aprobaron esa misma matriz. Es evidencia
RED real del commit publicado; el cierre local anterior no acreditaba Linux.

El usuario recuperó el ZIP de CI mediante `/tmp/ui5-ci.py`. Su `ui5-layout.json`
mide 287 px de ancho útil y 292 px de contenido en ambos fallos, frente a
302/302 px en la última ronda de Chromium/macOS. La diferencia de 15 px de ancho
disponible, asociada a la barra de desplazamiento del modal, deja al descubierto
la restricción de ancho mínimo. Se inspeccionó también la traza de ese estado;
el diagnóstico nuevo permite identificar directamente el elemento si se repite.

El CSS de la tabla de métodos dejaba sus encabezados sin oportunidades de corte
dentro de palabras, mientras las cifras conservan `white-space: nowrap`.
Se añade `overflow-wrap: anywhere` sólo a esos encabezados: permite reducir su
ancho mínimo y repartir el texto en el espacio disponible, sin reducir la fuente,
recortar las cifras ni ocultar el desbordamiento. Según
[CSS Text](https://www.w3.org/TR/css-text-3/#overflow-wrap-property), esas
oportunidades participan en el cálculo del ancho mínimo del contenido.
La relación con el fallo Linux debe confirmarse en la siguiente ejecución real.

La prueba conserva su exigencia de ausencia de desbordamiento. Ahora registra
también las medidas y los elementos que rebasan el contenido del modal, y guarda
una captura en el instante del fallo, antes de cerrar el detalle. Esto evita que
la única imagen de error muestre la página visitada al final de la matriz.
En el caso de 320 px y texto al 200 % comprueba además la tabla con espaciado de
letras de 0.12 em y guarda las dos capturas correspondientes. Es un recorrido
adicional dentro de la misma matriz; no se omiten proyectos ni casos existentes.
Las capturas de ese control se toman después de llevar la tabla a la vista; la
medición ocurre antes de desplazarla. El listado diagnóstico excluye controles
fijos respecto al viewport, que no determinan el ancho del contenido del modal.

Tipos, lint, formato, build de cuatro páginas, 69 pruebas de shell/anexo y
presupuesto de assets pasan después del cambio. No se modifican fórmulas, datos,
API, tamaño de letra, tolerancias, omisiones ni reintentos. La sesión vuelve a
reproducir el bloqueo de Chromium en macOS (`bootstrap_check_in ... Permission
denied (1100)`). La descarga original se obtuvo con el helper desde la terminal
del usuario. La validación del parche en Chromium/Linux sigue pendiente de CI.

El usuario ejecutó después `/tmp/ui5-fix.py`, limitado a la matriz de diseño de
Chromium, sobre el build corregido: **1 prueba aprobada en 15.4 s**, 107 muestras
de geometría y ningún fallo, incluidos ambos modos y el espaciado nuevo. Evidencia:
`temp/ci-ui5-fix/20261122T002532-079628Z/`. Se inspeccionaron su informe y capturas.
Los ajustes posteriores de captura y diagnóstico no cambian el CSS ni las
condiciones de aceptación; se comprobaron sus tipos y estilo. No se atribuye esta
ronda de macOS a Linux ni se marca F11 cerrada antes del nuevo run remoto.
