# Corrección de CI: ruta de entrada de AppTest

Fecha: 2026-11-12. Línea base: `43d6725` (F3). Corrección puntual posterior a
F3; F4 y F5 permanecen pendientes.

## Fallo reportado y causa

El usuario compartió un run anterior de GitHub Actions con **20 failed,
250 passed** y cobertura **84.39 %**. Las pruebas de UI fallaban antes de ejecutar
la aplicación: `AppTest.from_file("app.py")` buscaba `tests/ui/app.py`.
El descenso de cobertura era consecuencia de esas pruebas que no arrancaban;
se conserva el umbral del 85 %.

La versión local inspeccionada, Streamlit 1.60.0, acepta primero un archivo
relativo al directorio de ejecución; si no existe, intenta resolverlo desde el
archivo que llama a AppTest. El código del traceback reportado resuelve siempre
las rutas relativas desde el llamador. El log compartido no identifica la versión
exacta de Streamlit instalada en ese runner.

La [documentación oficial de AppTest](https://docs.streamlit.io/develop/api-reference/app-testing/st.testing.v1.apptest)
describe las rutas relativas respecto al archivo llamador. Una ruta absoluta
evita depender de ese cambio de resolución y del directorio desde el que se
ejecuta pytest. Las dependencias de ejecución siguen abiertas; su bloqueo
integral corresponde a F4 y no forma parte de esta corrección.

## RED: regresión antes del cambio

Se añadió una prueba parametrizada en `tests/ui/test_app.py` que cambia a un
directorio temporal y exige arrancar la aplicación real del repositorio:

- Sin otro `app.py`: reproduce `FileNotFoundError` al buscar `tests/ui/app.py`.
- Con otro `app.py`: detecta la ejecución del archivo equivocado, que no contiene
  el título ni la pantalla inicial de la aplicación real.

Comando, con el entorno virtual activo:

```bash
python -m pytest -o addopts='' tests/ui/test_app.py -k arranque_encuentra -q
```

Resultado observado: **2 failed, 19 deselected**, 1.24 s. No se reemplazó AppTest
por un mock ni se simuló su resolución de archivos: falló el framework real.

## GREEN: cambio mínimo

`RUTA_APP = Path(__file__).resolve().parents[2] / "app.py"` calcula una ruta
absoluta desde la ubicación de `tests/ui/test_app.py`, sin rutas personales ni
rutas específicas de GitHub. `iniciar()` la entrega a AppTest.

Las otras dos llamadas directas a AppTest se sustituyeron por `iniciar()`: la
prueba de lote fallido y la prueba del proveedor inyectado. Así, las pruebas de
F1, F2 y F3 comparten una sola resolución de la entrada.

El mismo comando de regresión pasó: **2 passed, 19 deselected**, 0.60 s. Los dos
casos comprueban además que el arranque no consulta al proveedor de mercado.

## Verificación completa y límites

```bash
python -m pytest
```

- **315 passed**, sin skips ni xfails, en **40.54 s**.
- Cobertura combinada de líneas y ramas: **98.51 %**, umbral 85 % conservado.
- Entorno local: macOS, Python 3.12.2, Streamlit 1.60.0.
- Una advertencia de pandas corresponde a la caracterización existente de
  fechas no interpretables en CAGR.
- Sin cambios en código de producto, fórmulas, dependencias ni workflow.
- El run fallido fue reportado por el usuario. La suite local pasó; no se ejecutó
  un runner de GitHub ni se verificó aquí un nuevo run remoto exitoso.
- No se creó commit, se hizo push ni se inició F4/F5 como parte de la corrección.
