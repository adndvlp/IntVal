# Contribuir a IntVal

El producto es un servicio web Streamlit sobre Linux y Python 3.12. El repositorio
conserva un contrato de arranque agnóstico del alojamiento. Los comandos siguientes
son para desarrollar desde la raíz; no son instrucciones para el usuario de la web.

## Preparar y verificar

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --no-deps -r requirements-dev.txt
.venv/bin/python -m pip check
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
.venv/bin/python -m pytest
```

Las entradas de dependencias son los `.in`; los `.txt` se regeneran con pip-tools
según [development.md](docs/development.md). No incorporar paquetes del entorno
global mediante `pip freeze`. Pytest, cobertura y Ruff se configuran en
`pyproject.toml`. Los XML de pruebas y cobertura son salidas ignoradas por Git.

## TDD obligatorio

1. Escribir una prueba de comportamiento con un esperado independiente.
2. Ejecutarla y observar que falla por la capacidad ausente o el defecto concreto.
3. Implementar el cambio mínimo y comprobar que pasa.
4. Refactorizar con pruebas verdes y ejecutar las comprobaciones pertinentes.
5. Registrar comandos y resultados reales en la evidencia de la entrega y actualizar
   la SDD cuando cambien requisitos, contratos o estado.

Para un ciclo focalizado, sin el umbral global de la suite completa:

```bash
.venv/bin/python -m pytest -o addopts='' tests/ui/test_demo.py -q
```

El cierre utiliza el comando canónico completo. No añadir skips, exclusiones de
cobertura ni recalcular esperados desde la misma función para disimular fallos.
Una refactorización de comportamiento existente se protege con sus regresiones;
no requiere fabricar un fallo artificial. Documentación y capturas se revisan
manualmente por coherencia, enlaces y correspondencia con el producto.

## Datos, contratos y metodología

- Las pruebas obligatorias no consultan Yahoo: usar snapshots sintéticos o el
  contrato `ProveedorDatos`. La fixture automática bloquea accesos no preparados.
- Mantener aislados adquisición, cálculo puro, servicio, exportación y UI.
  El producto no debe importar `tests`.
- Conservar claves heredadas y orden de campos cuando el contrato lo requiera.
  Un cambio público exige versión, migración y revisión de UI, CLI y Excel.
- Un cambio económico exige documentar el motivo y actualizar metodología,
  conciliación Decimal y pruebas independientes. Un porcentaje alto de cobertura
  no justifica una fórmula financiera.
- No sobrescribir los snapshots históricos de F1 con resultados del motor actual.
  Las migraciones intencionales se declaran en pruebas y en la SDD.
- La demo procede de [data/demo](data/demo/README.md). Si cambian sus entradas,
  versionar el dataset y actualizar ejemplo, manifest, pruebas y capturas. No
  convertir datos descargados de empresas reales en supuestos datos sintéticos.

## Preparar una entrega revisable

Describir el problema y el comportamiento resultante, los comandos ejecutados y
los límites de la validación. Revisar el diff y mantener fuera de Git secretos,
credenciales, rutas personales, entornos, logs y reportes locales. Las capturas
deben provenir de la aplicación real y mostrar que los datos son sintéticos.

CI valida el repositorio en Ubuntu; registrar por separado su run y la evidencia
local. Publicar, contratar servicios o cambiar ajustes del alojamiento requiere
un encargo específico y no es un efecto automático de una contribución.
