# F5: demostración y presentación del repositorio

Fecha: 2026-11-12. Línea base: `d90fc2a`, F4 completada. Método obligatorio:
**TDD**, por instrucción del usuario. Estado: **F5 completada y verificada
localmente**, incluidas las dos capturas reales revisadas y la licencia MIT
elegida por el usuario, con adndvlp como titular.

## Alcance realizado

- Proveedor local determinista con tres empresas ficticias, estados y precios
  versionados, sin imports desde tests ni fallback a Yahoo.
- Selector de fuente en la UI y valor inicial `VALORACION_DEMO=1`. Demo con el
  mismo motor, cuatro gráficas, filtros, detalle y Excel del producto.
- Limpieza de sesión al cambiar de fuente y separación de las tres cachés.
- Ejemplo público regenerable: CSV, Excel real y manifest de supuestos/versiones.
- README de portafolio, guía de contribución, descripción del dataset,
  arquitectura, desarrollo y SDD actualizados.
- Capturas reales de resumen y detalle, con procedencia y revisión visual.
- `LICENSE` MIT, atribución `Copyright (c) 2026 adndvlp`, elegido por el usuario
  y cotejado con el [texto oficial de MIT](https://opensource.org/license/mit).

Metodología `proxies-1.0`, contrato `2.0`, catálogo de mercado, snapshots de F1,
CLI de mercado y resoluciones de dependencias se conservan. No se añade backend,
infraestructura ni configuración específica de una plataforma de alojamiento.

## Línea base

```bash
.venv/bin/python -m pytest
```

Resultado antes de F5: **327 passed**, 1 warning conocido, **40.13 s**,
cobertura total con ramas **98.51 %**. El warning caracteriza fechas de CAGR no
interpretables; no se ocultó ni se modificó para mejorar este registro.

## Ciclos RED → GREEN

Cada grupo se escribió y ejecutó antes de introducir su implementación. Los
comandos focalizados sustituyen `addopts` para que el umbral global de cobertura
no confunda el fallo funcional con una ejecución parcial.

| Ciclo | Prueba y esperado independiente | RED observado | Cambio mínimo y GREEN |
| --- | --- | --- | --- |
| 01 · Proveedor y datos | `tests/integration/test_proveedor_demo.py`: catálogo, referencia, copias, períodos, CWD alternativo, datos incompletos y proxies USA 52/44/44/48, mediana 46; caso MX ×1,8 | 11 failed, 0.19 s: proveedor demo ausente | Archivos locales y `ProveedorDemo` inyectado en el servicio real: 11 passed, 0.26 s |
| 02 · UI y cachés | `tests/ui/test_demo.py`: inicio por entorno, tres casos, filtros, detalle MX, cuatro gráficas y Excel real; cambio/limpieza de fuente y configuración; mismo símbolo con precios de Mercado 40/demo 100 | 5 failed, 0.71 s: UI sin modo de demostración | Selector, activación inicial, provider en análisis/históricos, fuente en cachés y sesión: 5 passed, 3.27 s |
| 03 · Ejemplo público | `tests/integration/test_ejemplo_demo.py`: CSV, Excel y manifest, medianas USA 116.1879930510067/MX ≈209.138387491812 y ausencia del caso incompleto; cambio de tasas | 2 failed, 0.12 s: módulo del ejemplo ausente | Script que llama al servicio y exportador existentes, sin nuevas fórmulas: 2 passed, 0.45 s |

Comandos, ejecutados en cada ciclo antes y después del cambio:

```bash
.venv/bin/python -m pytest -o addopts='' tests/integration/test_proveedor_demo.py -q
.venv/bin/python -m pytest -o addopts='' tests/ui/test_demo.py -q
.venv/bin/python -m pytest -o addopts='' tests/integration/test_ejemplo_demo.py -q
```

La prueba de mutación conserva una referencia al DataFrame, lo modifica y
comprueba que la modificación ocurrió antes de pedir otro snapshot. Evita una
asignación encadenada que, por copy-on-write de pandas, no comprobaría realmente
el aislamiento. Los esperados simplificados son independientes del motor;
no se generaron snapshots nuevos para dar por correctos sus resultados.

La fixture automática existente bloquea yfinance sin preparación, sockets y DNS
de Python. Los tests demo no habilitan el proveedor real. Se usan el servicio,
cálculos, gráficas y exportador reales; no se sustituyen sus resultados completos
por mocks. El caso de caché prepara un proveedor de mercado sintético para poder
detectar una mezcla con los datos de demostración.

## Verificación final local

```bash
.venv/bin/python -m pip check
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
.venv/bin/python -m pytest
.venv/bin/python -m examples.analisis_demo --output examples/demo
```

- Dependencias: sin requisitos rotos. Pip informa de que su caché de usuario no
  es escribible; la comprobación termina correctamente.
- Ruff: sin incidencias; **73 archivos** con formato correcto.
- Suite completa: **345 passed**, cero skips/xfails, 1 warning previo,
  **49.63 s**, cobertura combinada de líneas y ramas **98.59 %**. El nuevo
  proveedor alcanza 100 %; el umbral global sigue en 85 % y no se excluye código.
- Generación fuera de pytest: tres casos exportados con dependencias de producto.
- Libro público reabierto con openpyxl: siete hojas y las tres medianas/ausencias
  conciliadas con el CSV. Metadatos de creador genéricos (`openpyxl`), sin rutas
  personales ni patrones de credenciales en sus XML.
- `data/universo.json`, `tests/fixtures/resultados_f1.json` y
  `docs/methodology.md` idénticos byte a byte a la línea base. Los tests vigentes
  siguen comprobando prefijos compatibles y contrato 24/73 campos.
- Revisión de enlaces locales, diff, artefactos y material de portafolio. Los
  resultados XML/JUnit y logs de ejecución permanecen fuera del versionado.
  Se retiró una ruta personal conservada en el texto histórico de la SDD;
  el material de entrega se revisó también buscando credenciales y rutas privadas.

Una primera ejecución completa se interrumpió por falta de espacio en disco
(`OSError: [Errno 28]`), antes del cierre. Se eliminaron únicamente dos entornos
temporales y una copia de ruedas creados durante la validación previa de F4;
el entorno del proyecto y los archivos del usuario se conservaron. Tras recuperar
espacio, la suite de proveedor/UI pasó con 343 pruebas; después se incorporaron
las dos pruebas del ejemplo y se obtuvo el cierre de 345 anterior. El fallo de
infraestructura no se presenta como un ciclo RED de comportamiento.

## CI y evidencia visual

Se consultó el repositorio real `adndvlp/IntVal`: el
[run Tests #5](https://github.com/adndvlp/IntVal/actions/runs/43363574654),
SHA `d90fc2aab0b99b662054f10f849cf9b008df65fa`, evento push, terminó con
`status=completed` y `conclusion=success` en Ubuntu. Es evidencia de F4 y de las
fases incluidas en ese commit. No acredita los cambios actuales de F5, todavía
sin commit/push. La insignia del README apunta al workflow existente.

La política de esta sesión impide abrir el socket del servidor y el navegador
Chrome termina al arrancar mediante Playwright. AppTest comprueba el flujo, pero
no genera evidencia visual de navegador. Se preparó un script temporal que el
usuario puede ejecutar fuera de esa restricción: abre una instancia sólo en
localhost con demo, toma resumen/detalle, registra referencia/viewport y cierra
sus propios procesos. No se versionan rutas personales ni esa dependencia de
herramientas de captura.

El usuario ejecutó ese script y obtuvo las primeras imágenes el
2026-11-13T04:48:50.257Z, sin errores de navegador. La revisión visual aceptó
el resumen y detectó que el detalle no mostraba las gráficas. Se corrigió el
encuadre y el usuario repitió el proceso. Las imágenes finales y su manifest
tienen fecha **2026-11-13T04:55:44.765Z** y se inspeccionaron ambas:

- **Resumen aceptado** e integrado en README: muestra el aviso sintético,
  referencia 2025-01-03, tres casos y valores concordantes con el ejemplo público,
  filtros, supuestos y descarga. JPEG 1920 × 1080, sin EXIF ni comentarios.
- **Detalle aceptado**: muestra DEMO-MX.MX, precio 200 MXN, mediana 209,14 MXN,
  objetivo ficticio 240 MXN, cuatro proxies y las cuatro gráficas completas.
  JPEG 1920 × 1800, con fuente sintética y referencia en la barra lateral,
  sin EXIF, comentarios ni contenido privado. El script corregido fuerza el
  desplazamiento y verifica las cuatro gráficas dentro de la imagen antes de
  guardar. La captura anterior rechazada se sustituyó, no se publica como válida.

El helper comprobó el health check y el flujo web real de la instancia local
cuando el usuario lo ejecutó fuera de la restricción de esta sesión. Eso no
equivale a validar una URL pública. Procedencia y revisión en
[images/README.md](images/README.md) y `images/captura-demo.json`.

No se fabricaron imágenes ni se publicó una URL. Capturar la instancia local
no certificaría un despliegue en PaaS.

## Cierre y continuidad

**F5-R01 a F5-R08 completados.** El usuario confirmó al dueño del repositorio
como titular; se verificó `adndvlp` en `adndvlp/IntVal` y posteriormente eligió
MIT. Se añadió el texto estándar con atribución a adndvlp en `LICENSE` y se
enlazó desde README. Las capturas finales, su procedencia, los enlaces y el
estado de fases se revisaron y actualizaron conjuntamente.

El cierre de capturas/licencia sólo cambia documentos y artefactos; no altera
el software validado por las **345 pruebas y 98.59 %** de cobertura anteriores.
Se comprueban enlaces, metadatos, texto de licencia y diff, sin repetir la suite
por estos cambios documentales. Una corrección posterior de software debe
seguir TDD y ejecutar los checks pertinentes.

F1 a F5 están completadas dentro del alcance del repositorio. El CI del commit
de F5 se comprobará cuando se publique; el despliegue y la validación de una URL
pública son encargos separados. No se hizo commit, push ni despliegue automático.
Véase 21.11 de la [SDD](SDD.md) para continuar sin el historial de la conversación.
