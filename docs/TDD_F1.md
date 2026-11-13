# Evidencia de TDD — F1

F1 se implementa por requisito explícito del usuario mediante TDD: escribir primero
la prueba, ejecutarla y comprobar la causa de fallo (RED), realizar el cambio mínimo
de producto (GREEN), y limpiar el código conservando las pruebas (REFACTOR).

Las pruebas de caracterización de comportamiento ya existente pueden pasar en su
primera ejecución: se registran como tales y no justifican un cambio de producto.
No se introducen defectos deliberados para forzar un RED artificial.

Cada cambio de comportamiento debe estar precedido por una regresión fallida.
La primera infraestructura de pytest es soporte de ejecución, no una corrección
anticipada de la aplicación. Los comandos parciales usan `-o addopts=''` para no
confundir el RED funcional con el umbral global de una suite todavía incompleta.

## Registro

La evidencia de cada ciclo se añade después de ejecutarlo, con comandos,
causas observadas y resultados reales. La suite final se ejecuta con el comando
canónico `python -m pytest`, con cobertura de ramas y umbral del 85 %.

### Ciclo 01 — Esquema de errores y vacíos

- RED: `python -m pytest -o addopts='' tests/integration/test_excel.py tests/ui/test_app.py -q`.
- Resultado observado: 3 fallos; `KeyError: 'Upside mediana'`, encabezados vacíos y `AttributeError` al llamar `.dropna()` sobre un escalar.
- Cambio mínimo: columnas compartidas, normalización de tablas, resultado de error completo, conservación de filas sin upside y diagnóstico localizado que evita consultar históricos de una empresa fallida.
- GREEN: el mismo comando, **3 passed**, 0.91 s.
- Ajuste de infraestructura: sustituir `time.sleep` global impedía coordinar hilos de AppTest. Se sustituyó sólo la referencia `motor.time`; no se alteró código de producto para corregir el harness.

### Ciclo 02 — Configuración y números finitos

- RED: `python -m pytest -o addopts='' -o faulthandler_timeout=10 tests/ui/test_app.py tests/unit -q`.
- Resultado: 66 pruebas de caracterización pasaron y 40 casos numéricos/configuración fallaron por falta de validación, propagación de no finitos, horizonte inválido o desbordamiento. Hubo además un timeout del harness de UI, resuelto como se explica en el ciclo 01.
- Cambio mínimo: validar configuración y horizonte, descartar infinitos en normalización y devolver ausencia ante parámetros/resultados numéricos no finitos o desbordamientos. Las expresiones financieras válidas se conservan.
- GREEN: `python -m pytest -o addopts='' tests/unit tests/integration/test_excel.py tests/ui/test_app.py -q`, **109 passed**, 1.03 s.

### Ciclo 03 — Adquisición e integración del motor

- Pruebas escritas antes de modificar el fallback de precio: `tests/integration/test_proveedor_yahoo_simulado.py` y `test_analizar_ticker.py`.
- Los primeros resultados señalaron dos defectos del propio harness: igualdad exacta de un flotante y asignación de infinito a un DataFrame entero. Se corrigieron los tests usando tolerancia y un dtype explícito, sin modificar el producto por esas causas.
- RED depurado: dos fallos por aceptar cierres históricos de cero y negativos como precio de mercado válido. El resto caracteriza prioridades, fallbacks, FX, sectores y el cálculo completo del motor con números independientes.
- Cambio mínimo: exigir precio histórico positivo y finito, igual que en la vía de fast_info.
- GREEN: integración incluida en `python -m pytest -o addopts='' tests -q`: **197 passed**, 11.03 s (ciclos 03 y 04).

### Ciclo 04 — Interfaz, sesión y límites de I/O

- RED: `python -m pytest -o addopts='' tests/ui tests/unit/test_presentacion.py -q`.
- Resultado: **5 failed, 21 passed**. Causas: error y esquema malformado del histórico, fallo al adquirir estados del detalle, fallo de escritura del Excel y selección de una fila inexistente en un análisis vacío.
- Cambio mínimo: aislar esos límites de I/O, conservar resumen/resultados y evitar seleccionar una empresa cuando no hay filas. No se captura toda la aplicación bajo un único except.
- GREEN: `python -m pytest -o addopts='' tests -q`: **197 passed**, 11.03 s (incluye regresiones y caracterizaciones anteriores).

### Ciclo 05 — Libro real, CLI y cachés

- RED: `python -m pytest -o addopts='' tests/integration/test_cli.py tests/integration/test_cache.py tests/integration/test_excel.py -q`.
- Resultado: **2 failed, 15 passed**. CLI, cachés y formato del libro pasaron como caracterización; el exportador escribió `inf` y `-inf` como texto en celdas financieras.
- Cambio mínimo: convertir no finitos a ausencias antes de escribir las tablas. Se conservan valores, tipos y formato de las demás celdas.
- GREEN: el mismo conjunto, **17 passed**, 1.81 s.

### Ciclo 06 — Contrato de automatización

- Prueba primero: `tests/integration/test_ci.py`, que valida eventos, comando canónico, permisos de lectura, Python, acciones fijadas y conservación de reportes.
- RED: `python -m pytest -o addopts='' tests/integration/test_ci.py -q`, **1 failed** por `FileNotFoundError` antes de crear el workflow.
- Soporte: PyYAML permite inspeccionar el workflow como estructura YAML; no es una dependencia de ejecución del producto.
- GREEN: `python -m pytest -q --tb=short --show-capture=no`, **215 passed**, 28.00 s; cobertura total con ramas **97.96 %**, sin exclusiones de código.
- Las referencias de las acciones oficiales se verificaron contra los commits de sus releases antes de fijarlas por SHA.

### Refactorización con la suite en verde

Después del checkpoint de 215 pruebas verdes se reutiliza el constructor de error
en la CLI y se elimina una comprobación redundante de columna en la UI: el esquema
ya garantiza su presencia. No se mueven responsabilidades a paquetes ni se inicia F2.
Verificación posterior: `python -m pytest -o addopts='' tests/integration/test_cli.py tests/integration/test_cache.py tests/ui -q`, **29 passed**, 11.70 s.

## Verificación final

- Comando canónico: `python -m pytest`.
- Resultado: **215 passed**, cero fallos, cero skips y cero xfails, en **28.58 s**.
- Cobertura total combinada de líneas y ramas: **98.04 %**; umbral exigido: 85 %.
- Por archivo: `app.py` 97.61 %, `motor_valoracion.py` 98.20 %.
- `python -m pip check`: sin requisitos rotos.
- Una advertencia de pandas al probar índices deliberadamente no interpretables;
  corresponde a la caracterización del fallback de CAGR.
- `coverage.xml`, `test-results.xml`, `.coverage` y `.pytest_cache` se generan
  localmente y permanecen ignorados por Git.
- La matriz relaciona los 101 IDs de la SDD con funciones existentes de la suite.
  Se verificaron además contratos de 19/45 columnas, enlaces y `git diff --check`.
- Entorno: macOS, Python 3.12.2. No se ejecutó una instalación limpia en Linux ni
  un runner de GitHub en esta sesión. El workflow queda listo para la primera
  ejecución remota después de publicar los cambios.
- F2, F3, F4 y F5 permanecen pendientes.

Referencias verificadas para las acciones fijadas en CI:

- [checkout v7.0.1](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1).
- [setup-python v7.1.0](https://github.com/actions/setup-python/commit/6d4fd22b20465ccc0f7354476588e8df7c9ca0e0).
- [upload-artifact v7.0.2](https://github.com/actions/upload-artifact/commit/cf430e030ddbb5b0abf93d22962f4752f3646cd9).
