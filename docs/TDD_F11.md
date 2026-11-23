# F11 — Distribución agnóstica y transición de arranque

Fecha: 2026-11-21. Base: `9ffb209`, cierre de UI-5.

**Estado: F11 cerrada en `52d1d52`.** Tests, Web y Distribución están aprobados
para ese mismo commit. La distribución está preparada y verificada; no se publicó
ningún servicio.

| Workflow | Evidencia remota de cierre |
| --- | --- |
| Tests | [Run 44967049071](https://github.com/adndvlp/IntVal/actions/runs/44967049071): 537 aprobadas, una omisión prevista del build Astro ausente y cobertura 95.47 % |
| Web | [Run 44967048831](https://github.com/adndvlp/IntVal/actions/runs/44967048831): 122 unitarias y 91 escenarios de navegador aprobados; 11 omisiones previstas |
| Distribución | [Run 44967048857](https://github.com/adndvlp/IntVal/actions/runs/44967048857): imagen final, recorrido HTTP y SIGTERM aprobados |

Se comprobaron el SHA completo `52d1d5255ad9d36a91c8e94e8611f4b9c88f8ab1`,
la conclusión de los tres workflows, sus pasos y los logs de resultados. El
artefacto `reportes-distribucion` está adjunto al run, ID `14732455236`, con digest
`sha256:6ffb232bdcd8c6aaf4ec178c43e5a7cf1002db1d52e12c22fd62cd3fb034e69c`.
Su manifiesto identifica la imagen y las huellas verificadas por el script.

## Primera pasada de CI

El [primer run de Distribución](https://github.com/adndvlp/IntVal/actions/runs/44964709076)
construyó la imagen y aprobó el recorrido HTTP y SIGTERM el 2026-11-22 UTC.
[Tests](https://github.com/adndvlp/IntVal/actions/runs/44964709129) aprobó 537 pruebas,
con una omisión prevista del build Astro ausente en el job Python y cobertura
95.44 %. El [run Web](https://github.com/adndvlp/IntVal/actions/runs/44964709034)
terminó con 90 escenarios aprobados, 11 omisiones previstas y un fallo.
Las secciones siguientes conservan la evidencia local y los pendientes que
existían al preparar el primer commit; el resultado vigente es el cierre anterior.

## Alcance implementado

| Requisito | Implementación y verificación |
| --- | --- |
| F11-R01 | Dockerfile multietapa: build Astro, dependencias Python y runtime sin Node/npm; construcción real aprobada en CI |
| F11-R02 | Fábrica `valoracion.web.distribucion:create_app`; rutas, MIME, caché, gzip, 404/405, salud y smoke ASGI y HTTP en la imagen final aprobados |
| F11-R03 | PORT obligatorio y validado, `0.0.0.0`, un worker, runtime preparado y `exec`; proceso, señales y SIGTERM en imagen aprobados |
| F11-R04 | `iniciar_servicio.sh` inicia web/API; `iniciar_streamlit.sh` conserva la entrada anterior. Rollback y health checks documentados |
| F11-R05 | Workflows Distribución, Tests y Web aprobados para el mismo commit, con reportes separados |
| F11-R06 | README, CONTRIBUTING, arquitectura, desarrollo y SDD actualizados. Las capturas aprobadas de UI-5 siguen vigentes: no cambió el frontend |
| F11-R07 | Regresión de Python, contratos, ejemplo demo y CLI protegidos. Sin cambios de fórmulas, catálogo, locks, snapshots financieros ni anexo |

## RED y GREEN

1. La prueba inicial pidió `/app/` a la fábrica API existente y observó **404 en
   lugar de 200**. Tras componer API y estáticos, las entradas directas y recargas
   responden HTML; los recursos conservan su MIME y las rutas desconocidas, 404.
2. Tres casos del lanzador esperaron Uvicorn con PORT y observaron la entrada
   Streamlit anterior. Tras cambiar el lanzador pasan, incluyendo código de
   salida, checkout con espacios y ejecución desde otro directorio.
3. El verificador de apagado no existía. Se añadieron pruebas para aceptar el
   cierre completo y rechazar un kill forzado o logs incompletos. El verificador
   exige mensajes de cierre del lifespan y fin del proceso. Uvicorn vuelve a
   emitir SIGTERM: Docker puede registrar 143 aun después de cerrar correctamente;
   no se impone un código 0 que daría un falso fallo.

Los casos de API interceptada, PORT ausente, señales y ausencia de instalaciones
se caracterizaron y protegieron; no se atribuyeron defectos que no existían.
Un error de infraestructura o falta de herramienta no se cuenta como RED de producto.

## Decisiones de distribución

La fábrica API continúa disponible para desarrollo y pruebas independientes.
La fábrica de distribución añade un handler por defecto al router, después de
resolver sus rutas, métodos y redirects. Se eligió frente a un `Mount("/")` porque
el montaje raíz puede consumir matches parciales y sustituir un 405 de API.
`/api` queda reservado incluso ante archivos con el mismo nombre en el build.
El contrato OpenAPI exportado no cambia.

`StaticFiles(html=True, follow_symlink=False)` resuelve índices, slash y el 404 de
Astro. No hay fallback SPA 200. Los activos con hash tienen caché inmutable; el
HTML se revalida y los errores no se almacenan. Gzip se negocia para estáticos
grandes. Se exige un build completo al arrancar y `/readyz` comprueba sus archivos
y el gestor; `/healthz` no consulta Yahoo.

El Dockerfile usa versiones exactas de Node 26.13.1, npm 11.12.1 y Python 3.12.16,
`npm ci` y el lock Python sin resolver dependencias nuevas. La etapa final incluye
código, catálogo, demo, licencia MIT, configuración pública Streamlit y estáticos;
ejecuta como UID 10001. No incluye Node/npm, entornos del host, pruebas, reportes,
temporales o `.git`. Las etiquetas base y Debian pueden recibir revisiones; no se
afirma reproducibilidad binaria. El manifiesto identifica el ID real de imagen,
arquitectura, commit, árbol modificado y huellas de Dockerfile y locks.

La imagen mantiene `PUBLIC_API_BASE_URL` vacío: la web usa la API del mismo origen.
`PUBLIC_SITE_URL` es un argumento opcional de build con una URL real; no se inventó
dominio. PORT se proporciona en runtime. El producto conserva una instancia y un
worker por sus trabajos en memoria; un reinicio pierde esos trabajos. No se
añadieron bases de datos ni configuración operativa para el usuario de la web.

## Comprobaciones locales

Entorno: macOS ARM64, Python 3.12.2, Node 26.13.1 y npm 11.12.1 ya preparados.
No se instalaron herramientas globales ni se modificaron resoluciones.

| Comprobación | Resultado observado |
| --- | --- |
| Suite Python completa final | 538 aprobadas; cobertura de líneas/ramas 95.47 %, umbral 85 % |
| Distribución y arranque, incluido verificador de apagado | 57 aprobadas |
| Build Astro del mismo origen | Cuatro páginas generadas |
| Shell/anexo y HTML compilado | 69 aprobadas |
| Ruff y formato | Aprobados |
| OpenAPI y ejemplo demo `--check` | Aprobados, sin drift |
| `pip check` y sintaxis Bash de los dos lanzadores | Aprobados |
| Presupuesto de carga | Analizador 102.91 KiB JS y 12.58 KiB CSS gzip; Cómo se calcula 2.56 KiB JS y 6.42 KiB CSS gzip |

La suite conserva dos avisos conocidos de dependencias; no se actualizaron locks
para eliminarlos. Una ejecución inicial tuvo dos errores al crear directorios
temporales y se observó falta de espacio al escribir reportes. La repetición con
`TMPDIR=/private/tmp` pasó las 533 pruebas de ese punto y la ronda final pasó 538,
incluidos los cinco casos de apagado añadidos. No se eliminaron evidencias ni se
ocultaron fallos con omisiones nuevas.

Las pruebas ASGI ejecutan demo, trabajos, históricos y Excel reales sin sockets.
La misma función de smoke se usa contra la imagen por HTTP en CI. Se prueban tres
empresas, medianas conocidas, ausencia conservada, unidad financiera, precio
sintético y XLSX válido con las tres filas; no se calculan esperados a partir de
la función de producción.

Ronda final: `TMPDIR=/private/tmp .venv/bin/python -m pytest`. El ciclo focalizado
usa `-o addopts='' tests/integration/test_distribucion.py
tests/integration/test_servicio_web.py`. La evidencia local de esta entrega está
en `temp/distribucion-local-qa/20261122T000101-921179Z/manifest.json`, con logs,
JUnit, cobertura y huellas. Es una salida ignorada por Git y separada del smoke
de imagen pendiente.

## Imagen y CI

Esta sesión no disponía de Docker ni de un daemon compatible. La ejecución de
`python qa_distribucion.py` termina con diagnóstico y estado `failed` en su
manifiesto; no afirma haber construido la imagen. Los tags de las bases se
comprobaron en el catálogo oficial; eso no sustituye un build real.

El workflow [Distribución](../.github/workflows/distribucion.yml) ejecuta el
verificador en Ubuntu con Docker. Construye la imagen final, comprueba usuario
sin privilegios, ausencia de Node/npm, dependencias, CLI, PORT inválido/ausente y
el recorrido HTTP completo con un puerto aleatorio. Ejecuta también el health
check incluido y verifica el cierre con SIGTERM. El contenedor se inicia con raíz
de sólo lectura y `/tmp` temporal; sólo se elimina el contenedor propio de esa
ejecución, incluso ante una interrupción.

Los logs y el manifiesto quedan en `temp/distribucion-qa/` y se adjuntan como
`reportes-distribucion` durante siete días, también cuando falla. No se publican
imágenes ni servicios y no se usan credenciales del alojamiento.

**Cierre acreditado:** Distribución, Tests y Web verdes en `52d1d52`, con el
verificador de imagen terminado correctamente y su artefacto conservado. El
script sólo informa éxito después de comprobar la imagen y el cierre completo;
los logs y metadatos se verificaron mediante GitHub. No repetir UI-5 ni instalar
Docker en el Mac para volver a acreditar esa ejecución. La verificación de una
URL pública corresponde a un despliegue solicitado después.

## Fuentes primarias

- [StaticFiles de Starlette](https://starlette.dev/staticfiles/): índices y 404.
- [Uvicorn settings](https://uvicorn.dev/settings/): factory, host, puerto y workers.
  El comportamiento SIGTERM también se cotejó con el código de Uvicorn instalado.
- [Docker build practices](https://docs.docker.com/build/building/best-practices/):
  etapas, contexto y usuario del runtime.
- [Catálogo oficial Python](https://github.com/docker-library/official-images/blob/master/library/python)
  y [Node](https://github.com/docker-library/official-images/blob/master/library/node):
  versiones y variantes elegidas, verificadas al preparar la entrega.
- [Render Web Services](https://render.com/docs/web-services): ejecución Docker y
  escucha en `0.0.0.0:$PORT`, como ejemplo de PaaS compatible.
