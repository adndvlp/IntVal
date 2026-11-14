# Despliegue agnóstico, dependencias y desarrollo

La aplicación se ejecuta como un **servicio web Python/Streamlit sobre Linux**.
El usuario accede por URL. El proveedor de alojamiento, su plan y su mecanismo
para publicar el servicio se eligen fuera de la aplicación: el repositorio no
requiere un Blueprint, una API o un manifiesto de una plataforma específica.

Las comprobaciones locales sirven para desarrollar y validar el código. La
referencia es **CPython 3.12** en `.python-version`, compartida con CI. La
verificación local usa macOS ARM64/Python 3.12.2; CI apunta a Ubuntu. La ejecución
remota de CI y la validación de una URL publicada son evidencias independientes.

La [SDD web](SDD_WEB.md) define Astro estático, React y FastAPI. F6 incorpora sus
fundamentos, descritos en la sección 8; F7 añade la landing (sección 9), con
revisión local y capturas completadas. F8 incorpora análisis HTTP (sección 10);
F9 añade el dashboard React conectado a esa API (sección 11).
F10 está implementada y verificada localmente ([procedimiento](QA_F10.md)); F11 sigue pendiente. El contrato de
ejecución publicado de esta guía continúa siendo Streamlit hasta la transición
de F11.

## 1. Contrato de ejecución

| Requisito | Contrato |
| --- | --- |
| Runtime | Linux, Bash y CPython 3.12 |
| Preparación | `python -m pip install --no-deps -r requirements.txt` |
| Comprobar dependencias | `python -m pip check` |
| Arranque | `bash iniciar_servicio.sh` |
| Puerto | Variable de entorno `PORT`, obligatoria |
| Dirección de escucha | `0.0.0.0` |
| Health check | `/_stcore/health` |
| Comunicación | HTTP y WebSockets de Streamlit |

Configurar Python 3.12 explícitamente en el entorno elegido. `.python-version`
es la referencia del repositorio y CI; cada plataforma puede tener su propio
mecanismo para seleccionar el intérprete. No se supone que todas lean ese archivo.

La preparación instala la resolución de ejecución. Las herramientas pytest/Ruff
sólo pertenecen a desarrollo y CI. El arranque usa `python` del entorno preparado
y su `PORT`; no crea ni activa `.venv` dentro del checkout y no instala paquetes.

`iniciar_servicio.sh` ejecuta Streamlit en primer plano con `exec`, modo headless,
file watcher y telemetría opcional desactivados. Conserva señales/código de salida.
Sin `PORT`, termina con un diagnóstico genérico antes de iniciar Streamlit.

No se añade un backend HTTP separado, una base de datos ni almacenamiento
persistente como requisito de F4. El proceso web es el que proporciona Streamlit.

## 2. Configurar el alojamiento elegido

1. Preparar un runtime compatible con Python 3.12 y las bibliotecas del lock.
2. Configurar los comandos de preparación y arranque del contrato anterior.
3. Definir `PORT` y exponer ese puerto con soporte HTTP/WebSockets.
4. Configurar el health check, si el entorno admite esa comprobación.
5. Publicar y verificar la URL, análisis de un ticker, gráficas y descarga Excel.

La conexión al repositorio, los secretos del alojamiento, dominios, TLS, permisos,
planes y reglas de despliegue automático pertenecen a la configuración del
entorno. El código y sus pruebas no requieren SDK, credenciales ni recursos de
un proveedor concreto. CI verifica el repositorio y no publica el servicio.

No hay una URL ni recursos de alojamiento creados como parte de esta edición.
La comprobación final se realiza sobre la URL que genere el entorno elegido.

## 3. Estado de la aplicación

La app conserva resultados/cachés en memoria y exporta Excel para descarga.
Un reinicio puede requerir repetir el análisis; no se presupone persistencia del
sistema de archivos de un alojamiento. Esa característica y los límites de
recursos se deben revisar en el entorno de publicación elegido.

Yahoo sigue siendo un proveedor externo con disponibilidad y límites propios.
Un health check exitoso acredita que Streamlit responde, no que cada ticker tenga
datos. No se modificó la metodología para el alojamiento.

La UI incluye un selector **Fuente de datos → Demostración** que usa archivos
locales versionados y carga tres casos al activarse. Puede configurarse
`VALORACION_DEMO=1` para abrir esa vista en sesiones nuevas. Es una variable del
producto, independiente del proveedor de alojamiento; no cambia los comandos
de preparación/arranque ni exige una base de datos.

La demo no consulta Yahoo ni descarga históricos. La primera carga de recursos
de la página sigue necesitando acceder al servicio web. Los resultados son
deterministas para el dataset, la configuración y la metodología fijados; el
Excel incorpora la fecha de generación. No confundir el modo de producto con
la suite de tests ni prometer que todo el servicio web funciona sin conexión.

Al cambiar de fuente se descarta el análisis anterior. Las claves de caché de
análisis y ambos tipos de históricos incluyen la fuente, y no se mezclan precios
de mercado con la demo. La configuración guardada al analizar sigue siendo la
que se exporta hasta solicitar otro análisis.

## 4. Preparar un entorno de desarrollo

Usar Git y CPython 3.12 desde la raíz. En el Mac de desarrollo:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --no-deps -r requirements-dev.txt
.venv/bin/python -m pip check
```

Se invoca el intérprete directamente para que pip y herramientas usen el mismo
Python sin depender de la activación ni de un `python` global en PATH. Estos son
comandos de desarrollo, no la forma de consumir la aplicación desplegada.

Para desarrollar únicamente con dependencias de ejecución:

```bash
.venv/bin/python -m pip install --no-deps -r requirements.txt
```

`--no-deps` instala sólo los pines del archivo resuelto, incluidas sus transitivas;
`pip check` detecta una resolución incompleta. No usar esa opción con los `.in`,
que contienen entradas y no la resolución completa.

Para inspeccionar la UI durante desarrollo se puede ejecutar Streamlit con ese
intérprete. Se retiraron los antiguos lanzadores orientados a instalación local;
el arranque versionado del servicio es `iniciar_servicio.sh`.

## 5. Fuentes y regeneración de dependencias

| Archivo | Responsabilidad |
| --- | --- |
| `requirements.in` | Dependencias directas de ejecución y watchdog requerido en Linux |
| `requirements-dev.in` | Herramientas de desarrollo; incluye ejecución y la restringe con `-c requirements.txt` |
| `requirements.txt` | Resolución completa de ejecución con pines exactos |
| `requirements-dev.txt` | Resolución completa de desarrollo compatible con ejecución |
| `pyproject.toml` | Configuración de pytest, coverage y Ruff; no duplica dependencias |
| `.python-version` | Referencia de Python para ejecución y CI |

No editar manualmente los `.txt` para actualizar bibliotecas. Cambiar las entradas
y regenerar primero ejecución y después desarrollo. Pip-tools reutiliza los
pines existentes si siguen satisfaciendo las entradas. La resolución inicial
conserva las versiones del producto verificadas en F3.

Con pip-tools 7.6.2 y pip 26.3 en CPython 3.12, un comando por línea:

```bash
.venv/bin/python -m piptools compile --allow-unsafe --strip-extras --no-emit-index-url --no-emit-trusted-host --output-file requirements.txt requirements.in
.venv/bin/python -m piptools compile --allow-unsafe --strip-extras --no-emit-index-url --no-emit-trusted-host --output-file requirements-dev.txt requirements-dev.in
```

Para actualizar transitivas deliberadamente se puede añadir `--upgrade`; para
una directa hay que cambiar antes su pin en `.in`. Revisar el diff, comprobar una
instalación limpia y ejecutar la suite. `--allow-unsafe` permite fijar pip y
setuptools como dependencias de las herramientas; no significa que se haya
realizado una auditoría de seguridad.

La compilación de esta sesión se ejecutó en macOS y fijó explícitamente watchdog
porque Streamlit lo necesita en Linux. El contrato de dependencias verifica los
marcadores de Linux; Ubuntu en CI es la verificación del entorno de destino.
No se promete equivalencia binaria universal ni soporte de instalaciones de
usuario final en Windows/macOS. Las bibliotecas nativas deben estar disponibles
para la arquitectura del entorno de publicación.

La resolución depende de Python, plataforma, entradas, pines previos, compilador
y candidatos del índice. La [documentación de pip-tools](https://pip-tools.pypa.io/en/stable/)
recomienda resolver en el entorno correspondiente. No se cambia de herramienta
ni se interpreta un `pip freeze` de un entorno antiguo como una actualización
validada. Se fijan versiones; no hashes de todos los artefactos de cada plataforma.

## 6. Comprobaciones y TDD

```bash
.venv/bin/python -m pip check
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
.venv/bin/python -m pytest
```

Para aplicar correcciones seguras/formato durante el desarrollo:

```bash
.venv/bin/python -m ruff check . --fix
.venv/bin/python -m ruff format .
```

Pytest, cobertura y Ruff están en `pyproject.toml`; se retiraron `pytest.ini` y
`.coveragerc`. La cobertura mantiene ramas, todas las entradas y `valoracion`, con
umbral 85 %. Los reportes XML/JUnit permanecen ignorados por Git.

Ruff comprueba E4/E7/E9/F/I y formato a 100 columnas. La fachada tiene excepción
F401 por sus reexportaciones deliberadas. `.gitattributes` conserva LF para código
y shell; los fixtures versionados se leen en UTF-8. Véase la
[configuración oficial de Ruff](https://docs.astral.sh/ruff/configuration/).

TDD sigue siendo obligatorio: prueba de regresión, fallo observado, cambio mínimo
y refactorización con pruebas verdes. CI usa Ubuntu/Python 3.12, crea un entorno
nuevo, instala el lock de desarrollo, comprueba dependencias/lint/formato y ejecuta
pytest. CI no contiene credenciales ni publica la aplicación. Cualquier automatización
de publicación se configura en el entorno elegido.

## 7. Red y validación independiente

La instalación y regeneración normalmente necesitan el índice de paquetes.
Arrancar una imagen/build preparado no reinstala dependencias. Las pruebas usan
proveedores sintéticos y bloquean las consultas de mercado; las de arranque PaaS
usan un runtime temporal de prueba sin pip para registrar argumentos/señales de
salida, sin abrir un servicio público.

```bash
.venv/bin/python -m examples.valoracion_independiente
.venv/bin/python -m examples.analisis_demo
```

El ejemplo funciona sin Yahoo y genera su conciliación CSV/Excel. Para comprobar
un entorno limpio se crea otro `venv`, se instala `requirements-dev.txt` y se
repiten los cuatro comandos de validación. Una descarga previa para la plataforma
permite instalar con `--no-index --find-links RUTA`; la ruta de esa descarga no es
una dependencia del repositorio.

El [ejemplo público de F5](../examples/demo/README.md) incluye un CSV, un Excel real
y el manifest de los tres casos de demo. Los datos están descritos en
[data/demo](../data/demo/README.md). Las salidas por defecto de ambos scripts
permanecen en `examples/salida/`, ignorado por Git.

La [evidencia de F4](TDD_F4.md) y la [evidencia de F5](TDD_F5.md) registran los
resultados reales. Se verificó el run de Ubuntu del commit `d90fc2a`, previo a F5:
[Tests #5, correcto](https://github.com/adndvlp/IntVal/actions/runs/43363574654).
Ese run no valida cambios posteriores aún sin publicar. La validación local,
el run remoto correspondiente y la URL desplegada son evidencias distintas.

Durante la especificación de la siguiente etapa se verificó también el
[run de F5 para 345aa0a](https://github.com/adndvlp/IntVal/actions/runs/43370891010),
completado correctamente. Es la línea base de SDD_WEB.md; no acredita las fases
F6 ni las fases posteriores.

## 8. Fundamentos web (F6)

F6 añade una API de lectura y un shell estático de vista previa. La landing
completa corresponde a F7 y el análisis HTTP a F8. `app.py`, CLI y
`iniciar_servicio.sh` mantienen su comportamiento; el servicio actual sigue
siendo Streamlit. El frontend no necesita un proceso Node en producción.

### Herramientas y preparación

Usar Node **26.13.1** (`frontend/.node-version`) y npm **11.12.1**
(`packageManager` y `engines`). La instalación falla con runtimes incompatibles
por `engine-strict`. El mecanismo para preparar Node depende del entorno.
Las dependencias directas tienen versiones exactas y `package-lock.json`
incluye transitivas e integridades reales; no usar `--force` ni
`--legacy-peer-deps` para resolver conflictos.

Con el entorno Python de la sección 4 instalado, desde `frontend/`:

```bash
npm ci
npm run lint
npm run format:check
npm run check
npm run test:unit
npm run build
npm run test:shell
```

`build` genera `frontend/dist/`. `test:shell` inspecciona ese HTML con JavaScript
desactivado; requiere ejecutar el build primero. La portada no hidrata React;
`/app/` hidrata únicamente la comprobación de conexión. Ningún build consulta
mercado ni ejecuta análisis financieros.

### API y desarrollo de la vista previa

Desde la raíz, iniciar la API con la factoría:

```bash
export VALORACION_CORS_ORIGINS=http://127.0.0.1:4321
.venv/bin/python -m uvicorn valoracion.web.aplicacion:create_app --factory --host 127.0.0.1 --port 8766
```

En otra terminal, desde `frontend/`:

```bash
export PUBLIC_API_BASE_URL=http://127.0.0.1:8766
npm run dev
```

Estos puertos son de desarrollo. El alojamiento sigue siendo agnóstico: puede
servir los archivos estáticos y dirigir `/api/v1` al proceso Python, o alojar
frontend y API con orígenes distintos. F11 definirá el arranque final del
producto; F6 no publica ni sustituye el servicio existente.

| Variable | Valor por defecto / efecto |
| --- | --- |
| `PUBLIC_API_BASE_URL` | Vacío: mismo origen. Se incorpora al build; con orígenes separados usar la URL pública de la API |
| `VALORACION_CORS_ORIGINS` | Vacío: sin orígenes cruzados. Lista separada por comas de orígenes HTTP(S), sin rutas ni comodines |
| `VALORACION_DEMO` | `0`; `1` selecciona demo en metadatos |
| `VALORACION_MARKET_ENABLED` | `1`; `0` deshabilita esa fuente y selecciona demo por defecto |
| `VALORACION_MAX_TICKERS` | `650`; entero positivo publicado como límite para la futura selección de análisis |

Las banderas sólo aceptan `0`/`1`. Ajustes inválidos fallan al crear la instancia.
CORS no permite credenciales. No poner secretos en variables `PUBLIC_`.

Rutas implementadas: `/healthz`, `/api/v1/meta` y `/api/v1/catalog`.
`/docs` ofrece la documentación técnica de FastAPI. El catálogo acepta
`source=market|demo` (por defecto `market`) y `market=USA|MX|all` (por defecto
`all`); el cliente debe enviar la fuente elegida en metadatos. Una fuente
deshabilitada devuelve 422. Los catálogos usan archivos locales, conservan orden
y referencia y no verifican la composición actual de índices con un proveedor.
`capabilities` contiene únicamente `catalog`. No hay rutas de análisis,
exportación o disponibilidad del build (`readyz`) en esta fase.

Los nueve supuestos editables están en `ConfiguracionWeb`; metadatos devuelve
también las constantes efectivas. El descuento de empresa empieza explícitamente
en 10 %, independientemente del descuento del accionista. La pausa efectiva es
0.15 s para mercado y cero en demo. El constructor heredado `Configuracion()`
conserva su tasa de empresa heredada y pausa de 0.35 s.

### Contrato generado

Desde la raíz:

```bash
.venv/bin/python -m valoracion.web.contratos
.venv/bin/python -m valoracion.web.contratos --check
npm run types:generate --prefix frontend
git diff -- contracts/openapi.v1.json frontend/src/lib/generated/api.ts
```

Versionar ambos archivos generados al cambiar un contrato. El exportador usa
ajustes deterministas y no incorpora URLs del alojamiento, variables del entorno
ni paths personales. El cliente valida las capacidades que consume sin asumir
que un HTTP 200 con HTML sea una respuesta de API válida.

### Navegador y CI

Desde `frontend/`, tras preparar Python y Node:

```bash
npx --no-install playwright install chromium firefox webkit
npm run test:e2e
```

Playwright inicia la API en modo demo sin mercado, recompila el sitio con la URL
de esa API y sirve el build con Astro preview. Prueba conexión real, teclado,
ausencia de errores JS, overflow y navegación sin JavaScript en 1280 y 390 px.
Reservar los puertos 4321 y 8766; no reutiliza servicios ajenos. Si ya existe
Chrome, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` permite usarlo sin descargar
otro navegador. La suite cierra sus procesos al terminar.

`web.yml` prepara entornos nuevos, instala el lock, comprueba OpenAPI/tipos sin
drift, lint, formato, tipos, tests, build, HTML, presupuestos y los tres motores
contra la API real.
`tests.yml` conserva todas las regresiones Python, incluidas las de API, y el
umbral de cobertura combinada de 85 %. Ambos workflows sólo tienen permisos
de lectura y no despliegan. Los reportes y capturas de tests están ignorados en
Git y se conservan temporalmente como artefactos de CI.

Evidencia local, incidencias y versiones verificadas: [TDD_F6.md](TDD_F6.md).
El run remoto del nuevo workflow y una URL pública siguen siendo verificaciones
posteriores al commit; no se deducen del resultado local.

## 9. Landing y sistema visual (F7)

El build estático incorpora `/`, `/metodologia/`, `/app/` y `/404.html`.
La landing y metodología no hidratan React ni hacen peticiones a la API.
Los CTA conservan `fuente=demo|market` al entrar al dashboard integrado en F9.
El arranque por defecto continúa siendo Streamlit hasta la transición F11.

El diseño comparte tokens de color, tipografía y estados entre las rutas.
Usa fuentes del sistema, sin descargas de fuentes ni bibliotecas de gráficas
para el hero. La comparación es una tabla HTML con barras decorativas:
las cifras completas siguen disponibles sin CSS o JavaScript.

### Derivado reproducible de la demostración

`frontend/src/data/demo.json` se genera leyendo exclusivamente el CSV y manifest
versionados de `examples/demo`. No ejecuta el motor ni consulta Yahoo:

```bash
.venv/bin/python -m examples.exportar_demo_web
.venv/bin/python -m examples.exportar_demo_web --check
```

El segundo comando se ejecuta en CI antes del build. Si cambia el ejemplo,
regenerar el JSON, revisar los importes, repetir capturas y versionar los cambios
coherentes. No editar números del hero a mano. La fecha de referencia del dataset
no es una fecha de cotización actual.

### Comprobar y capturar

Los comandos de la sección 8 siguen vigentes. `npm run test:shell` ahora incluye
la narrativa y los enlaces de landing/metodología/404, conciliación visible y
presupuesto CSS, además del shell. Playwright añade cuatro anchos, movimiento
reducido, texto al 200 % y contraste de las combinaciones críticas.

Desde `frontend/`, con los navegadores preparados:

```bash
npm run capture
```

El comando ejecuta los E2E contra el build y la API real. Sólo después de que
pasen copia capturas intencionales a `docs/images/` y una imagen del hero a
`frontend/public/images/social.png`. Con Chrome ya instalado puede ejecutarse
`PLAYWRIGHT_CHANNEL=chrome npm run capture`. Revisar visualmente las imágenes
antes de aceptarlas; este comando no actualiza baselines de comparación de píxeles.
Los reportes efímeros de tests continúan ignorados.

Para etiquetas sociales y canonical, definir `PUBLIC_SITE_URL` con el origen
público real al hacer el build. Mientras no exista, se omiten URL canónica,
`og:url` e imagen OG absoluta; no se inventa un dominio. Title, description,
favicon y metadatos de texto están disponibles en preview. `/app/` tiene
`noindex, follow`. No se crea sitemap ni robots de producción antes de conocer
el alojamiento.

La evidencia y sus límites se registran en [TDD_F7.md](TDD_F7.md).

## 10. API de análisis (F8)

La factoría de la sección 8 ahora expone trabajos, resultados, cancelación,
históricos y Excel. Iniciar Uvicorn con **un proceso**, sin --workers múltiples:
cola, IDs y cachés pertenecen a la memoria de esa instancia. Reiniciar elimina
los trabajos; no hay base de datos, cuentas ni listado global de análisis.
El comando de producción Streamlit permanece vigente hasta F11.

### Recorrido HTTP

Para un servicio API en ejecución, crear explícitamente el análisis:

```http
POST /api/v1/analyses
Content-Type: application/json

{
  "client_request_id": "00000000-0000-4000-8000-000000000008",
  "source": "demo",
  "tickers": ["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"],
  "configuration": {"tasa_descuento": 0.1, "tasa_descuento_empresa": 0.1}
}
```

La respuesta 202 contiene id, configuración completa, estado y links. Conservar
client_request_id al reintentar la misma creación; usar otro para un nuevo lote.
La misma solicitud normalizada no ejecuta dos trabajos. Un UUID reutilizado con
otro contenido produce 409. Los campos omitidos toman los defaults web, no una
configuración financiera enviada después desde otro formulario.

| Operación | Ruta |
| --- | --- |
| Estado y conteos | GET /api/v1/analyses/{id} |
| Página de filas nuevas | GET /api/v1/analyses/{id}/results?after=0&limit=100 |
| Cancelar | POST /api/v1/analyses/{id}/cancel |
| Precio histórico | GET /api/v1/analyses/{id}/companies/{ticker}/prices?period=1y |
| Estados y márgenes | GET /api/v1/analyses/{id}/companies/{ticker}/financials |
| Excel completo | GET /api/v1/analyses/{id}/export.xlsx |

Usar next_cursor para la página siguiente. Las filas son append-only en el
orden aceptado; el cliente aplica el orden visual después. done indica estado
terminal, no que esa página contenga todas las filas. Drenar las páginas hasta
processed. Estado y filas financieras tienen significados distintos: completed
puede incluir ERROR; failed conserva parciales por un fallo de infraestructura.

Cancelar queued no consulta al proveedor. En running devuelve cancelling,
termina la empresa actual y pasa a cancelled antes de comenzar otra. Repetir
cancel en un terminal conserva ese estado. Excel requiere completed, incluso
cuando todas las filas son ERROR; otros estados devuelven EXPORT_NOT_READY.
No enviar filtros, supuestos actuales o filas al descargar: se usa el snapshot.

Los históricos requieren una empresa perteneciente al lote y ya procesada.
Precios: date/value y price_kind synthetic o adjusted_close. Financieros:
year, unit=millions y márgenes unit=ratio. El servicio ya convirtió los importes
a millones; la UI no debe repetir esa división. Null no es cero. Los históricos
se adquieren después del análisis y exponen tiempos/procedencia independientes.

### Límites y configuración del runtime

GET /api/v1/meta publica las capacidades y los límites efectivos. Las variables
operativas siguientes son enteros ASCII positivos y se leen al crear la app:

| Variable | Default |
| --- | ---: |
| VALORACION_MAX_TICKERS | 650 |
| VALORACION_MAX_BODY_BYTES | 65536 |
| VALORACION_MAX_QUEUE | 2 |
| VALORACION_MAX_RETAINED | 16 |
| VALORACION_MEMORY_BUDGET_BYTES | 67108864 |
| VALORACION_TERMINAL_TTL_SECONDS | 3600 |
| VALORACION_ANALYSIS_CACHE_TTL_SECONDS | 3600 |
| VALORACION_PRICES_CACHE_TTL_SECONDS | 1800 |
| VALORACION_FINANCIALS_CACHE_TTL_SECONDS | 3600 |
| VALORACION_JOB_DEADLINE_SECONDS | 1800 |
| VALORACION_ACQUISITION_TIMEOUT_SECONDS | 60 |

Se mantienen VALORACION_DEMO, VALORACION_MARKET_ENABLED y VALORACION_CORS_ORIGINS de la
sección 8. CORS permite GET/POST y Content-Type sólo para los orígenes explícitos;
no habilita credenciales. La demo nunca recurre a Yahoo.

El worker financiero es serial. Las cachés tienen hasta 512 entradas combinadas;
las marcas de expiración, hasta 64. El presupuesto mide payload JSON administrado,
no RSS. Al necesitar espacio, se eliminan cachés y terminales antiguos, nunca
un activo sin transición. Una fila que excede el presupuesto falla su trabajo
con MEMORY_LIMIT_EXCEEDED; no desaparecen silenciosamente los parciales.

Los TTL usan tiempo monotónico; las fechas de respuesta son UTC. Los cache hits
conservan las fechas originales. La recolección ocurre al acceder y cada 30 s
cuando el worker está ocioso. Un ID expirado conocido da 410; uno perdido tras
reinicio o fuera de las marcas retenidas da 404. Ambos requieren crear un nuevo
análisis explícitamente.

Un proceso spawn por lote mantiene su propio proveedor y FX. La adquisición
de cada empresa está limitada por watchdog: al superar el plazo se mata y
recolecta al hijo, se conserva lo ya calculado y el worker puede continuar con
otro trabajo. El deadline global se comprueba entre empresas. Los históricos
usan el mismo aislamiento y un carril por fuente: si falta capacidad dan
503/Retry-After; un histórico cacheado no necesita el carril. La admisión llena
da 429/Retry-After. No confundir cancelar un fetch con cancelar el trabajo.

Todos los errores de API tienen error.code/message/fields/retryable. Nunca
mostrar una excepción del proveedor: los mensajes ya son seguros y están en
español. No reintentar validaciones; para fallos retryable usar esperas acotadas
y respetar Retry-After. GET /healthz y /readyz no consultan Yahoo; readiness
comprueba el runtime, no los estáticos de la futura distribución F11.

### Pruebas y contratos

```bash
.venv/bin/python -m pytest tests/api
.venv/bin/python -m valoracion.web.contratos --check
npm run types:generate --prefix frontend
git diff -- contracts/openapi.v1.json frontend/src/lib/generated/api.ts
```

Las pruebas de proceso usan proveedores locales y TestClient ASGI: no necesitan
abrir puertos ni consultar Yahoo. La suite completa sigue siendo obligatoria.
No editar los tipos generados ni actualizar fixtures financieras para ocultar
una diferencia. Evidencia, timeouts inspeccionados y medidas:
[TDD_F8.md](TDD_F8.md). La integración de UI se documenta a continuación.

## 11. Dashboard React (F9)

`frontend/src/pages/app/index.astro` carga la isla `AnalysisApp` con `client:load`.
Astro genera cuatro rutas estáticas. La landing y metodología funcionan sin
JavaScript; `/app/` explica que el análisis requiere JavaScript y ofrece enlaces
a metodología y ejemplos. El frontend consume `PUBLIC_API_BASE_URL`, fijada al
compilar, y los tipos generados de `contracts/openapi.v1.json`. El origen puede
ser el mismo o uno permitido por CORS. La distribución conjunta queda para F11.

Para comprobar el producto nuevo, usar los runtimes fijados en `frontend/`:

```bash
npm ci
npm run lint
npm run format:check
npm run check
npm run test:unit
npm run build
npm run test:shell
npx --no-install playwright install chromium
npm run test:e2e
```

El E2E inicia su API real en localhost:8766 y sirve el build en localhost:4321;
los cierra al terminar. La configuración de prueba usa `VALORACION_DEMO=1`,
`VALORACION_MARKET_ENABLED=0` y CORS para el origen de prueba. No reutiliza un
servicio existente. Requiere la `.venv` de la raíz, Node en PATH y puertos libres.
Si se dispone de Chrome instalado, `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`
usa ese navegador. Esto es una comprobación de desarrollo, no un requisito de
operación local del producto publicado.

Los doce recorridos cubren escritorio y viewport móvil, landing, HTML sin JS,
demo real, teclado/Esc, filtros, cuatro gráficas, axe, 320 px y texto al 200 %.
Descargan el Excel real y `scripts/verify-export.py` reabre sus siete hojas con
openpyxl; comprueba las tres filas, 73 campos y la tasa aceptada del 10 % después
de editar el borrador al 15 %. No compara sólo un nombre o un mock del archivo.
Reportes, trazas, capturas diagnósticas y XLSX quedan ignorados en
`frontend/test-results/`, `playwright-report/` y `coverage/`. Las capturas de
documentación seleccionadas y revisadas sí se versionan en `docs/images/`.

El estado React separa borrador, trabajo HTTP y snapshot financiero. Las
consultas incluyen origen de API, fuente, dataset, ID, empresa y período según
el recurso. Cambiar fuente o limpiar invalida la generación y aborta lecturas;
una creación aceptada tarde se cancela por su ID. Cada creación usa UUID y el
reintento conserva UUID/payload. Los GET reintentables tienen dos reintentos
acotados y respetan Retry-After; los POST no se repiten automáticamente.

`sessionStorage` usa la clave `intval.analysis.v1:<baseUrl>` para fuente,
referencia de trabajo y solicitud aceptada. No almacena filas, históricos ni
Excel. Recupera el mismo ID/UUID después de recargar; si recibe 404/410 informa
que hay que volver a analizar explícitamente. Al limpiar la demo se guarda su
supresión para evitar un análisis automático involuntario al volver a montar.
Si el almacenamiento está bloqueado, la sesión actual sigue funcionando.

La tabla pagina veinte filas; el catálogo muestra treinta opciones por página,
pero «Seleccionar todo el mercado» incluye el catálogo completo del mercado
elegido. La descarga contiene el snapshot completo aunque los filtros dejen
la tabla vacía. Los históricos se solicitan sólo al abrir su panel; estados y
márgenes comparten recurso. Millones y FX llegan transformados desde la API;
el cliente sólo da formato. Recharts se carga con import dinámico y cada gráfica
tiene una alternativa tabular con encabezados y desplazamiento por teclado.

Evidencia y límites: [TDD_F9.md](TDD_F9.md). F10 conserva la auditoría integrada
en varios motores, accesibilidad automática, rendimiento y memoria; F11 prepara la
distribución y cambia el arranque. No actualizar dependencias por avisos de npm
ni tratar estos comandos de desarrollo como instrucciones de un PaaS concreto.

## 12. Calidad integrada (F10)

[QA_F10.md](QA_F10.md) define la matriz Chromium/Firefox/WebKit, accesibilidad
automática, referencias visuales por entorno y mediciones de laboratorio. La
evidencia de implementación y el alcance final están en [TDD_F10.md](TDD_F10.md).

Tras el build, `npm run test:assets` comprueba los presupuestos de scripts,
estilos e imágenes y la carga diferida de gráficas. `npm run test:shell`
comprueba además contrastes críticos de la paleta. `npm run test:visual` compara
sólo referencias revisadas en el OS/Chromium que las generó; no aceptar candidatos
sin inspección ni equiparar píxeles de Ubuntu y macOS.

`python -m benchmarks.web_capacity --count 604 --output /tmp/intval-capacity.json`
ejecuta una campaña independiente con un proveedor sintético de pruebas y la
pausa market conservada. No cambia el catálogo demo, no consulta Yahoo y no
acredita el consumo de un PaaS. El resultado contextualizado está en
[quality/f10-capacity.json](quality/f10-capacity.json).
