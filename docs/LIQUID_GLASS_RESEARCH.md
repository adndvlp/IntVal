# Variante Liquid Glass de IntVal

Revisión: 14 de noviembre de 2026. Archivo: [prototipo-intval-liquid-glass.html](../prototipo-intval-liquid-glass.html).

## Opciones revisadas

| Opción                                                                    | Qué aporta                                                                                                                      | Decisión para este prototipo                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| CSS `backdrop-filter`                                                     | Desenfoque y saturación del fondo sin rasterizar la aplicación desde JavaScript.                                                | Base del material, con una superficie opaca cuando no está disponible.                                                                        |
| [Liquid Glass React](https://github.com/rdev/liquid-glass-react)          | Refracción, brillo y elasticidad mediante un componente React. Su documentación limita el desplazamiento en Safari y Firefox.   | No añadir React a un HTML que ya funciona sin framework.                                                                                      |
| [liquidGL](https://github.com/naughtyduk/liquidGL)                        | Renderizador WebGPU/WebGL, rasterización del fondo y efectos ópticos más completos.                                             | Sería útil para una escena que necesitara vídeo y efectos continuos; aquí no se añade ese renderizador.                                       |
| [Nordify CSS Liquid Glass](https://github.com/nordify/css-liquid-glass)   | Refracción de la página mediante SVG y mapas de desplazamiento, con un diseño de nueve segmentos para redimensionar sus lentes. | Referencia técnica de compatibilidad y bordes. Esta implementación usa un mapa propio y más sencillo, sin copiar ni incorporar la biblioteca. |
| [dpawlikowski/liquid-glass](https://github.com/dpawlikowski/liquid-glass) | CSS/SVG, turbulencia y una copia decorativa del fondo.                                                                          | Se evita animar ruido o duplicar la escena continuamente.                                                                                     |

## Material y ejecución elegidos

Se sigue la separación de [Apple HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials): el vidrio destaca navegación y controles; las cifras, tablas y párrafos conservan superficies claras y estables. Los reflejos, biseles, sombras, fondo de ondas y controles redondeados forman un sistema visual propio.

El sidebar tiene un mapa de desplazamiento geométrico en sus bordes y un centro neutro. Se genera una vez y al cambiar sus dimensiones, con el lado mayor limitado a 320 píxeles. Se programa fuera de la interacción inicial y no existe un bucle permanente de renderizado. Es una aproximación al bisel óptico, no una simulación física completa de Liquid Glass.

La mejora de refracción se limita a Chromium: las bibliotecas revisadas documentan la limitación de filtros SVG dentro de `backdrop-filter` en otros motores. Safari y Firefox conservan el vidrio esmerilado, los reflejos y todos los controles. Si Canvas falla, se conserva el material CSS. Las preferencias de transparencia reducida, contraste alto y movimiento reducido se atienden automáticamente.

La composición evita filtros anidados en navegación, porque un elemento con `backdrop-filter` crea un límite para el fondo que pueden muestrear sus descendientes. Referencia: [MDN — Backdrop root](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter#backdrop_root).

## Alcance y comprobaciones

### Catálogos y resultados de más de mil empresas

La selección presenta filas completas con checkbox nativo y búsqueda por nombre o símbolo. Los resultados comparten cuatro encabezados: empresa, precio, valor estimado y diferencia. Cada columna permite ordenar; los encabezados y nombres se mantienen visibles durante el desplazamiento. El detalle conserva una comparación única de precio y estimado, con métodos, supuestos y gráficas disponibles sin repetir las cifras en varias tablas. No se cambia la página dedicada a explicar la metodología.

En el detalle, Métodos y Supuestos son secciones siempre visibles con encabezados propios. No tienen controles desplegables ni requieren pulsar una flecha para consultar su contenido.

Los nueve campos de Ajustes de valoración se muestran en grupos de formulario permanentes; se conservan sus límites, ayudas y validación nativa. Los cinco apartados de la página Cómo se calcula también se muestran completos, con encabezados y párrafos, sin desplegables.

Los dos modales (detalle de empresa y ajustes) permiten cerrar al pulsar fuera mediante `closedby="any"`. Los navegadores sin soporte usan un fallback común que comprueba los límites del diálogo y que el gesto empiece y termine fuera. Los clics en contenido o padding y los arrastres desde dentro no cierran. El cierre respeta `cancel`, conserva las acciones de cierre existentes y no guarda los ajustes sin pulsar Guardar. Tres pruebas escritas primero verifican ambos modales, navegación y foco del detalle, gestos interiores y cancelación del cierre.

Catálogo y Seleccionadas son dos vistas de una misma lista de hasta 25 registros por página. No hay una segunda lista de empresas ni un resumen desplegable debajo del catálogo. Cada vista conserva su búsqueda, mercado y página al alternarlas. El mercado se filtra mediante un control siempre visible, junto al buscador.

Una barra de acciones sobre la lista mantiene el conteo global, Limpiar y Analizar disponibles. El checkbox Seleccionar página actúa sobre las filas visibles y muestra un estado intermedio cuando sólo parte de la página está marcada. Cuando la página está seleccionada y existen más coincidencias, aparece una acción explícita con el total —por ejemplo, Seleccionar 1,203 empresas— para extender la selección a todas las páginas. Desmarcar la página conserva las elegidas fuera de ella. Las empresas se retiran desmarcando su propia fila, también desde la vista Seleccionadas.

La distinción entre página, selección global y conteo entre páginas se apoya en [PatternFly — Bulk selection](https://www.patternfly.org/patterns/bulk-selection/); la agrupación de búsqueda, filtros y acciones sobre los registros sigue el patrón de [Carbon — Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines). Se usan HTML, CSS y JavaScript nativos, sin instalar esas bibliotecas.

Los resultados también renderizan como máximo 25 registros. Sus búsquedas y ordenaciones se aplican al conjunto completo antes de paginar. El Excel exporta el lote completo, independientemente de la página o búsqueda visible. Abrir y cerrar el detalle conserva la página actual. Los controles de paginación se ocultan cuando no hacen falta, como sucede con las tres empresas ficticias iniciales.

Los resultados conservan el buscador y la ordenación ascendente o descendente desde los encabezados de Empresa, Precio, Valor estimado y Diferencia. A petición del usuario se retiraron los filtros numéricos, sus comparadores, botones de borrado y lógica asociada. La búsqueda y la ordenación actúan sobre el lote completo antes de paginar; las ausencias permanecen al final y no se convierten en cero. Un lote nuevo restablece la búsqueda y el orden. El Excel conserva todas las empresas del lote.

Una regresión escrita antes de retirar los filtros comprueba su ausencia, ambos sentidos de ordenación para las tres columnas numéricas, el foco en el encabezado y la búsqueda. Las comprobaciones DOM no sustituyen una revisión visual del navegador.

Este HTML pagina y busca en memoria; no implementa paginación HTTP ni modifica la API de producción. Los accesos por símbolo usan un índice, las búsquedas reutilizan textos normalizados y no se añaden bibliotecas, peticiones ni animaciones. La tabla conserva texto legible y desplazamiento interno en vez de comprimir las cifras para acomodarlas.

TDD: tres recorridos con 1,203 empresas sintéticas fallaron antes del cambio (`/tmp/intval-scale-red.log`). Comprueban el límite de registros en el DOM, la selección entre páginas y filtros, búsqueda y ordenación globales, última página parcial, regreso del detalle y exportación completa a Excel. Se mantienen las regresiones existentes de análisis, recuperación, cancelación, gráficas y paletas. Las comprobaciones DOM no sustituyen una revisión visual del navegador ni miden GPU o latencia de red.

El control **Paleta**, en la esquina inferior derecha, permite comparar Océano, Bosque, Lavanda, Ámbar, Rosa y Grafito, además de un color personalizado. Cambia fondo, vidrio, controles y acentos de las gráficas sin reconstruirlas ni reiniciar el análisis. La elección se guarda aparte de la sesión financiera. Los colores personalizados generan acentos con contraste suficiente para texto blanco; verde y rojo conservan su significado financiero. Las series de las gráficas financieras mantienen sus colores para conservar su identificación.

El enlace **Cómo se calcula** del pie tiene un fondo opaco y usa los colores de superficie y texto de la paleta. Así su legibilidad no depende de la onda que pase detrás. Una regresión comprueba el contraste calculado de al menos 4.5:1 en las seis paletas y cinco colores personalizados, incluidos blanco y negro; también verifica que ambos colores respondan al cambio de paleta. En colores forzados usa Canvas y LinkText.

El botón **Oscuro**, junto a Paleta y disponible también en los modales, activa o desactiva el modo oscuro sin cambiar el color elegido ni reconstruir resultados o gráficas. La preferencia de modo se guarda por separado en `intval-liquid-glass-scheme-v1`. Sin una elección previa sigue al sistema; al alternar hasta el modo que coincide con el sistema, vuelve a seguirlo. Una elección explícita se mantiene aunque el sistema cambie después. Los cambios del modo en otra pestaña se sincronizan y el control funciona aunque el navegador bloquee el almacenamiento.

La restauración del modo ocurre en un script pequeño en el encabezado, antes del CSS. `color-scheme` y su meta reflejan la elección para los controles nativos. Los colores de lectura usan `light-dark()` con alternativas CSS para navegadores sin esa función; sin JavaScript también siguen la preferencia del sistema. Se tematizan las ondas, superficies, campos, encabezados, estados, diálogos y series de las gráficas. El texto normal conserva al menos 4.5:1 de contraste calculado en las combinaciones probadas y las series gráficas al menos 3:1. La barra de apariencia se redistribuye en pantallas estrechas sin reducir el tamaño del texto. Estas comprobaciones de estilos calculados y DOM no sustituyen una revisión visual en navegador.

Con las paletas, modo oscuro, navegación y cierre exterior compatible, el presupuesto del HTML es de 40 KiB gzip, medido con la configuración predeterminada de Node. El límite de 25 registros renderizados por lista se comprueba aparte del peso del archivo.

- Un HTML independiente, sin instalaciones ni dependencias nuevas de ejecución. Se conservan las fuentes por CDN y la descarga diferida de SheetJS para Excel.
- Mismos datos ficticios, selección, trabajos, recuperación, gráficas y siete hojas de Excel. La sesión usa una clave independiente para comparar ambas versiones.
- Las pruebas de interacción del prototipo comprueban aislamiento, centro neutro, bordes desplazados, resolución acotada, transparencia reducida, fallo de Canvas, paletas y modo oscuro. El conjunto financiero demo-1.0 conserva una huella SHA-256 para detectar modificaciones de sus datos.
- Las pruebas DOM no validan el aspecto ni el rendimiento de GPU. No se ha podido generar una captura de navegador en esta sesión.
