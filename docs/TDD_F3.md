# TDD — F3: metodología y trazabilidad

Línea base: `81ed7fb` (F2). Antes de cambiar el producto:
`python -m pytest`, **270 passed**, cobertura con ramas **98.49 %**, 31.41 s.

F3 modifica políticas económicas de forma deliberada. Los snapshots de F1 se
conservan; no se regeneran para ocultar diferencias. Cada cambio se justifica en
`docs/methodology.md` y comienza con pruebas que deben fallar en F2.

Decisiones de alcance: mantener las cuatro fórmulas como proxies explícitos,
separar descuento de accionista/empresa, bloquear FX no verificable, distinguir
balance desconocido de cero y excluir sectores sin modelo implementado. La
mediana resume únicamente proxies disponibles y aplicables; no mide consenso
independiente ni probabilidad de rentabilidad.

## Ciclos

Los resultados RED/GREEN se registran después de ejecutarlos. F4 y F5 no se inician.

### Ciclo 01 — Políticas económicas explícitas

- RED: `python -m pytest -o addopts='' tests/integration/test_metodologia.py -q`:
  **21 failed, 2 passed**. Fallos por FX no verificado aceptado, balance rellenado
  con cero, ausencia de aplicabilidad/conteo/versiones y tasa de empresa inexistente.
- Cambio: políticas versionadas `proxies-1.0`, contrato `2.0`, exclusión de sectores
  sin modelo, ausencia distinta de cero y tasas independientes. Los nombres de
  las primeras columnas se conservan como claves de compatibilidad.
- El esperado de la tasa independiente se revisó con Decimal antes de comprobar
  el resultado: `(510.653643876784... - 200) / 10 = 31.065364387678...`.
- GREEN: el mismo conjunto, **23 passed**, 0.20 s.

### Ciclo 02 — Procedencia, fechas y períodos

- RED: `python -m pytest -o addopts='' tests/integration/test_trazabilidad.py -q`:
  **8 failed**. Faltaban metadata de adquisición, fuente/estadístico del objetivo,
  fecha real de precio/FX, períodos efectivos, configuración y política de balance
  con fechas distintas; se infería moneda financiera ausente.
- Cambio: `TrazabilidadDatos` desde el adaptador; fecha de descarga separada de
  fecha de mercado, FX cacheado con metadata original y monedas sin inferir USD.
  Selección de períodos compartida con los márgenes y conciliación de balance
  condicionada a fechas. Datos manuales sin fuente no se atribuyen a Yahoo.
- GREEN: metodología más trazabilidad, **31 passed**, 0.29 s.

### Ciclo 03 — Presentación y exportación coherentes

- RED: `python -m pytest -o addopts='' tests/integration/test_presentacion_metodologia.py tests/ui/test_metodologia_ui.py -q`:
  **5 failed**, 1.19 s. Se observaban EBIT y «valor intrínseco» como etiquetas,
  faltaban tasas separadas/metadata en Excel y controles/diagnóstico en UI.
- Cambio: mapa central de etiquetas, NOPAT y EBITDA bruto en márgenes históricos,
  proxies en gráfica/UI/Excel, mediana con cantidad de participantes, supuestos y
  versiones en el libro; tasa de empresa independiente en la UI.
- Se corrigió una comparación exacta de floats en dos pruebas nuevas: 52 puede
  representarse como 52.000000000000014 y openpyxl puede redondear el último bit.
  Se aplicó `pytest.approx`; no se modificaron importes esperados ni producto para
  igualar detalles de representación.
- GREEN: los cinco casos pasan en la ejecución de 16 pruebas del ciclo 05 y en
  la suite canónica final. La revisión intermedia tenía **3 passed y 2 failed**
  únicamente por las comparaciones exactas descritas.

### Ciclo 04 — Ejemplo independiente y público

- RED: `python -m pytest -o addopts='' tests/integration/test_ejemplo_independiente.py -q`:
  **2 failed**, 0.12 s, por ausencia del módulo de ejemplo.
- Cambio: CSV de entrada ficticio, tabla de pasos/esperados manuales y oráculo
  `Decimal` que usa una anualidad cerrada, sin funciones del producto para formar
  esperados ni fixtures de pytest. Después ejecuta el motor y compara por acción;
  exporta CSV y Excel real. Incluye comprobación de tasa de empresa diferente.
- GREEN: **2 passed**, 0.36 s. Resultados 52/44/44/48, mediana 46; proxy NOPAT con
  tasa de empresa 10 % y accionista 0 %: 31.06536438767844.
- Ejecución independiente, fuera de pytest:
  `python -m examples.valoracion_independiente --output /tmp/valoracion-f3-ejemplo`.
  Salida exitosa: cuatro proxies conciliados, mediana 46.00 USD; generó CSV y
  Excel. La ruta `/tmp` es evidencia de sesión, no un archivo requerido del repo.

### Ciclo 05 — Afinar fuente efectiva y errores

- RED: las once pruebas de trazabilidad dieron **3 failed, 8 passed**, 0.24 s.
  Los nuevos casos detectaron fuentes genéricas incorrectas al usar aliases
  contables, falta de procedencia de acciones calculadas desde capitalización y
  ausencia de versiones en detalle de errores.
- Cambio: conservar el alias efectivamente leído y distinguir fórmula derivada;
  ruta/fecha de acciones cuando se conocen; versiones también para errores.
- GREEN: trazabilidad, presentación/exportación y UI, **16 passed**, 1.72 s.

## Migración deliberada de las pruebas existentes

El primer barrido completo después de incorporar trazabilidad detectó diferencias
previstas frente al contrato/economía anterior. Se migraron pruebas, sin regenerar
`tests/fixtures/resultados_f1.json`:

- FX ausente ya no equivale a uno; monedas vacías no definen identidad. Se añaden
  casos explícitos de moneda ausente sin consultas de mercado.
- Financiera: ninguno de los cuatro proxies entra en mediana. Desaparece la nota
  que sugería priorizar utilidad neta sin un modelo sectorial.
- Balance ausente sin fallbacks: se mantienen FCL/neto, mediana 50 y `REVISAR` en
  el escenario simple; la antigua mediana 58 presuponía deuda neta cero.
- Columnas nuevas se agregan al prefijo de claves original. Excel y UI usan las
  etiquetas visibles, con formato monetario/porcentual conservado.
- Los ocho snapshots siguen comparando todos sus campos heredados. La función
  `migrar_referencia_f3` transforma únicamente las expectativas documentadas por
  caso (incluidas notas, ausencias y fuentes); los metadatos nuevos se verifican
  en las pruebas específicas.
- Las etiquetas históricas de margen pasan de EBIT a NOPAT y de EBITDA a EBITDA
  bruto, reflejando las métricas ya calculadas.

Las respuestas a MET-01 a MET-12 y los efectos de cada decisión están en
[methodology.md](methodology.md). El método sigue siendo heurístico, con
restricciones explícitas; no se han sustituido las fórmulas por un FCFF/FCFE
completo ni se ha afirmado capacidad predictiva.

## Verificación de cierre

- `python -m pytest`: **313 passed**, cero skips/xfails, **37.78 s**.
- Cobertura combinada de líneas y ramas: **98.51 %**, con umbral 85 % sobre
  `app`, `motor_valoracion` y todo `valoracion`, incluidos los módulos nuevos.
- La advertencia de pandas proviene del índice deliberadamente inválido de la
  caracterización de CAGR; no corresponde a una descarga ni a un fallo nuevo.
- Libro de siete hojas reabierto y comprobado en tests; trazas, tasas, versiones,
  períodos y etiquetas verificadas. Contrato: 24 campos principales, 73 detalle,
  prefijos originales de 19/45 claves conservados.
- Los reportes `.coverage`, `coverage.xml` y `test-results.xml` permanecen ignorados.
  Las salidas por defecto del ejemplo también quedan ignoradas.
- `python -m pip check`: sin requisitos rotos.
- `git diff --check`: sin errores. Diez documentos revisados sin enlaces locales
  rotos; comprobación de contratos y etiquetas sin duplicados.
- Snapshot `resultados_f1.json`, catálogo, dependencias y workflow sin cambios.
- Entorno local: macOS, Python 3.12.2, dependencias de F2. No se agregaron paquetes.
- CI remoto e instalación limpia en Linux no ejecutados en esta sesión.
- F4 y F5 permanecen pendientes. No se creó backend, commit ni despliegue.
