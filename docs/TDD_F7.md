# F7 — Sistema visual y landing

Fecha: 2026-11-13. Línea base: `fd47e78`, F6 implementada, árbol limpio.
Alcance: únicamente F7 de [SDD_WEB.md](SDD_WEB.md), sección 18.2.

## Requisitos y decisiones

| Requisito | Implementación |
| --- | --- |
| F7-R01 | Tokens marfil/verde, tipografía editorial, enlaces/botones y estados compartidos; HTML nativo |
| F7-R02 | Landing completa, metodología pública y 404 útil; footer, autoría y enlaces reales |
| F7-R03 | Hero con tabla y barras de DEMO-USA, conciliado con CSV/manifest de `examples/demo` |
| F7-R04 | CTA a shell existente con `fuente=demo|market`; HTML legible y navegación sin JS |
| F7-R05 | Cuatro anchos, teclado, texto ampliado, contraste y movimiento reducido |
| F7-R06 | Capturas reales y presupuesto de recursos del build; revisión visual por separado |
| F7-R07 | Este registro y continuidad en ambas SDD; análisis HTTP y dashboard siguen pendientes |

La landing presenta las capacidades existentes de Streamlit. Explica que la
nueva experiencia web está en preparación. No publica una demo de análisis
React terminada ni activa consultas de mercado al visitar la página.

Dirección visual: fondo marfil, titulares serif, cuerpo sans, cifras
monoespaciadas, panel oscuro para el ejemplo y secciones editoriales con ritmos
distintos. Se usan fuentes del sistema en lugar de instalar Manrope: sin
descargas, archivos de licencia nuevos ni dependencia del servicio de fuentes.
La propuesta tipográfica de la SDD era revisable; esta elección mantiene la
personalidad y reduce la carga inicial. No se implementa modo oscuro.

Se crean sólo las primitivas usadas: acción de navegación y flecha SVG decorativa,
tokens y estilos de superficies/estados. Inputs, tabs, drawers y gráficas del
dashboard corresponden a F9; no se instalan componentes sin uso.

## RED → GREEN

La base Vitest de F6 se ejecutó antes de cambiar el producto: 12 pruebas verdes.
Los incrementos Python usan `-o addopts=''` para que el umbral de cobertura de
la suite completa no oculte el fallo de comportamiento.

| Ciclo | RED observado | Implementación / GREEN |
| --- | --- | --- |
| 01 | Dos pruebas de `test_demo_web.py` fallan por ausencia del exportador del derivado | Exportador stdlib sin motor/red y JSON versionado; dos pruebas verdes |
| 02 | Tres pruebas de HTML fallan por narrativa ausente y rutas de metodología/404 inexistentes | Landing, layout, tabla, metodología, 404, metadatos y estilos; cinco pruebas HTML verdes, incluidas las dos heredadas |
| 03 | La prueba CI exige comprobar el derivado antes del build y falla | `web.yml` ejecuta `python -m examples.exportar_demo_web --check`; prueba verde |

Registros temporales: `/tmp/valoracion-f7-01-red.log`, `01-green`, `02-red`,
`02-green`, `03-red` y `03-green`. Las pruebas versionadas permiten reproducir
los comportamientos; esos logs no son dependencias del proyecto.

## Ejemplo y límites de contenido

El JSON pequeño se genera con `python -m examples.exportar_demo_web` leyendo
el CSV y manifest públicos. El build Astro sólo importa ese JSON, nunca calcula
valoraciones ni consulta Yahoo. Las pruebas comparan cada importe del derivado
con la columna correspondiente del CSV y verifican referencia/configuración.

El hero muestra precio 100.00 USD, FCL 112.02, NOPAT 117.87, EBITDA ajustado
117.87, utilidad neta 114.51 y mediana 116.19; brecha +16.2 %. Las cifras
subyacentes conservan su precisión original. Etiqueta visible de datos
sintéticos, referencia 2025-01-03, origen y aviso de que no es rentabilidad.
Los anchos de barras son únicamente una escala visual de esos importes.

La metodología pública resume `docs/methodology.md`: cuatro bases, reinversión
y capital de trabajo ausentes, deuda conciliable, tasas manuales, múltiplos,+mediana de valores disponibles, exclusión de financieras/REIT/FIBRA y carácter
exploratorio. Enlaza la referencia completa. No modifica fórmulas, terminología
del documento original, contrato financiero ni estados del motor.

## Herramientas y verificación

Se conserva la resolución de Node/npm y dependencias de F6. No hay librerías
nuevas, polifills, imágenes generadas, Recharts ni JavaScript de dashboard en
la landing. Las páginas de presentación no hidratan React.

Checks: Ruff, ESLint, Prettier, Astro check, pytest, Vitest, HTML del build,
derivado reproducible y navegador contra FastAPI real. La suite E2E conserva
las pruebas de conexión y de HTML sin JS de F6 y añade cuatro anchos, contraste
de combinaciones críticas, movimiento reducido y texto al 200 %.

El primer intento de navegador del agente terminó con EPERM al escuchar en
127.0.0.1, antes de cargar el sitio. Se preparó una ejecución corta para la
terminal del usuario; el comando versionado equivalente es `npm run capture`
desde `frontend/` (con `PLAYWRIGHT_CHANNEL=chrome` si se usa Chrome instalado).
Sólo copia capturas de documentación después de que todos los E2E pasen.

La primera suite Python tuvo un fallo al escribir un temporal Excel por
`OSError: [Errno 28] No space left on device`; 395 pruebas sí pasaron. La prueba
afectada pasó al repetirla aisladamente. Se eliminó exclusivamente el caché
temporal npm preparado para el proyecto (593 MiB), conservando herramientas,
entorno Python y archivos del usuario. Se repite la suite completa con espacio.

### Resultado de cierre

| Comprobación | Resultado observado |
| --- | --- |
| Python completo tras liberar espacio | **396 passed**, 2 warnings, **97.90 %**, 56.79 s |
| Vitest | **12 passed**, 100 % líneas y 88.23 % ramas del cliente/componente |
| HTML compilado | **5 passed** |
| Astro check | Sin errores, warnings ni hints |
| Ruff / ESLint / Prettier | Correctos |
| Derivado demo | Reproducible y conciliado; check correcto |
| JS inicial de landing | **0 archivos**; no islas React |
| CSS inicial | **4741 bytes gzip**, inferior a 50 KiB |
| HTML inicial | 3676 bytes gzip en la medición previa al ajuste final de texto |
| Fuentes web / imágenes raster del hero | **0 / 0** |
| Navegador, contraste real y capturas | **Pendientes** de la ejecución preparada |

Los tamaños provienen del build de producción de esta edición; son tamaños de
recursos, no mediciones de LCP/CLS/INP. No se afirman métricas de campo ni una
auditoría WCAG completa. El registro final Python está en
`/tmp/valoracion-f7-python-final.log`; presupuesto en
`/tmp/valoracion-f7-presupuesto.json`. La ejecución directa de Chrome también
está restringida dentro de la sesión. Sigue pendiente ejecutar en la terminal
permitida y revisar las imágenes antes de cerrar F7:

```bash
.venv/bin/python /tmp/f7.py
```

Alternativa versionada: `PLAYWRIGHT_CHANNEL=chrome npm run capture` desde
`frontend/`, con Node/npm de F6 en PATH y Python preparado. El script temporal
no es una dependencia del proyecto. El navegador prueba el build y la API real;
no se sustituyen por respuestas simuladas para sortear el bloqueo.

F7 está implementada, pero **su validación visual y cierre están pendientes**.
La imagen OG raster se generará junto a las capturas al pasar el navegador.
El CI remoto del commit que se publique y una URL desplegada no están acreditados.

## Guías aplicadas

Se consultó Modern Web Guidance antes de escribir la interfaz: búsqueda de
layout adaptable y recuperación de responsive-design, typography y color.
Una segunda búsqueda de texto encontró un índice ausente en el paquete CLI;
las guías recuperadas y la referencia local sí estaban disponibles.

Se aplican tamaños tipográficos con rem y clamp limitado, contenedores fluidos,
container query del panel con adaptación básica por viewport, altura libre de
textos, líneas de lectura acotadas, foco visible, semántica de tabla y colores
de sistema para forced-colors. No hay contenido que dependa de una animación.
El esquema claro completo sigue la decisión explícita de la SDD.

La guía Sites se usa en modo de repositorio local: progresión editorial,
ejemplos concretos, afirmaciones verificables y revisión del build real.
No se registra ni publica un sitio externo.

## Continuidad

F8 es la fase posterior: API de análisis, trabajos, cachés, históricos y Excel.
No se ha implementado dentro de esta entrega. La publicación del conjunto
requiere integrar el análisis de F9 y completar las fases de calidad/distribución.
El arranque de producción permanece en Streamlit.
