# Investigación de UX/UI para IntVal

Fecha de consulta: **14 de noviembre de 2026**.

Encargo: investigar prácticas de experiencia de usuario, diseño visual y tecnologías que permitan aplicarlas, considerando adopción, satisfacción y rendimiento. Este documento registra investigación y recomendaciones; no cambia la aplicación, su metodología financiera ni la SDD.

## 1. Resultado de la investigación

Para IntVal recomiendo una interfaz de producto con **jerarquía clara, composición cuidada, controles familiares y datos fáciles de comparar**. La identidad debe construirse con tipografía, espaciado, color, proporción y presentación del producto. La capacidad existente —análisis por lotes, recuperación, resultados parciales, gráficas y Excel— debe seguir disponible con una operación automática.

La combinación técnica con mejor encaje es **Astro + React + TypeScript + Tailwind, componentes propios apoyados en shadcn/ui, TanStack Query/Table y las gráficas existentes**. Motion y Lucide son complementos posibles para necesidades concretas. La selección se apoya en compatibilidad con el repositorio, documentación y señales de adopción; instalar más componentes no resuelve por sí mismo el diseño.

Una recomendación de estilo para esta aplicación es mantener las superficies de trabajo sobrias y legibles, con una landing de mayor expresividad. Es una conclusión de diseño para este caso, pendiente de contrastar en una propuesta visual completa; no es un supuesto ranking universal de gustos.

## 2. Cómo se investigó y cómo interpretar las fuentes

Se contrastaron cuatro tipos de fuentes:

| Tipo                                                  | Qué permite concluir                                                      | Alcance                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Investigación y guías de usabilidad                   | Patrones, problemas observados y criterios para organizar la interacción  | Deben adaptarse a la tarea y al público; no prescriben un mismo aspecto visual        |
| Sistemas de diseño y casos publicados por sus equipos | Cómo se resuelven tipografía, contraste, densidad, estados y consistencia | Son referencias de implementación, no experimentos que prueben superioridad universal |
| Encuestas de desarrolladores                          | Adopción declarada y satisfacción con herramientas                        | No miden el gusto de los usuarios finales de IntVal                                   |
| Documentación técnica oficial                         | Capacidades, restricciones y opciones de integración                      | El rendimiento de IntVal requiere medición en su propio build                         |

Se leyeron las páginas originales, incluyendo apartados que matizan las recomendaciones. En las dos publicaciones académicas citadas se consultaron sus resúmenes y alcance; no se presenta eso como una revisión completa de sus artículos. Las páginas inaccesibles no fundamentan las conclusiones.

También se inspeccionaron `frontend/package.json`, la SDD web, `AnalysisForm.tsx`, `ResultsTable.tsx`, los tokens visuales y el prototipo HTML. Las observaciones sobre estos archivos son una revisión del código. No equivalen a una sesión de usabilidad ni a una inspección visual de navegador.

## 3. Prácticas de UX con mejor fundamento para esta aplicación

### 3.1 Permitir comenzar con la tarea

Las aplicaciones con muchas funciones deben permitir empezar a trabajar sin consumir primero un tutorial. NN/g también recomienda recorridos flexibles, conservar el contexto y facilitar la conexión con herramientas como Excel. En IntVal esto favorece una entrada directa al análisis, con ayuda junto a la decisión que la requiere. El material metodológico debe poder consultarse durante el trabajo. [NN/g: diseño de aplicaciones complejas](https://www.nngroup.com/articles/complex-application-design/).

**Aplicación propuesta:** una entrada pública que explica la utilidad y lleva al analizador; dentro del analizador, búsqueda, selección, ejecución y resultados mantienen una relación evidente. La landing y la herramienta tienen objetivos distintos y deben compartir identidad. La elección de qué ruta abre el prototipo no demuestra por sí misma que su UX haya mejorado.

### 3.2 Mostrar acciones reconocibles

La información y las operaciones visibles reducen la necesidad de recordar cómo funciona la interfaz. El contexto y el historial ayudan a retomar tareas. [NN/g: reconocimiento y recuerdo](https://www.nngroup.com/articles/recognition-and-recall/).

**Aplicación propuesta:** buscar por nombre y símbolo cuando el catálogo disponga de ambos; mostrar la empresa, mercado y moneda; ofrecer acciones con texto visible. Un nombre accesible correcto en el código no sustituye un rótulo visible comprensible. «Ver análisis», «Quitar selección» y «Descargar análisis completo» describen mejor su alcance que una flecha o varios botones llamados «Limpiar».

### 3.3 Hacer evidente la acción principal

GOV.UK recomienda que el texto del botón describa la acción y que los botones principales no compitan entre sí. Esa convención ayuda a distinguir el siguiente paso. [GOV.UK: botones](https://design-system.service.gov.uk/components/button/).

**Aplicación propuesta:** «Analizar 2 empresas» comunica acción y alcance. La búsqueda y la selección deben quedar asociadas a ese botón. Exportar, ajustar y consultar metodología pueden seguir visibles con menor peso. Un botón deshabilitado necesita una causa comprensible en su contexto.

### 3.4 Reducir ruido conservando capacidad

La presentación progresiva reserva opciones especializadas para cuando se solicitan. Su condición importante es mantener en el primer nivel lo que se necesita con frecuencia y hacer evidente cómo acceder a lo demás. [NN/g: presentación progresiva](https://www.nngroup.com/articles/progressive-disclosure/).

**Aplicación propuesta:** valores iniciales de valoración utilizables y ajustes agrupados; detalles financieros al abrir una empresa; estado resumido del análisis. La cola, la recuperación y la sincronización se resuelven automáticamente. La disponibilidad de una función no exige exponer su configuración técnica.

Ocultar todos los filtros tampoco es una regla válida: si un filtro se usa repetidamente, debe quedar al alcance. Los criterios activos deben poder reconocerse y retirarse sin reconstruir mentalmente la consulta.

### 3.5 Distinguir selección, análisis y resultado

**Conclusión para IntVal:** las empresas y los parámetros que se están editando corresponden al siguiente análisis; los resultados y el Excel corresponden al análisis que ya se ejecutó. Cambiar la selección no debe hacer parecer que los resultados existentes se recalcularon. Deben verse el origen, la fecha y el estado del resultado que se está consultando.

Esta separación se apoya en el contrato ya existente del proyecto. Su representación visual debe evaluarse con tareas concretas: cambiar una empresa, revisar un resultado anterior y exportarlo sin confundir sus supuestos.

### 3.6 Dar respuesta y mantener continuidad

Una interacción debe producir respuesta visual rápida, aunque el trabajo completo tarde más. INP mide la rapidez con que se presenta el siguiente cambio visual; no mide todo el tiempo de una petición de datos o un cálculo. [web.dev: INP](https://web.dev/articles/inp).

**Aplicación propuesta:** mostrar que la solicitud se recibió, progreso basado en datos reales, empresas procesadas y resultados parciales. Ante una desconexión, mantener lo disponible y explicar la recuperación. La cancelación conserva el trabajo obtenido según el comportamiento ya definido. Los mensajes usan lenguaje de la tarea; la persona no configura procesos, TTL ni reintentos.

### 3.7 Ofrecer errores que se puedan resolver

La guía de errores de GOV.UK distingue los errores de entrada de los problemas del servicio y pide conservar lo introducido al mostrar una validación. [GOV.UK: mensajes de error](https://design-system.service.gov.uk/components/error-message/).

**Aplicación propuesta:** «Elige al menos una empresa» junto a la selección; «Introduce una tasa entre…» junto al campo; «No se pudieron obtener datos de esta empresa» junto a ese resultado. Un fallo de adquisición no debe presentarse como un error de escritura del usuario. El resto del lote puede continuar.

### 3.8 Priorizar comparabilidad en las tablas

Las tablas útiles mantienen atributos y formatos consistentes, permiten escanear los datos y evitan trasladar al usuario la carga de recordar valores entre páginas. Las recomendaciones para tablas de comparación de pocas opciones no deben trasladarse literalmente a un catálogo de cientos de empresas. [NN/g: tablas de comparación](https://www.nngroup.com/articles/comparison-tables/).

**Aplicación propuesta:** un resumen con empresa, precio por acción, valor estimado, diferencia y estado; cifras alineadas y monedas explícitas; ordenación y filtros comprensibles. Los cuatro métodos y los datos extensos permanecen disponibles en el detalle o en una vista ampliada.

Carbon documenta una base estable para estructura, encabezados, selección y varias densidades de fila. Sirve como referencia de consistencia; sus tamaños concretos no son una obligación para IntVal. [Carbon: tabla de datos](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/specifications).

### 3.9 Resolver el móvil según la tarea

NN/g recomienda conservar encabezados, mantener identificadores a la vista y señalar el desplazamiento horizontal cuando es necesario. También advierte que listas y pestañas reducen la facilidad de comparar opciones simultáneamente. [NN/g: tablas móviles](https://www.nngroup.com/articles/mobile-tables/).

**Aplicación propuesta:** contrastar una tabla compacta con columnas prioritarias frente a tarjetas. Las tarjetas pueden favorecer la exploración individual; para comparar dos empresas puede convenir mantener valores próximos y alineados. «Cabe en 320 px» y «permite comparar» son verificaciones distintas. No se debe reducir la tipografía hasta volverla incómoda para evitar todo desplazamiento.

### 3.10 Elegir gráficas por la pregunta

El tipo de gráfica depende de lo que se intenta mostrar: evolución, magnitud, composición u otra relación. Una representación conocida puede comunicar mejor que una forma novedosa. [Datawrapper: elección de gráficas](https://www.datawrapper.de/blog/chart-types-guide).

**Aplicación propuesta:** barras o puntos alineados para precio y valores estimados; líneas para series temporales; gráficos separados cuando las escalas oculten las series pequeñas. Las leyendas y unidades deben ser legibles, y el dato preciso debe estar disponible sin depender exclusivamente del hover. No se inventan observaciones donde faltan datos.

La posible confusión de los gráficos con dos ejes justifica evaluarlos con cuidado antes de usarlos para ingresos y márgenes. [Datawrapper: gráficos con doble eje](https://www.datawrapper.de/blog/dual-axis-charts-guide).

### 3.11 Expresar correctamente los datos financieros

**Requisito del dominio y del contrato de IntVal:** distinguir precio observado, estimación del modelo y objetivo de analistas; identificar moneda y fecha; conservar los ausentes como ausentes. Un porcentaje entre estimación y precio debe explicarse como esa diferencia. Presentarlo como rentabilidad esperada cambiaría su significado.

La cantidad de modelos disponibles y las razones de exclusión pertenecen al resultado. La precisión de dos decimales en una moneda es un formato de presentación, no una acreditación de precisión predictiva. Este documento no modifica nombres ni fórmulas de la metodología.

### 3.12 Conservar contexto al abrir el detalle

**Aplicación propuesta:** un panel lateral puede funcionar en escritorio si la comparación sigue siendo utilizable y el gráfico tiene espacio. En móvil puede ser mejor una vista completa con regreso que conserve selección, filtros y posición. El formato debe comprobarse con la cantidad real de información. Una ventana lateral no es automáticamente la mejor solución por ser un patrón conocido.

La recomendación de facilitar el paso entre información principal y secundaria se encuentra en la guía de aplicaciones complejas citada en 3.1. La elección concreta de panel o página sigue siendo una decisión del producto.

## 4. Prácticas de UI: cómo conseguir un acabado visual sólido

### 4.1 Jerarquía antes que decoración

El tamaño, el contraste y la agrupación guían el orden de lectura. Dar el mismo peso a cada título, tarjeta, icono y botón dificulta distinguir lo importante. [NN/g: jerarquía visual](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/).

**Propuesta para IntVal:** en la herramienta, la atención se dirige a la empresa y sus cifras; después a la acción disponible; por último a navegación y metadatos. En la landing, al beneficio, la muestra del producto y la entrada al análisis. Un gran título no debe relegar la operación principal fuera de la vista.

### 4.2 Tipografía pensada para leer y comparar

Datawrapper recomienda fuentes legibles, números de ancho tabular cuando corresponde, uso selectivo de negrita y mayúsculas, y contraste suficiente. [Datawrapper: fuentes para gráficas y tablas](https://www.datawrapper.de/blog/fonts-for-data-visualization).

**Propuesta:** cuerpo de referencia de 16 px y datos tabulares alrededor de 14–16 px como punto de partida de este diseño; encabezados y cifras destacadas con una escala limitada y coherente. Es una propuesta que debe probarse con contenido real, no una exigencia normativa. Reservar etiquetas menores para metadatos secundarios y comprobarlas en móvil. Usar `font-variant-numeric: tabular-nums` donde ayude a alinear importes, y evitar convertir toda la interfaz en una terminal monoespaciada.

Geist documenta estilos que combinan tamaño, altura de línea, espaciado y peso. Esa idea de estilos completos es útil aunque se elija otra familia. La identidad no depende de instalar una fuente concreta. [Vercel: tipografía de Geist](https://vercel.com/geist/typography).

### 4.3 Espaciado, alineación y densidad consistentes

**Propuesta:** una escala de espaciado reducida —por ejemplo, basada en pasos de 4 y 8 px— y reglas claras para encabezados, formularios, datos y grupos. La relación entre controles se debe reconocer por su proximidad y alineación. La escala es una decisión del sistema de IntVal, no una ley de usabilidad.

La densidad debe responder al uso: una tabla de trabajo puede ser compacta y seguir siendo legible; una landing puede respirar más. Los datos no necesitan una tarjeta elevada para cada atributo. Carbon muestra diferentes densidades de tabla y Linear explica cómo suavizar separadores e iconos para dar prioridad al contenido. [Linear: actualización visual de 2026](https://linear.app/now/behind-the-latest-design-refresh).

### 4.4 Color con funciones definidas

**Propuesta:** superficies neutras, un acento de marca y colores semánticos que mantengan el mismo significado. Una diferencia positiva entre modelo y precio debe acompañarse de una explicación textual; su color no tiene que comunicar una instrucción de compra. Una leyenda de gráfica debe conservar el color de cada serie entre vistas.

Stripe describe un sistema de color construido con contraste y modelos perceptuales, probado sobre componentes reales. Su aportación útil es trabajar con escalas y relaciones verificables en todo el sistema. La aplicación de un gradiente aislado no reproduce ese trabajo. [Stripe: sistemas de color](https://stripe.com/blog/accessible-color-systems).

### 4.5 Legibilidad y controles utilizables como base

WCAG 2.2 establece, con sus excepciones, contraste mínimo de 4.5:1 para texto normal y 3:1 para texto grande. Para objetivos de puntero, el criterio AA 2.5.8 establece 24 × 24 píxeles CSS o las alternativas y excepciones que detalla. No exige convertir todos los controles en bloques de 44 px. [W3C: contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C: tamaño mínimo de objetivo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**Propuesta:** texto que siga siendo legible al ampliarlo, foco visible, formularios con etiquetas, botones cómodos para la tarea y estados que también se expresen con texto. Esto forma parte del diseño corriente; no añade una función de voz al producto ni una configuración adicional para el usuario.

### 4.6 Movimiento breve que explique el cambio

**Propuesta:** transiciones para reconocer selección, apertura del detalle y llegada de resultados. La respuesta a la acción debe ser inmediata; la persona no espera a que termine una animación decorativa para trabajar. Una gráfica no debe volver a animarse entera cada vez que llega una actualización menor.

Motion recomienda priorizar propiedades como `transform` y `opacity` para animaciones fluidas, y su guía permite respetar la preferencia de movimiento reducido. No toda propiedad tiene el mismo coste ni todo efecto requiere una biblioteca. [Motion: rendimiento](https://motion.dev/docs/performance), [Motion: movimiento reducido](https://motion.dev/docs/react-accessibility).

### 4.7 Un diseño atractivo también importa

La estética afecta la percepción del producto y puede aumentar la tolerancia a problemas menores. La misma investigación advierte que un aspecto agradable puede ocultar dificultades en las valoraciones de un test. [NN/g: efecto estético y usabilidad](https://www.nngroup.com/articles/aesthetic-usability-effect/).

**Aplicación:** evaluar tanto la calidad visual como la posibilidad de completar el análisis. La evaluación debe distinguir «me gusta» de «logré hacerlo y entendí el resultado». La familiaridad de un componente es útil, pero IntVal necesita una composición e identidad propias para evitar el aspecto de una plantilla sin adaptar.

## 5. Referencias actuales y qué tomar de cada una

Estas referencias se estudiaron a través de documentación y casos publicados por sus equipos. No se simula una evaluación de uso de sus productos con una cuenta real.

| Referencia                                                                                                                          | Qué documenta                                                                          | Qué aprovechar para IntVal                                                 | Qué exige adaptación                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Linear, rediseño de 2026](https://linear.app/now/behind-the-latest-design-refresh)                                                 | Acciones predecibles, menor protagonismo de navegación, menos ruido de bordes e iconos | Una superficie de trabajo cohesionada con jerarquía y densidad controladas | Su estructura responde a gestión de trabajo; no resuelve por sí misma análisis financiero |
| [Stripe, sistema de color](https://stripe.com/blog/accessible-color-systems)                                                        | Paletas consistentes, contraste y comprobación sobre componentes                       | Acento reconocible y colores que funcionen en varios estados               | El caso no acredita que copiar sus gradientes mejore una tabla de valoración              |
| [Geist, tipografía](https://vercel.com/geist/typography)                                                                            | Estilos tipográficos completos y consistentes                                          | Ritmo, alineación y diferenciación entre títulos, texto y datos            | No obliga a una interfaz negra ni a una copia de la identidad de Vercel                   |
| [Koyfin, screener](https://www.koyfin.com/help/my-screens/)                                                                         | Filtros, columnas, ordenación, acciones por lote y exportación                         | Relación entre consulta, tabla y análisis posterior                        | Sus miles de filtros y proceso de configuración exceden la necesidad actual de IntVal     |
| [TradingView, recorrido del screener](https://www.tradingview.com/support/solutions/43000718885-tradingview-screeners-walkthrough/) | Vistas guardadas, filtros, tablas, columnas y acceso a otras herramientas              | Consistencia de controles y acceso al detalle sin rehacer la consulta      | Sus funciones de trading y su densidad completa no forman parte del encargo               |

En productos financieros, los patrones repetidos son búsqueda o selección, filtros con estado reconocible, tabla configurable, detalle y exportación. Mi recomendación es adaptar esa continuidad a las funciones que IntVal ya tiene. Los casos anteriores no justifican añadir watchlists persistentes, cuentas ni módulos de trading.

## 6. Qué se puede afirmar sobre popularidad y satisfacción

### 6.1 Señales cuantitativas consultadas

| Fuente                                                                                                               | Dato publicado                                                                                                                                      | Lectura útil                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [State of CSS 2026, herramientas](https://2026.stateofcss.com/en-US/other-tools/)                                    | En una pregunta con 3,697 respuestas y selección múltiple: Tailwind 1,854; Bootstrap 982; shadcn/ui 802; Material UI 692; ninguna herramienta 1,042 | Tailwind lidera las opciones mostradas; CSS sin framework también tiene presencia importante              |
| [State of React 2025, bibliotecas](https://2025.stateofreact.com/en-US/libraries/)                                   | Uso declarado de MUI 57.2%, shadcn/ui 56.1% y TanStack Query 68.1% entre quienes respondieron sus respectivos ítems                                 | Hay ecosistemas amplios; sus denominadores no son idénticos y no se deben sumar                           |
| [State of React 2025, bibliotecas UI](https://2025.stateofreact.com/en-US/libraries/component-libraries/)            | MUI mantiene el primer puesto en uso y shadcn/ui se aproxima; el catálogo de opciones también incluye Radix, React Aria y Mantine                   | shadcn/ui es una opción con adopción fuerte, no la única opción madura                                    |
| [State of JavaScript 2025, meta-frameworks](https://2025.stateofjs.com/en-US/libraries/meta-frameworks/)             | Astro encabeza satisfacción; Next.js domina el uso de su categoría                                                                                  | Mayor uso y mayor satisfacción son indicadores diferentes                                                 |
| [State of JavaScript 2025, bibliotecas](https://2025.stateofjs.com/en-US/libraries/)                                 | Vite destaca en valoración positiva y uso; Vitest y Playwright crecieron en uso declarado                                                           | El tooling que ya rodea al proyecto tiene respaldo de adopción                                            |
| [State of JavaScript 2025, frameworks de frontend](https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/) | Solid lleva cinco años con la mayor satisfacción, aunque lo usa alrededor del 10% de quienes respondieron                                           | Una alternativa menos usada puede estar mejor valorada; popularidad y satisfacción no son intercambiables |

State of React identifica a TanStack Query como la biblioteca con más opiniones positivas en su comparación general y señala el crecimiento de shadcn/ui del 20% al 56% en dos años. Esto respalda considerar ambas herramientas. Los datos corresponden a encuestas de desarrolladores, no a preferencias de inversores ni a cuota global de todos los sitios web.

### 6.2 Qué significa «lo más gustado» en diseño visual

No se encontró en estas fuentes una encuesta comparable que ordene universalmente estilos como bento, glassmorphism, interfaces oscuras o diseño editorial para usuarios de herramientas de valoración. Se pueden identificar patrones y ejemplos; la preferencia concreta debe contrastarse con la propuesta y su público.

| Dirección visual                                            | Utilidad posible                                            | Decisión propuesta para IntVal                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Tipografía protagonista y muestra clara del producto        | Comunicar personalidad y utilidad en la landing             | Dirección recomendable para explorar, conservando una entrada evidente al análisis         |
| Superficies sobrias, buena alineación y densidad controlada | Lectura y operación sostenida en la app                     | Base recomendable para el comparador                                                       |
| Retículas bento                                             | Agrupar capacidades distintas con una composición expresiva | Uso puntual en presentación; la comparación mantiene una estructura común                  |
| Microinteracciones                                          | Confirmar acciones y hacer comprensibles transiciones       | Uso selectivo y breve                                                                      |
| Transparencias y glassmorphism                              | Expresar capas y profundidad                                | Detalle opcional; las cifras necesitan fondo y contraste previsibles                       |
| Fondos animados, partículas y 3D                            | Identidad o demostración visual en contextos concretos      | Sólo se justificarían con un aporte claro y medición de coste; no son la base del análisis |

NN/g documenta problemas de contraste y lectura de las transparencias, y recomienda un uso moderado con fondos controlados. [NN/g: glassmorphism](https://www.nngroup.com/articles/glassmorphism/).

Los catálogos [Magic UI](https://magicui.design/), [Aceternity UI](https://ui.aceternity.com/) y [React Bits](https://reactbits.dev/) ofrecen piezas contemporáneas de presentación y movimiento. Son recursos útiles para estudiar o incorporar componentes seleccionados. Sus galerías y testimonios no constituyen una comparación independiente de usabilidad para IntVal.

## 7. Tecnologías para aplicar estas prácticas

### 7.1 Decisión principal

**Conservar la arquitectura de IntVal y resolver el sistema visual y la interacción.** En el repositorio ya existen Astro, React, TypeScript, Tailwind, TanStack Query, TanStack Table y Recharts. Su presencia no demuestra que el diseño esté resuelto, pero evita atribuir el problema a la ausencia de otro framework.

| Necesidad                                      | Tecnología                                         | Recomendación concreta                                                                                   | Fuente                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Landing y contenido públicos rápidos           | Astro                                              | HTML estático; hidratar sólo elementos que necesitan interacción                                         | [Islas de Astro](https://docs.astro.build/en/concepts/islands/)                                                       |
| Estado e interacción del analizador            | React + TypeScript existentes                      | Mantener la integración actual y el contrato tipado con la API                                           | Inspección de `frontend/package.json` y tipos del proyecto                                                            |
| Estilos coherentes y adaptables                | CSS + Tailwind                                     | Definir colores, tipografía, espaciado, radios y estados propios                                         | [Variables de tema](https://tailwindcss.com/docs/theme)                                                               |
| Controles reutilizables                        | shadcn/ui con una base elegida conscientemente     | Adoptar componentes necesarios y adaptar su código y apariencia a IntVal                                 | [Introducción](https://ui.shadcn.com/docs)                                                                            |
| Base de comportamiento para componentes nuevos | Base UI o Radix según integración                  | Base UI es la opción por defecto actual de shadcn; conservar Radix si una integración existente funciona | [Cambio oficial de julio de 2026](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)                       |
| Solicitudes, caché y sincronización            | TanStack Query existente                           | Usarlo para estado del servidor; conservar la lógica de trabajos y recuperación                          | [Overview de Query](https://tanstack.com/query/latest/docs/framework/react/overview)                                  |
| Filtrado, selección, ordenación y paginación   | TanStack Table existente                           | Activar las funciones necesarias y diseñar la presentación                                               | [Funciones de Table v9](https://tanstack.com/table/latest/docs/guide/features)                                        |
| Gráficas de las cuatro vistas                  | Recharts existente                                 | Personalizar composición, unidades, leyendas y estados; cargar lo necesario cuando se consulta           | [Recharts](https://recharts.github.io/en-US/)                                                                         |
| Mayor volumen o visualizaciones especializadas | Apache ECharts                                     | Alternativa condicionada a una necesidad comprobada, no una sustitución inicial                          | [Elección entre Canvas y SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)                   |
| Transiciones del producto                      | CSS primero; Motion si aporta control útil         | Elegir una solución por efecto y cargar sólo lo usado                                                    | [Guía de rendimiento de Motion](https://motion.dev/docs/performance)                                                  |
| Iconografía consistente                        | Lucide                                             | Importaciones explícitas; texto visible para acciones que lo necesiten                                   | [Lucide para React](https://lucide.dev/guide/react)                                                                   |
| Composición de componentes en anchos distintos | Grid, Flexbox y consultas de contenedor por tamaño | Adaptar el detalle al espacio que ocupa, además de adaptar la página al viewport                         | [Consultas de contenedor, MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries) |

### 7.2 Lo que aporta cada elección

**Astro.** Su arquitectura entrega HTML y reserva JavaScript para componentes interactivos. Encaja con una landing estática y un analizador React. El analizador puede requerir hidratación inmediata aunque otros elementos públicos no la necesiten. Crear muchas islas que intercambian el mismo estado de análisis no es un objetivo del rediseño.

**shadcn/ui.** Proporciona código de componentes que se puede adaptar. Hay que diseñar su uso, composición, jerarquía, densidad, textos y estados para este producto. Elegir el tema predeterminado y ensamblar tarjetas no garantiza una identidad propia.

**Base UI/Radix.** La base resuelve comportamientos de controles; el resultado completo sigue necesitando integración y comprobación. La documentación actual de shadcn recomienda Base UI para proyectos nuevos y mantiene soporte de Radix. No hay fundamento para migrar por moda una base estable. En el `package.json` inspeccionado no figura ninguna de estas dos como dependencia directa.

**TanStack Query.** Ayuda a gestionar datos asíncronos y su caché. No sustituye la cola ni el motor Python. Esas funciones permanecen bajo sus contratos actuales, y el usuario ve estado, resultados y acciones.

**TanStack Table v9.** Es un motor sin una apariencia impuesta; sus funciones optativas permiten incorporar sólo lo requerido. La tabla final, su semántica y sus estados siguen siendo responsabilidad de la aplicación. Virtualizar filas tiene sentido después de medir un problema de volumen, no por mostrar una lista de tres ejemplos.

**Recharts y ECharts.** Recharts ya está integrado y ofrece componentes React sobre SVG. ECharts permite elegir Canvas o SVG y documenta diferencias según volumen, memoria y entorno. Esa comparación no acredita que una biblioteca sea siempre más rápida. Para IntVal, primero se debe medir la configuración real de Recharts y la carga de las vistas existentes.

**Motion y CSS.** Un cambio sencillo de foco, color u opacidad puede resolverse con CSS. Motion es útil para una transición coordinada o una interacción que lo justifique. Añadirlo no es un requisito para una interfaz moderna.

**Lucide.** Sus iconos se renderizan como SVG y las importaciones explícitas permiten incluir sólo los usados. No reemplaza los rótulos de acciones ni implica llenar de iconos cada dato.

### 7.3 Alternativas populares que se consideraron

| Alternativa                        | Valor                                                                           | Decisión para este caso                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Next.js                            | Framework de amplio uso que también permite exportación estática                | Migrar desde Astro no resuelve las deficiencias de UX/UI identificadas. Se reconsideraría ante un requisito arquitectónico concreto |
| MUI                                | Amplia adopción en la encuesta de React y un sistema de componentes reconocible | Puede servir a productos de datos; aquí supondría incorporar otra base y adaptar profundamente la identidad                         |
| Bootstrap                          | Presencia alta en la encuesta CSS                                               | Adecuado para resolver interfaces con rapidez, pero no hay necesidad de añadirlo al stack existente                                 |
| CSS sin framework                  | Control directo y presencia significativa en la encuesta CSS                    | Es una opción válida para el prototipo HTML y para componentes específicos                                                          |
| Solid u otro framework de frontend | Solid destaca en satisfacción en la encuesta consultada                         | Su buena valoración merece consideración en proyectos nuevos; sustituir aquí React añadiría trabajo sin acreditar una mejora de UX  |
| Catálogos de efectos               | Recursos de presentación y movimiento                                           | Seleccionar piezas puntuales después de definir la composición y el presupuesto de rendimiento                                      |

La alternativa Next.js se comprobó en su documentación: admite exportación de HTML/CSS/JS, sin exigir un servidor Node para servir ese resultado estático. La razón para conservar Astro es el encaje y el coste de cambiar lo que ya existe. [Next.js: exportación estática](https://nextjs.org/docs/app/guides/static-exports).

### 7.4 Cómo encaja un HTML sin instalaciones

Para explorar y validar esta dirección puede mantenerse un **HTML con CSS y JavaScript**, usando datos de ejemplo claramente identificados y los mismos recorridos previstos en la app. La selección de librerías depende de lo que ese prototipo necesite demostrar. Sus datos sintéticos no deben presentarse como consulta de mercado.

Un CDN evita instalar localmente un recurso, pero el navegador todavía debe solicitarlo, descargarlo y ejecutarlo. Para una prueba visual puede ser conveniente; en producción conviene un build reproducible y carga selectiva. Tailwind señala expresamente que Play CDN está destinado al desarrollo. [Tailwind: Play CDN](https://tailwindcss.com/docs/installation/play-cdn).

El HTML no necesita montar simultáneamente React, otra biblioteca de estado, varios kits visuales y varios motores de animación para demostrar unos pocos recorridos. La exportación real y las gráficas deben utilizar librerías sólo donde aporten el comportamiento necesario.

## 8. Rendimiento como parte del diseño

### 8.1 Métricas y su alcance

| Métrica | Qué refleja                          | Umbral de referencia publicado |
| ------- | ------------------------------------ | ------------------------------ |
| LCP     | Aparición del contenido principal    | Hasta 2.5 s                    |
| INP     | Respuesta visual a las interacciones | Hasta 200 ms                   |
| CLS     | Estabilidad de la composición        | Hasta 0.1                      |

Estos umbrales se evalúan al percentil 75 y por segmentos de móvil y escritorio. Un ensayo local no sustituye datos de uso real. [web.dev: Core Web Vitals](https://web.dev/articles/vitals).

**Distinción importante:** recibir datos de Yahoo o ejecutar un lote puede tardar más que una interacción de navegador. La interfaz debe responder al inicio, conservar su capacidad de uso y mostrar avance. No se promete un lote completo en 200 ms.

### 8.2 Decisiones prácticas

1. Entregar la landing principalmente como HTML y CSS.
2. Cargar el JavaScript de la app donde hace falta y separar recursos costosos del primer render cuando sea viable.
3. Dar respuesta inmediata a selección, búsqueda y envío; evitar bloquear la interacción con procesamiento o animaciones innecesarias.
4. Reservar dimensiones para gráficas y medios, reduciendo movimientos del contenido al cargar.
5. Cargar fuentes y variantes que se utilizan, con una estrategia de `font-display` y fallback adecuada. [web.dev: carga de fuentes](https://web.dev/articles/optimize-webfont-loading).
6. Importar iconos, funciones de tabla y visualizaciones utilizadas, en lugar de catálogos completos.
7. Medir filtros, ordenación y gráficas con el volumen real que puede recibir la aplicación.
8. Evitar animaciones decorativas continuas que consuman recursos durante el análisis.
9. Comprobar respuesta bajo conexión lenta o un proveedor que tarda, además de comprobar un ejemplo local rápido.
10. Mantener los presupuestos y pruebas de rendimiento que ya tiene el repositorio; revisar su correspondencia con la nueva composición.

Estas son recomendaciones para una siguiente implementación. Esta investigación no ejecutó un nuevo benchmark ni acredita valores de LCP, INP o CLS para un rediseño aún no implementado.

## 9. Contraste con el código actual de IntVal

| Observación comprobada                                                               | Dificultad o riesgo a evaluar                                                                                | Cambio de diseño o trabajo que se justifica estudiar                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `AnalysisForm.tsx` filtra el catálogo por `ticker`                                   | Quien desconoce el símbolo no puede buscar por nombre en ese control                                         | Verificar disponibilidad de nombres en el catálogo y diseñar la búsqueda con datos que realmente existen |
| El formulario presenta fuente, mercado, catálogo, extras y supuestos antes del envío | El recorrido puede parecer una configuración extensa para iniciar una operación sencilla                     | Reordenar por frecuencia y tarea; aprovechar valores iniciales y acceso claro a ajustes                  |
| Hay tasas visibles y más supuestos en un bloque desplegable                          | Existe ya cierta presentación progresiva, pero no demuestra que la división sea adecuada                     | Evaluar qué se necesita ver para iniciar y qué se consulta al interpretar el resultado                   |
| La tabla utiliza «Mediana de proxies», «Upside mediana» y «Proxies incluidos»        | El lenguaje exige conocimiento previo de la implementación y de términos financieros concretos               | Diseñar rótulos de producto comprensibles manteniendo la definición exacta de la metodología             |
| El ticker es el botón de acceso al detalle                                           | La acción puede pasar desapercibida para quien interpreta el símbolo como dato                               | Hacer reconocible el acceso al análisis y conservar el contexto al volver                                |
| Los tokens existentes ya incluyen colores, tipografías y duración                    | La app tiene una base visual; su existencia no prueba que la composición sea adecuada                        | Ajustar reglas y componentes de forma coherente y revisar pantallas completas                            |
| El prototipo cambió la tabla por tarjetas en móvil                                   | Facilita leer cada empresa, pero puede dificultar comparaciones simultáneas                                  | Contrastar el resultado con tabla compacta y con comparación de pocas empresas                           |
| El prototipo añade un ejemplo calculado automáticamente al inicio                    | Puede mostrar utilidad inmediata, pero también confundir el origen del resultado o el estado de la selección | Identificación inequívoca del ejemplo y separación entre probar y solicitar datos de mercado             |
| El prototipo tiene filtros cerrados con conteo de condiciones                        | Un número de filtros no explica qué criterio está activo                                                     | Mostrar el criterio relevante cerca de los resultados y facilitar retirarlo                              |
| Enter en la búsqueda del prototipo puede sustituir la selección y analizar           | La operación puede sorprender si la persona esperaba seleccionar una sugerencia                              | Alinear búsqueda, selección y envío con un comportamiento visible y predecible                           |
| El prototipo usa varias capas de reglas CSS de iteraciones previas                   | Hace más difícil mantener una jerarquía y una respuesta consistente entre pantallas                          | Consolidar el sistema de estilos al implementar una dirección, conservando pruebas útiles                |
| Las pruebas automáticas verifican recorridos y datos                                 | No verifican por sí solas comprensión, agrado visual o facilidad de uso                                      | Complementar con revisión visual y observación de tareas, sin declarar UX validada por cobertura         |

Las hipótesis de esta tabla no son hallazgos de una sesión con participantes. Se apoyan en el código inspeccionado, en el encargo y en su contraste con las fuentes. Tampoco autorizan cambiar el motor financiero ni retirar funcionalidades automáticas.

## 10. Cómo comprobar que la siguiente propuesta mejora el producto

La revisión no debe limitarse a contar clics o pedir si la pantalla gusta. El marco HEART propone relacionar objetivos del producto con señales y métricas centradas en las personas. Aquí interesa especialmente completar la tarea, entender el resultado y valorar la experiencia. [Rodden, Hutchinson y Fu: métricas de experiencia de usuario](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/).

La investigación académica sobre patrones de dashboard también contempla decisiones y compromisos entre espacio, interacción e información: su estudio revisó 144 dashboards y realizó un taller con 23 participantes. Su taxonomía ayuda a explorar composiciones; no prueba que una de ellas sea la mejor para todos los públicos. Se consultó el resumen publicado del trabajo. [Bach y colaboradores: Dashboard Design Patterns](https://arxiv.org/abs/2205.00757).

### 10.1 Tareas que representan el encargo

| Tarea                                            | Qué comprobar                                                                            | Evidencia que se debe obtener                                          |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Encontrar una empresa y analizarla               | Se identifica por dónde empezar y cómo enviar sin abrir ajustes opcionales               | Recorrido, dudas, errores, ayuda solicitada y tiempo de tarea          |
| Comparar una empresa de USA con una de México    | Se entienden valores por acción y monedas, sin inferir una suma o conversión inexistente | Interpretación expresada por la persona y acciones realizadas          |
| Entender la diferencia entre precio y estimación | El porcentaje no se interpreta como rentabilidad garantizada                             | Explicación del resultado sin acudir a un tutorial general             |
| Abrir modelos y datos de una empresa             | El detalle se descubre y se conserva el contexto al volver                               | Acciones, pérdida de selección o posición y necesidad de rehacer pasos |
| Cambiar supuestos y volver a analizar            | Se distingue el borrador del análisis que ya produjo los resultados                      | Correspondencia entre configuración, resultado y Excel                 |
| Obtener un lote parcialmente fallido             | Se reconoce qué empresas tienen datos y cómo seguir                                      | Continuidad de la tarea y claridad del diagnóstico                     |
| Recargar o perder momentáneamente la conexión    | Se conserva o recupera el trabajo según el contrato actual                               | Estado visible, consistencia y ausencia de acciones duplicadas         |
| Filtrar y exportar                               | Se entiende qué se está mostrando y qué contiene la descarga                             | Correspondencia de alcance entre rótulo, archivo y expectativas        |
| Comparar desde un móvil                          | Se leen y relacionan cifras sin depender de memorizar pantallas completas                | Comparación de composiciones con contenido equivalente                 |

Estas tareas son criterios de evaluación para una futura propuesta; no se afirma que se hayan ejecutado con participantes durante esta investigación. No se establece una cantidad arbitraria de usuarios como garantía de validación universal.

### 10.2 Qué aporta TDD y qué requiere otra evidencia

TDD se mantiene para cualquier implementación: selección y búsqueda, contratos, cálculos preservados, errores, recuperación, filtros y exportación. Cada incremento de comportamiento parte de una prueba que falla por la razón esperada y termina conservando las regresiones pertinentes.

La revisión visual comprueba composición, tipografía, estados, legibilidad y adaptación sobre pantallas reales. La observación de tareas comprueba comprensión y facilidad de uso. Los tests automáticos y una captura correcta no reemplazan esta última evidencia. Tampoco una valoración estética positiva demuestra que se completó bien el análisis.

No se requiere añadir nuevos procesos de revisión al recorrido de uso de la aplicación. Este documento no introduce herramientas, cuentas, encuestas de producto ni obligaciones de configuración para su usuario.

## 11. Dirección recomendada para una siguiente implementación

### 11.1 Landing

Una composición con identidad, una promesa concreta y una muestra del producto suficientemente grande para entender la utilidad. Tipografía expresiva en el titular, texto breve y acceso principal a analizar. El ejemplo tiene origen y fecha visibles. Las capacidades se presentan alrededor de lo que permiten hacer: comparar empresas, explorar modelos y llevarse los datos.

La personalidad visual puede ser mayor que en la herramienta, pero debe pertenecer al mismo sistema. La propuesta se evalúa completa: primera vista, navegación, muestra de producto, contenido secundario y adaptación móvil. Escoger naranja, verde o negro no sustituye esa composición.

### 11.2 Analizador

Una superficie de trabajo con búsqueda y selección claras; una acción principal con alcance; resultados comparables; acceso explícito al detalle y a la descarga. La información de origen y supuestos permanece asociada al resultado. Los ajustes especializados tienen un acceso reconocible y los filtros frecuentes permanecen disponibles.

Se mantiene la maquinaria ya autorizada: trabajos, cola, resultados parciales, recuperación, caché y sincronización. Sus decisiones operativas se automatizan, mientras su estado útil se comunica en lenguaje de la tarea.

### 11.3 Sistema visual

Definir antes de extender pantallas: tipografía, escala, espaciado, superficies, color de marca, estados, iconos, densidad, controles y movimiento. Personalizar sólo los componentes que se usan. Comprobar cómo conviven en una pantalla real de datos antes de propagar variaciones al resto de la aplicación.

La selección exacta de paleta, fuente y composición queda como trabajo de diseño posterior a esta investigación. Este documento aporta criterios y referencias para hacerlo, y no presenta una nueva estética como aprobada por el usuario.

### 11.4 Orden de trabajo razonable

1. Consolidar el recorrido y las etiquetas a partir del comportamiento real del producto.
2. Crear una dirección visual coherente aplicada a la landing, el comparador y un detalle completo.
3. Revisar esa propuesta con contenido realista, estados y tareas, incluyendo móvil.
4. Implementar los cambios elegidos en el stack existente con TDD y mediciones pertinentes.
5. Comprobar el conjunto y documentar la evidencia que efectivamente se obtuvo.

El resultado de esta investigación es esta recomendación documentada. No se instalaron dependencias, no se reescribió el frontend, no se cambió el prototipo y no se ejecutó un despliegue.

## 12. Registro de fuentes

Las fuentes se consultaron en la fecha indicada al principio. Las guías fundamentales mantienen su año original; las señales de adopción identifican la edición de la encuesta. Las recomendaciones del documento son una síntesis aplicada a IntVal y están diferenciadas de las afirmaciones de sus autores.

| Fuente original                                                                                                                                                    | Papel en la investigación                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [NN/g — 8 Design Guidelines for Complex Applications](https://www.nngroup.com/articles/complex-application-design/)                                                | Capacidad, continuidad y prioridades en herramientas con muchas funciones |
| [NN/g — Recognition and Recall](https://www.nngroup.com/articles/recognition-and-recall/)                                                                          | Acciones visibles, contexto e historial                                   |
| [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)                                                                          | Separación de funciones frecuentes y especializadas                       |
| [NN/g — Visual Hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)                                                                        | Escala, contraste y agrupación                                            |
| [NN/g — Aesthetic-Usability Effect](https://www.nngroup.com/articles/aesthetic-usability-effect/)                                                                  | Papel de la estética y límites de su evaluación                           |
| [NN/g — Mobile Tables](https://www.nngroup.com/articles/mobile-tables/)                                                                                            | Legibilidad y comparaciones en móvil                                      |
| [NN/g — Comparison Tables](https://www.nngroup.com/articles/comparison-tables/)                                                                                    | Consistencia y escaneo de atributos                                       |
| [NN/g — Glassmorphism](https://www.nngroup.com/articles/glassmorphism/)                                                                                            | Transparencias y condiciones de legibilidad                               |
| [GOV.UK — Button](https://design-system.service.gov.uk/components/button/)                                                                                         | Acción principal y rótulos de botones                                     |
| [GOV.UK — Error message](https://design-system.service.gov.uk/components/error-message/)                                                                           | Validación, conservación de datos y errores del servicio                  |
| [Carbon — Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/specifications)                                                | Estructura, densidad y consistencia de tablas                             |
| [Datawrapper — Choosing a chart type](https://www.datawrapper.de/blog/chart-types-guide)                                                                           | Relación entre pregunta y representación                                  |
| [Datawrapper — Fonts for data visualization](https://www.datawrapper.de/blog/fonts-for-data-visualization)                                                         | Tipografía de cifras y leyendas                                           |
| [Datawrapper — Dual-axis charts](https://www.datawrapper.de/blog/dual-axis-charts-guide)                                                                           | Riesgos de lectura al mezclar escalas                                     |
| [W3C — Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)                                                                        | Referencia normativa de contraste                                         |
| [W3C — Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)                                                                  | Referencia normativa de objetivos de puntero                              |
| [web.dev — Web Vitals](https://web.dev/articles/vitals)                                                                                                            | Umbrales y medición de rendimiento                                        |
| [web.dev — INP](https://web.dev/articles/inp)                                                                                                                      | Respuesta visual a interacciones                                          |
| [web.dev — Optimize WebFont loading](https://web.dev/articles/optimize-webfont-loading)                                                                            | Fuentes y ruta de renderizado                                             |
| [State of CSS 2026 — Other Tools](https://2026.stateofcss.com/en-US/other-tools/)                                                                                  | Adopción declarada de herramientas CSS                                    |
| [State of React 2025 — Libraries](https://2025.stateofreact.com/en-US/libraries/)                                                                                  | Uso y opiniones sobre bibliotecas                                         |
| [State of React 2025 — UI Libraries](https://2025.stateofreact.com/en-US/libraries/component-libraries/)                                                           | Adopción de componentes UI                                                |
| [State of JavaScript 2025 — Libraries](https://2025.stateofjs.com/en-US/libraries/)                                                                                | Uso y valoración del tooling                                              |
| [State of JavaScript 2025 — Meta-Frameworks](https://2025.stateofjs.com/en-US/libraries/meta-frameworks/)                                                          | Uso y satisfacción con frameworks                                         |
| [State of JavaScript 2025 — Front-end Frameworks](https://2025.stateofjs.com/en-US/libraries/front-end-frameworks/)                                                | Contraste entre satisfacción y adopción de frontend                       |
| [Linear — A calmer interface](https://linear.app/now/behind-the-latest-design-refresh)                                                                             | Caso de jerarquía y reducción de ruido                                    |
| [Stripe — Accessible color systems](https://stripe.com/blog/accessible-color-systems)                                                                              | Caso de construcción y prueba de paletas                                  |
| [Vercel — Geist Typography](https://vercel.com/geist/typography)                                                                                                   | Estilos tipográficos coherentes                                           |
| [Koyfin — My Screens](https://www.koyfin.com/help/my-screens/)                                                                                                     | Referencia de flujo financiero                                            |
| [TradingView — Screeners walkthrough](https://www.tradingview.com/support/solutions/43000718885-tradingview-screeners-walkthrough/)                                | Referencia de tablas, filtros y detalle                                   |
| [Astro — Islands architecture](https://docs.astro.build/en/concepts/islands/)                                                                                      | HTML estático e hidratación selectiva                                     |
| [Tailwind — Theme variables](https://tailwindcss.com/docs/theme)                                                                                                   | Implementación de tokens visuales                                         |
| [Tailwind — Play CDN](https://tailwindcss.com/docs/installation/play-cdn)                                                                                          | Alcance del CDN para prototipos                                           |
| [shadcn/ui — Introduction](https://ui.shadcn.com/docs)                                                                                                             | Código de componentes personalizable                                      |
| [shadcn/ui — Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)                                                                 | Estado actual de Base UI y Radix                                          |
| [TanStack Query — Overview](https://tanstack.com/query/latest/docs/framework/react/overview)                                                                       | Gestión de datos asíncronos                                               |
| [TanStack Table — Features](https://tanstack.com/table/latest/docs/guide/features)                                                                                 | Funciones optativas y tabla sin estilo impuesto                           |
| [Recharts](https://recharts.github.io/en-US/)                                                                                                                      | Integración de gráficas React/SVG                                         |
| [Apache ECharts — Canvas vs SVG](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)                                                             | Alternativa y criterios de renderizado                                    |
| [Motion — Performance](https://motion.dev/docs/performance)                                                                                                        | Coste y elección de animaciones                                           |
| [Motion — Accessibility](https://motion.dev/docs/react-accessibility)                                                                                              | Preferencia de movimiento reducido                                        |
| [Lucide — React](https://lucide.dev/guide/react)                                                                                                                   | SVG e importaciones de iconos                                             |
| [MDN — CSS container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries)                                               | Adaptación por tamaño de contenedor                                       |
| [Magic UI](https://magicui.design/)                                                                                                                                | Catálogo de componentes de presentación                                   |
| [Aceternity UI](https://ui.aceternity.com/)                                                                                                                        | Catálogo de bloques y microinteracciones                                  |
| [React Bits](https://reactbits.dev/)                                                                                                                               | Catálogo de componentes animados                                          |
| [Next.js — Static exports](https://nextjs.org/docs/app/guides/static-exports)                                                                                      | Contraste de alternativa arquitectónica                                   |
| [Google Research — User-Centered Metrics](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/) | Resumen del marco de métricas centradas en usuarios                       |
| [Dashboard Design Patterns](https://arxiv.org/abs/2205.00757)                                                                                                      | Resumen de investigación sobre patrones y compromisos de dashboards       |
