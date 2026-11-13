# F6 — Fundamentos web, contratos iniciales y CI

Fecha: 2026-11-13. Implementación local sobre `908084c` (SDD web), con F1–F5
conservadas. `temp/` era una referencia del usuario sin versionar: no se modifica.
No se hace commit, push, despliegue ni publicación como parte de esta entrega.

## Alcance y requisitos

| Requisito | Implementación / evidencia |
| --- | --- |
| F6-R01 | `frontend/`: Astro estático, React, TS estricto, Tailwind, shell `/` y `/app/`; lock y versiones exactas |
| F6-R02 | ESLint, Prettier, Astro check, Vitest/Testing Library, HTML compilado y Playwright real |
| F6-R03 | `create_app`, health/meta/catalog, ajustes por instancia, nueve supuestos editables y DTO estrictos |
| F6-R04 | JSON recursivo: escalares NumPy, ausencias pandas, fechas/instantes UTC; rechazo de no finitos y tipos no admitidos |
| F6-R05 | OpenAPI exportado desde rutas reales; tipos generados con openapi-typescript; verificadores de drift |
| F6-R06 | `web.yml` complementa `tests.yml`; instala desde lock, valida contratos y prueba navegador/API |
| F6-R07 | Esta evidencia, guía de desarrollo, arquitectura, README y continuidad en las dos SDD |

No se implementan la landing completa (F7), análisis HTTP/trabajos/cachés (F8),
dashboard (F9), auditoría integrada (F10) ni transición de arranque (F11).

## Línea base y esperados

Antes de modificar el producto, `python -m pytest` con el Python de `.venv`
terminó con **345 passed, 1 warning, 98.59 %** de cobertura combinada, en 53.50 s.
La suite bloquea red y accesos Yahoo no preparados. Los oráculos financieros y
snapshots se conservan; no se reinterpretan para acomodar el nuevo transporte.

Los esperados de F6 son independientes de respuestas de mercado: 500 símbolos
USA y 104 MX del snapshot local; tres símbolos sintéticos (dos USA, uno MX),
referencia 2025-01-03 y versión demo-1.0. Se verifica cada combinación de fuente
y mercado. Metadatos publica API 1.0, metodología proxies-1.0 y contrato
financiero 2.0; las capacidades contienen exclusivamente `catalog`.

## Ciclos RED → GREEN

Los comandos de pytest de cada incremento usan `-o addopts=''` para aislar el
fallo de comportamiento del umbral de cobertura de la suite completa.

| Ciclo | Prueba y RED observado | GREEN |
| --- | --- | --- |
| 01 | `pytest -o addopts='' tests/api/test_fundamentos.py -q`: 46 fallos por ausencia de `valoracion.web` | Se añaden factoría, DTO, ajustes, catálogos, JSON, CORS y exportador: 46 pasan |
| 02 | `pytest -o addopts='' tests/api/test_contrato_archivo.py -q`: 1 falla por contrato versionado ausente; 1 pasa para el CLI | Se exporta OpenAPI real: 48 pruebas API pasan, incluido check de archivo ausente/desactualizado |
| 03 | `npm run test:unit`: dos suites fallan al importar el cliente y componente inexistentes; el runner instalado inicia correctamente | Cliente tipado y comprobación de conexión: 12 pruebas pasan |
| 04 | Build inicial genera cero páginas; `node --test tests/shell.test.mjs` falla dos veces por ausencia de HTML | Se crean layout, páginas y CSS: dos pruebas del HTML compilado pasan |
| 05 | `pytest -o addopts='' tests/integration/test_ci_web.py -q`: falla por ausencia de `web.yml` | Se añade workflow con contratos, herramientas, build y navegador; prueba verde |
| 06 | La prueba de CI exige preparar la versión exacta de npm antes de `npm ci`; falla | Se fija npm 11.12.1 en el runner antes de instalar; prueba verde |

Registros de trabajo locales: `/tmp/valoracion-f6-01-red.log` y equivalentes
`01-green`, `02-red/green`, `03-red/green`, `04-red/green`, `05-red/green` y
`06-red/green`. Son evidencia temporal, no requisitos para ejecutar el proyecto
en otra máquina. Los casos y comandos reproducibles quedan versionados.

## Casos protegidos

- Salud/metadatos/catálogos no consultan Yahoo, incluidos modos demo y mercado
  deshabilitado. Instancias distintas leen su propio entorno.
- Consultas desconocidas, fuente/mercado inválidos, campos extra, booleanos o
  strings numéricos y supuestos fuera de rango se rechazan antes del dominio.
- La tasa de empresa inicial web es explícitamente 10 %. Metadatos muestra la
  configuración efectiva completa, incluida pausa 0.15/0; los defaults heredados
  de `Configuracion()` siguen siendo `None`/0.35.
- El adaptador conserva cero, negativos y ausencias; convierte escalares/fechas;
  rechaza NaN/Infinity anidados, claves no textuales, DataFrames, objetos y
  datetimes sin zona. No convierte datos arbitrarios a string.
- Los errores de validación usan una forma uniforme sin repetir inputs. CORS
  acepta sólo la allowlist explícita, sin credenciales ni comodín.
- OpenAPI sólo describe las tres rutas reales; se exporta idéntico desde otro
  CWD y bajo variables operativas distintas, sin paths personales.
- La vista no hace peticiones al cargar; comprueba al pulsar, impide duplicados,
  permite reintento y aborta al salir. Rechaza HTTP fallido, HTML con estado 200,
  versión/capacidades incompatibles y errores de red sin exponer detalles.
- HTML estático con idioma, título, un main/h1, navegación actual y salto al
  encabezado enfocable. Navegador real verifica teclado, navegación sin JS,
  respuesta de API real y ausencia de overflow global a 1280/390 px.

## Instalación y versiones verificadas

Las resoluciones se generaron con los gestores reales. Los locks Python conservan
los pines previos y añaden FastAPI/Pydantic y dependencias; HTTPX es de desarrollo.
Se ejecutaron pip-compile, instalación de `requirements-dev.txt` y `pip check`
sin dependencias rotas. Las regresiones verifican la coincidencia de cada pin
con el entorno. Una instalación Python nueva en Ubuntu corresponde al nuevo
workflow y aún no se ha ejecutado remotamente.

Frontend se resolvió con `npm install`, se fijaron todas las dependencias
directas a las versiones resueltas, se actualizó el lock y se hizo **`npm ci`
limpio**, correctamente. No se usó `--force` ni `--legacy-peer-deps`.

| Herramienta | Versión |
| --- | --- |
| Python local / referencia CI | 3.12.2 / 3.12 |
| Node / npm | 26.13.1 / 11.12.1 |
| Astro / integración React | 7.4.11 / 7.1.8 |
| React / react-dom | 19.3.1 / 19.3.1 |
| TypeScript | 5.9.3 |
| Tailwind / plugin Vite | 4.3.5 / 4.3.5 |
| ESLint / Prettier | 10.14.0 / 3.10.1 |
| Vitest / coverage-v8 | 5.1.0 / 5.1.0 |
| Testing Library React / user-event | 16.3.2 / 14.6.10 |
| Playwright | 1.65.0 |
| openapi-typescript | 7.13.0 |
| FastAPI / Pydantic | 0.162.5 / 2.14.3 |
| HTTPX / Uvicorn | 0.28.1 / 0.51.0 |

El manifest/locks contienen el resto de versiones exactas. Recharts, shadcn y
herramientas de tablas/datos se incorporarán cuando una fase use sus capacidades;
no se instalan componentes sin uso para anticipar el dashboard.

Incidencias reales de preparación: DNS restringido en la sesión del agente;
el usuario ejecutó la preparación en su terminal. El primer intento Python
falló por falta de espacio y se completó al recuperar espacio. npm detectó que
openapi-typescript 7.13.0 requiere TypeScript 5.x: se corrigió de 6.0.3 a 5.9.3,
con una resolución nueva válida. CI prepara npm 11.12.1 explícitamente porque
la versión incluida por Node puede ser distinta. No se alteraron herramientas
globales del usuario.

## Verificación de cierre

| Comprobación | Resultado local |
| --- | --- |
| Suite Python completa | **394 passed**, 2 warnings; **97.90 %** líneas/ramas; umbral 85 % |
| pip check | Sin dependencias rotas |
| Vitest | **12 passed**, 100 % líneas y 88.23 % ramas del cliente/componente |
| HTML compilado | **2 passed**, ambas rutas sin ejecutar scripts |
| Playwright con API real | **4 passed** en 16.0 s, escritorio/móvil, Chrome local |
| Tipos | Astro check sin errores, warnings ni hints |
| Contrato | Exportador y tipos generados reales, deterministas |

Ruff (lint/formato), ESLint, Prettier y comprobación final del diff pasan. El
registro de la suite completa está en `/tmp/valoracion-f6-suite-final.log`; frontend
en `valoracion-f6-unit-final.log`, `valoracion-f6-check-final.log` y
`valoracion-f6-e2e-real.log`. No se versionan logs, builds, reportes ni capturas
de tests. Las capturas reales `shell.png` de ambas resoluciones se revisaron:
contenido legible, navegación visible y sin recortes. Son evidencia del shell,
no del diseño completo de F7 ni de una auditoría de lector de pantalla.

La sesión del agente no puede abrir puertos locales: el primer intento E2E
terminó con EPERM antes de abrir el sitio. El usuario ejecutó el mismo runner
en su terminal. La primera ejecución detectó un `testInfo` sin declarar y un
selector de texto que omite NOSCRIPT; se corrigieron las pruebas y la siguiente
ejecución terminó con cuatro pruebas verdes. No se sustituyó la API real por
respuestas simuladas ni se retiró la comprobación de contenido sin JavaScript.

Warnings Python: permanece el aviso de fechas ambiguas de la prueba de CAGR;
Starlette añade un aviso de deprecación de HTTPX en TestClient. No son fallos
de aplicación; no se silencian ni se actualizan dependencias ajenas al alcance
para ocultarlos. El CLI exportador se prueba en subprocesos y parte de su
ejecución no se atribuye al informe de cobertura del proceso principal.

## Continuidad

F6 queda implementada y comprobada localmente. CI remoto del nuevo commit,
instalación en Linux y publicación/URL siguen sin acreditarse; los workflows
están preparados para esas comprobaciones. El arranque permanece en Streamlit.

Siguiente fase: **F7**, sistema visual y landing. Leer `SDD_WEB.md`, secciones
5–6, 8, 14, 15, 18.2 y 21.5. Mantener TDD y consultar la guía web antes de UI.
No implementar análisis de F8 ni dashboard de F9 dentro de F7. Las fórmulas,
contrato 2.0, datos, oráculos, CLI, exportador y capturas F5 permanecen intactos.
