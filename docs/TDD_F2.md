# Evidencia de TDD — F2

Línea base: commit `b9852e6`, F1 completa. Antes de cambiar código se ejecutó
`python -m pytest`: **215 passed**, cobertura combinada **98.04 %**, 30.32 s.

F2 reorganiza responsabilidades sin cambiar fórmulas, columnas, universos ni
comandos de entrada. Se reutiliza la suite verde para la refactorización y se
ejecuta RED → GREEN para contratos nuevos: módulos puros, catálogo validado y
servicio con proveedor inyectado. Las caracterizaciones que ya pasan se registran
como tales y no se alteran artificialmente para provocar fallos.

Los comandos parciales usan `-o addopts=''`; la verificación final utiliza el
comando canónico con cobertura de toda la implementación, incluido el paquete nuevo.

## Registro de ciclos

Los resultados se añaden después de ejecutarlos. No se ha iniciado F3, F4 ni F5.

### Ciclo 01 — Núcleo puro y compatibilidad

- Pruebas antes de extraer: `test_arquitectura.py` y `test_compatibilidad_f1.py`.
- RED: `python -m pytest -o addopts='' tests/unit/test_arquitectura.py tests/integration/test_compatibilidad_f1.py -q`.
- Resultado: **5 failed, 2 passed**. Faltaban los módulos puros; la API y el hash
  del catálogo pasaban como caracterización de F1.
- Cambio: extracción mecánica de configuración, normalización, cálculos y columnas
  compartidas; sin editar los cuerpos de las fórmulas.
- GREEN: `python -m pytest -o addopts='' tests/unit tests/integration -q`,
  **203 passed**, 2.08 s.

### Ciclo 02 — Catálogo local validado

- RED: `python -m pytest -o addopts='' tests/unit/test_universo.py -q`,
  **24 failed** por ausencia del módulo de catálogo.
- Cambio: extraer a JSON las listas y fuentes de F1, añadir metadatos honestos
  del snapshot y validar versión, fechas, mercados, símbolos y duplicados.
- GREEN: `python -m pytest -o addopts='' tests/unit/test_universo.py tests/unit/test_arquitectura.py tests/integration/test_compatibilidad_f1.py -q`,
  **31 passed**, 0.09 s. El hash de símbolos, orden y fuentes se mantiene.

### Ciclo 03 — Proveedor inyectado y modelos compartidos

- Antes de modificar el servicio se capturaron ocho resultados completos del
  motor original de F1, conservado desde `b9852e6`. Los snapshots son
  caracterizaciones; no sustituyen los oráculos numéricos independientes de F1.
- RED: `python -m pytest -o addopts='' tests/integration/test_servicio_inyectado.py -q`,
  **14 failed** por ausencia de servicio, modelos y adaptador.
- Cambio: introducir `DatosEmpresa`, `ResultadoAnalisis`, `Diagnostico`, protocolo
  `ProveedorDatos`, adaptador Yahoo y cálculo puro sobre snapshots. Preparación
  de históricos y análisis usan el mismo contrato. Se verifica también la
  inyección de factory y aislamiento de caché FX entre proveedores.
- GREEN: `python -m pytest -o addopts='' tests/integration/test_servicio_inyectado.py tests/unit/test_arquitectura.py -q`,
  **19 passed**, 0.17 s.

### Ciclo 04 — Entradas, Excel, presentación y cobertura

- RED: `python -m pytest -o addopts='' tests/unit/test_arquitectura.py tests/ui/test_proveedor_inyectado.py tests/integration/test_entrada_heredada.py -q`.
- Resultado: **6 failed, 6 passed**. La UI seguía importando Yahoo y el monolito;
  faltaban CLI/Excel separados, la fachada no delegaba y la cobertura no incluía
  el paquete nuevo. La UI aún no consumía el proveedor de dominio inyectado.
- Cambio: extraer CLI, Excel, formatos y gráfica; dejar una fachada de reexports;
  cambiar la UI a llamadas de servicio con sus cachés; medir todo `valoracion`.
  Se migraron los parches de F1 a los módulos propietarios sin cambiar esperados.
- GREEN: `python -m pytest -o addopts='' tests -q`, **267 passed**, 16.83 s.

### Ciclo 05 — Compatibilidad de estados `None`

- Riesgo encontrado al revisar el límite entre proveedor y snapshot: F1 admitía
  estados `None`, pero el nuevo constructor recibía ese valor sin normalizarlo.
- RED: `python -m pytest -o addopts='' tests/integration/test_servicio_inyectado.py -k estados_nulos -q`.
- Resultado: **3 failed** con `AttributeError: 'NoneType' object has no attribute 'copy'`.
- Cambio mínimo: el adaptador convierte estados `None` en DataFrames vacíos.
  Se conservan las decisiones anteriores de cálculo y los resultados de F1.
- GREEN: `python -m pytest -o addopts='' tests/integration/test_servicio_inyectado.py tests/integration/test_proveedor_yahoo_simulado.py -q`,
  **60 passed**, 0.24 s.

## Verificación final

- Comando canónico: `python -m pytest`.
- Resultado: **270 passed**, cero fallos, cero skips y cero xfails, **32.30 s**.
- Cobertura combinada de líneas y ramas: **98.49 %** sobre entradas y paquete,
  con umbral del 85 % y sin exclusiones del código movido.
- `python -m pip check`: sin requisitos rotos.
- Análisis de imports: 16 módulos, 23 dependencias internas, sin ciclos y sin
  imports de `motor_valoracion` desde el paquete.
- Comparación por AST con `git show b9852e6:motor_valoracion.py`: 21 funciones o
  clases extraídas son idénticas, incluidos los helpers de cálculo, configuración,
  normalización, constructor de errores, CLI y exportador Excel.
- Se verificaron los 101 IDs y funciones de la matriz de F1, los enlaces de la
  documentación y `git diff --check`.
- Cálculo puro ejecutado fuera de pytest: `(1200, 200, 1000)`, sin fixtures ni
  parches de proveedor.
- La única advertencia es la caracterización de fechas no interpretables del
  fallback de CAGR ya presente en F1.
- No se publicaron cambios ni se ejecutó un runner remoto. F3 a F5 pendientes.
