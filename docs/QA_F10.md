# F10 — Procedimiento de validación integrada

Ejecutar sobre el build del commit/árbol que se quiere validar. La demostración
usa datos sintéticos locales, referencia 2025-01-03. No se necesitan cotizaciones
reales para comprobar los recorridos. No cambia el arranque por defecto.

## Comprobaciones reproducibles

Runtimes y dependencias fijados en los archivos existentes del repositorio:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m valoracion.web.contratos --check
.venv/bin/python -m examples.exportar_demo_web --check
.venv/bin/python -m benchmarks.web_capacity --count 604 --output /tmp/intval-capacity.json
```

Desde frontend, con Node/npm fijados en PATH:

```bash
npm ci
npm run lint
npm run format:check
npm run check
npm run test:unit
npm run build
npm run test:shell
npm run test:assets
npx --no-install playwright install chromium firefox webkit
npm run test:e2e
```

Playwright sirve el build de producción y una API FastAPI real, con mercado
deshabilitado. Cada motor se prueba a 1280 × 800 y 390 × 844. El viewport móvil
en escritorio no acredita un teléfono físico. Los fallos de red/expiración se
inducen en el transporte sobre respuestas reales, sin sustituir el cálculo de
la demo ni el XLSX. Las pruebas de componentes aíslan además estados y carreras.

El medidor de assets incluye scripts inline, dependencias estáticas, componente
y renderer de la isla inicial; separa imports dinámicos, incluidos los template
literals emitidos por Vite. Suma bytes gzip de recursos únicos, sin atribuirle
ese valor a transferencia real HTTP. Protege 50 KiB JS/CSS de landing y
300 KiB JS inicial de app; comprueba dimensiones de imágenes y gráficas diferidas.

La medición de capacidad usa ASGI in-process y procesos spawn reales. Inyecta
un proveedor local con una copia independiente por símbolo y variación de
precio; no amplía el catálogo del producto demo. Mantiene la pausa market de
0.15 s. Verifica 604 filas únicas, cola llena con 429, UUID idempotente,
cancelación de pendientes, salud durante ejecución, caché ≤512 entradas,
presupuesto JSON y Excel de siete hojas/604 registros. `ru_maxrss` del padre y
máximo de un hijo se informan por separado; no equivalen al pico simultáneo del
árbol de procesos ni al consumo de un plan PaaS. Ejecutar en un proceso nuevo.

El perfil de navegador usa tres contextos nuevos, caché HTTP deshabilitada,
viewport 390 × 844, CPU a 4× y red localhost sin throttling. Guarda LCP y CLS
por ventanas de sesión, así como muestras Event Timing si están disponibles.
El tiempo de click DOM a dos frames mide respuesta de filtros en laboratorio;
no se presenta como INP de usuarios reales. No hay datos de campo en esta fase.

## Accesibilidad verificada

La matriz ejecuta axe con etiquetas WCAG 2/2.1/2.2 A/AA en landing, metodología,
formulario y resultados. Playwright comprueba nombres y errores descritos,
teclado, foco, diálogo/Esc y retorno de foco, desplazamiento de tablas y texto
al 200 %. Los contrastes críticos de texto, controles y foco se verifican además
en los tests del HTML y la revisión visual de las capturas.

WebKit/macOS usa Option-Tab para enlaces, el atajo nativo de Safari. La prueba
permite el paso por el chrome del navegador, pero rechaza foco en controles del
fondo mientras el diálogo está abierto. Las flechas sólo desplazan una tabla
cuando su propia región tiene el foco; sus botones y Tab conservan su conducta.

Firefox 159/macOS reproducía un SIGSEGV al consultar ariaLabelledByElements en
la app. Sus cuatro contenedores usan aria-label con la misma constante que sus
títulos visibles. La suite comprueba esa equivalencia y audita normalmente los
tres motores, sin legacy, reglas desactivadas ni preferencias especiales.

El alcance de cierre acordado usa estas comprobaciones automáticas y visuales.
La revisión manual externa se retiró por solicitud del usuario y no queda como
pendiente. Los resultados no acreditan una certificación WCAG global.

## Baselines visuales

Los PNG se comparan sólo en su OS/proyecto de referencia, con el Chromium
fijado por Playwright y las mismas fuentes. Firefox y WebKit tienen recorridos
funcionales propios; sus píxeles no se comparan contra Chromium.

```bash
npm run test:visual -- --update-snapshots=none
```

Sin baseline aprobada, Playwright debe fallar y conservar el actual en
test-results. Revisar candidatos antes de incorporarlos a
`frontend/tests/e2e/__screenshots__/<platform>/<project>/`. No generar ni aceptar
snapshots masivamente para ocultar una diferencia. Una baseline de macOS no se
da por válida en Ubuntu; CI ejecuta allí los recorridos y presupuestos, mientras
la comparación de píxeles exige su entorno de referencia. Las capturas de
documentación se seleccionan después de inspección y conservan procedencia.

Los reportes, XLSX, candidatos fallidos y mediciones transitorias se conservan
como artefactos de QA/CI, no en Git. Sólo se versionan baselines aprobadas,
capturas seleccionadas y resultados documentados con su contexto.
