# Mercado — Adquisición, caché y diagnóstico

Fecha: 2026-11-23. Base: `52d1d52`.

**Estado: corrección local; causa del proveedor en Render pendiente de confirmar.**
El usuario informó que el servicio estaba Live y que cualquier ticker producía
«Sin estimación». AAPL tenía precio 348.71, pero no nombre corporativo, monedas,
clasificación ni estados financieros. Los únicos logs aportados eran los accesos
HTTP. Ni un 200 de salud ni un 202 de aceptación garantizan datos de mercado.

## Defectos confirmados

1. El adaptador absorbía excepciones de información y estados y devolvía objetos
   vacíos sin explicar el fallo. yfinance 1.5.1 también oculta excepciones por
   defecto. El snapshot sólo recogía las consecuencias financieras de la ausencia.
2. El fallback de `get_info()` a `.info` reutilizaba un objeto que yfinance puede
   marcar como consultado antes de terminar la petición. No era un reintento real.
3. El gestor guardaba una fila sin estimación en la caché durante una hora, siempre
   que el estado fuera distinto de `ERROR`. Otro análisis podía reutilizarla.
4. La web decía «Análisis completado con observaciones» aunque no hubiera ninguna
   estimación y obligaba a abrir el detalle para conocer el motivo.

La evidencia no permite afirmar si Yahoo devuelve 401, 403, 429, 5xx, datos vacíos
u otro error en Render. Tampoco demuestra un bloqueo de direcciones IP compartidas.
No se sustituyó Yahoo, añadieron proxies de red ni modificaron credenciales.

## RED observado

| Prueba previa al cambio de producto | Fallo observado |
| --- | --- |
| Adaptador con metadatos rechazados, fallo transitorio y estados fallidos/vacíos | 3 fallos: sin diagnósticos ni reintento con objeto nuevo; 45 casos anteriores aprobados |
| Dos trabajos distintos sin estimación | El segundo reutilizaba la caché; se esperaba otra adquisición |
| Pantalla de resultado fallido y precio sin estimación | 2 fallos: anuncio de finalización anterior y causa ausente en resultados; 6 casos anteriores aprobados |

Los registros locales se conservaron en `/tmp/intval-market-red.log`,
`/tmp/intval-market-cache-red.log` y `/tmp/intval-market-ui-red.log`.
Un error de espacio en disco interrumpió herramientas; no se contabilizó como
fallo del producto. Se retiraron únicamente las cachés regenerables de Firefox
y WebKit de `temp/ui5-browsers`, preservando dependencias, capturas y evidencia.

## Cambio implementado

`ProveedorYahoo` convierte los fallos de información y estados en diagnósticos
seguros del dominio. Cada warning `yahoo_data_unavailable` contiene etapa,
símbolo validado, categoría, estado HTTP disponible y tipo de excepción. Nunca
incluye el mensaje crudo, cuerpo, URL, cookie o crumb. Los mensajes del snapshot
son estáticos y sólo incorporan el código/estado, por lo que sirven también para
el detalle y Excel.

El hijo aislado activa `yf.config.debug.hide_exceptions = False`; el proceso padre
no cambia su configuración. No se activa el logging de depuración de yfinance.
Se comprobó la opción en la dependencia instalada y en su
[documentación de configuración](https://ranaroussi.github.io/yfinance/advanced/config.html).

Un timeout, fallo de conexión o 5xx de información permite **un** reintento con
un objeto nuevo. No hay bucles, esperas añadidas ni insistencia ante 401/403/429.
Se conserva el límite temporal del proceso aislado. La recuperación no deja un
diagnóstico de fallo definitivo en un resultado que ya obtuvo los metadatos.

El gestor registra `analysis_no_estimate` y sólo introduce en la caché filas
con una mediana disponible y estado distinto de `ERROR`. Los trabajos y su
idempotencia siguen vigentes. Se puede volver a analizar sin reutilizar una fila
vacía. El lote sigue terminando como procesado y conserva resultados y Excel.

La web muestra «No hay estimaciones disponibles» cuando todas las medianas son
nulas. Con una sola empresa muestra la primera causa junto al aviso. Los lotes
mixtos conservan su mensaje anterior y los diagnósticos completos siguen en el
detalle. No se añaden controles, configuración ni pasos para el usuario.

Las monedas desconocidas permanecen desconocidas. Se conservan las guardas FX,
la clasificación sectorial y los límites de aplicabilidad de los cuatro modelos.
No cambian fórmulas, esquemas, fuentes/versiones, dependencias ni locks.

## Verificación

Las pruebas simulan rechazo HTTP, recuperación transitoria, límites de reintentos,
estados vacíos y secretos en excepciones. Un caso usa un **proceso hijo real**:
comprueba el diagnóstico en su respuesta, warning en stderr, ausencia de secretos
y configuración yfinance del padre intacta.

| Comprobación local | Resultado |
| --- | --- |
| Suite Python completa | 543 aprobadas, dos avisos conocidos; cobertura de líneas/ramas 95.22 % |
| Adaptador tras añadir seis casos de límite/rechazo/recuperación | 54 aprobadas; incluye los 48 casos presentes en la suite completa |
| Frontend con cobertura | 123 aprobadas; líneas 95.14 %, ramas 86.26 % |
| Tipos Astro/TypeScript | 82 archivos; cero errores, avisos o hints |
| Ruff, formato Python, ESLint y diff sin errores de espacios | Aprobados |
| OpenAPI y ejemplo demo versionado | `--check` aprobados, sin drift |
| Build Astro del mismo origen | Cuatro páginas generadas |
| Shell/anexo y HTML compilado | 69 aprobadas |
| Medidor de activos | Dos pruebas aprobadas y presupuesto aprobado |
| Dependencias instaladas | `pip check` sin requisitos rotos |

Los seis casos adicionales se incorporaron mientras terminaba la suite completa;
se ejecutaron después con el archivo entero del adaptador. No cambió código de
producto entre ambas comprobaciones. El analizador entrega 102.98 KiB JS y
12.58 KiB CSS gzip; Cómo se calcula, 2.56 KiB JS y 6.43 KiB CSS gzip.

Registros locales: `/tmp/intval-market-python.log`,
`/tmp/intval-market-retries.log`, `/tmp/intval-market-frontend.log`,
`/tmp/intval-market-types.log`, `/tmp/intval-market-build.log`,
`/tmp/intval-market-shell.log` y `/tmp/intval-market-budget-test.log`.

## Continuidad

Esta corrección todavía no se ha desplegado ni validado contra Yahoo desde Render.
La URL pública no es accesible desde las herramientas de esta sesión. El siguiente
despliegue permitirá distinguir la respuesta real mediante los nuevos eventos y
el detalle de la app, sin ejecutar scripts de diagnóstico. Si hay un rechazo
persistente del proveedor, eso seguirá necesitando una solución de adquisición;
no se presenta este cambio de diagnóstico como una reparación de ese rechazo.

El build y las regresiones locales no sustituyen la comprobación de esa consulta
real. No se volvieron a solicitar comandos al usuario. Chromium está bloqueado
en este entorno; la validación de navegador de esta revisión queda a cargo de CI.
