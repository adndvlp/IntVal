# TDD — F4: entorno reproducible y servicio web agnóstico

Fecha: 2026-11-12. Línea base: `c149bd7`, con F1 a F3 y la corrección de rutas de
AppTest. Árbol inicial limpio. Línea base ejecutada: **315 passed**, cobertura con
ramas **98.51 %**, **42.53 s**.

El contrato definitivo es un **servicio web Python/Streamlit sobre Linux,
agnóstico del proveedor de alojamiento**. El usuario accede por URL. El Mac se usa
para desarrollo/comprobaciones; la publicación se configura fuera del código.
La revisión agnóstica posterior retiró la configuración obligatoria de una
plataforma, conservando los contratos estándar de runtime y `PORT`.

## 1. Contratos de dependencias y configuración

Pruebas introducidas antes de los cambios en
`tests/integration/test_entorno_reproducible.py`: pines exactos, compatibilidad
entre ejecución/desarrollo, entradas restringidas, transitivas/marcadores,
configuración única, Python y conservación de cobertura.

```bash
python -m pytest -o addopts='' tests/integration/test_entorno_reproducible.py -q
```

- RED inicial: **7 failed**, 0.16 s. Había rangos abiertos, faltaban `.in`, Ruff y
  configuración consolidada. En esa etapa se estaban comprobando varios sistemas;
  el contrato definitivo conserva sólo el destino Linux.
- Se añadió comprobación de versiones efectivamente instaladas: **1 failed,
  7 deselected**, 0.13 s, antes de alinear el entorno con la resolución completa.
- Cambio: entradas `.in`, compilación real con pip-tools 7.6.2 y desarrollo
  restringido mediante `-c requirements.txt`; configuración en TOML y Python 3.12.
- Se retiraron `pytest.ini` y `.coveragerc`; la regresión de arquitectura de F2
  ahora lee `pyproject.toml`. Alcance completo de cobertura/ramas y 85 % conservados.
- La resolución final contiene **58 paquetes de ejecución y 71 de desarrollo**.
  Conserva las versiones de producto de F3; watchdog se incluye explícitamente
  para Linux al resolver desde el Mac. Los añadidos exclusivos de una matriz
  Windows/macOS intermedia fueron retirados.
- Los contratos pasan en la suite completa final.

## 2. Estilo y refactorización mecánica

Antes de aplicar correcciones:

```bash
python -m ruff check .
python -m ruff format --check .
```

- RED: **30 errores** de lint: 28 bloques de imports, un import sin uso y una
  asignación lambda E731. Formato: 40 archivos pendientes en ese checkpoint.
- Cambios: 29 correcciones seguras, lambda local expresada como función
  equivalente y formato mecánico. El formatter modificó 39 archivos después de
  ordenar imports y dejó 23 sin cambios en ese checkpoint.
- GREEN final: lint sin errores, **64 archivos** con formato correcto.
- Se comparó el AST de todos los módulos de producto y del ejemplo frente a HEAD,
  omitiendo imports y normalizando la lambda/función equivalente: ningún otro
  cambio. No se reescribieron las fórmulas para satisfacer el formato.
- Única excepción de lint: F401 en la fachada, por reexportaciones deliberadas.

## 3. Archivos reproducibles

Antes de corregirlos se añadieron dos regresiones reales:

- Leer el snapshot de F1 con un predeterminado de codificación cp1252 debe seguir
  conservando las claves/cifras UTF-8 del archivo versionado.
- Git debe preservar los finales de línea necesarios para código y shell.

RED: **2 failed**, 0.20 s. GREEN: **2 passed**, 0.09 s. Se explicitó UTF-8 en
lecturas de fixtures/configuración/código y se añadió `.gitattributes`. El contrato
final de atributos comprueba `app.py` e `iniciar_servicio.sh` con LF. Esto acredita
portabilidad del repositorio, no soporte de despliegue Windows.

## 4. Arranque independiente del alojamiento

Las pruebas de `tests/integration/test_servicio_web.py` comprueban el contrato
mediante un runtime temporal real de `venv` sin pip, externo al checkout. Un módulo
Streamlit mínimo registra argumentos/directorio y termina. El script no se
reemplaza por un mock y no se abre un servicio público en estas pruebas.

Se comprueban puertos 10000/9137, arranque desde otra carpeta con espacios,
propagación del código de salida 7 y error genérico cuando falta `PORT`.

En una etapa intermedia, CI y el arranque se habían implementado junto a un
manifiesto de alojamiento específico: RED **6 failed**, 0.23 s, y GREEN **6 passed**,
1.20 s. Esa configuración no pertenece al contrato definitivo.

### Revisión agnóstica solicitada por el usuario

Se introdujo primero la expectativa de una entrada genérica y de un mensaje de
error independiente del alojamiento:

```bash
python -m pytest -o addopts='' tests/integration/test_servicio_web.py -q
```

- RED observado: **4 failed**, 0.21 s, antes de existir `iniciar_servicio.sh`.
- Cambio mínimo: renombrar la entrada, quitar la referencia al proveedor del
  diagnóstico y retirar el manifiesto y su prueba exclusiva. Las opciones de
  Streamlit y los contratos de runtime/PORT permanecen.
- GREEN: servicio web más contratos de entorno, **11 passed**, 1.29 s.
- La prueba del manifiesto específico se eliminó porque ese requisito se retiró
  expresamente. No se sustituyeron valores económicos ni resultados del motor.
- README, SDD y guía de desarrollo describen preparación, arranque y health check
  genéricos. La elección/configuración del alojamiento queda fuera de la app.

## 5. Instalación limpia y compilación verificadas

La sesión no pudo descargar PyPI y su política impidió ampliar permisos. El
usuario descargó paquetes desde su terminal; se utilizaron como una fuente normal
de pip sin índice. No se copiaron paquetes instalados ni se habilitaron paquetes
globales. Ninguna ruta de esa descarga aparece como dependencia del repositorio.

Con los archivos finales se creó otro entorno,
un directorio temporal de comprobación, con
`include-system-site-packages = false`:

1. Instalar `requirements.txt` con `--no-deps`, sin índice y con la descarga como
   fuente de wheels. **pip check sin requisitos rotos**.
2. Antes de instalar desarrollo, ejecutar el ejemplo independiente: cuatro
   proxies conciliados, mediana **46.00 USD**, CSV y Excel generados sin Yahoo.
3. Instalar `requirements-dev.txt` con las mismas condiciones. **pip check, Ruff
   check y Ruff format --check pasaron**.
4. Ejecutar la suite completa con el intérprete de ese entorno limpio.

Se copiaron entradas/locks finales a una carpeta temporal y se recompilaron con
**pip-tools 7.6.2 / pip 26.3**, usando la descarga offline. Se normalizaron las
cabeceras con `CUSTOM_COMPILE_COMMAND` al comando público para no registrar rutas
locales. **Ambos archivos fueron idénticos byte por byte** tras la regeneración.
La estrategia y los comandos públicos están en [development.md](development.md).

La compilación/instalación local se hizo en macOS ARM64/Python 3.12.2. Los
marcadores de dependencias Linux están comprobados por tests; el run de Ubuntu y
las bibliotecas nativas del entorno de publicación necesitan su verificación remota.

## 6. Resultado final y límites

Desde la raíz, con el entorno de desarrollo resuelto:

```bash
.venv/bin/python -m pip check
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
.venv/bin/python -m pytest
```

La instalación limpia anterior pasó 328 pruebas antes de retirar el contrato de
manifiesto. La suite final, con la revisión agnóstica y las mismas dependencias:

- **327 passed**, cero skips/xfails, **42.01 s**.
- Cobertura combinada de líneas y ramas: **98.51 %**, umbral **85 %**.
- Una advertencia de pandas ya conocida al caracterizar fechas no interpretables.
- `bash -n iniciar_servicio.sh` y `git diff --check` sin errores.
- Catálogo, snapshots de F1 y documento de metodología intactos.
- Se intentó un arranque real de Streamlit para consultar `/_stcore/health`: llegó
  hasta el bind, bloqueado por la política local con `PermissionError: Operation
  not permitted`. No se afirma un smoke HTTP exitoso, un servidor público abierto
  ni un health check real en un alojamiento. Las pruebas de contrato de arranque sí pasan.
- CI queda en Ubuntu/Python 3.12, entorno nuevo, resolución fijada, pip check,
  Ruff y pytest. Sus runs remotos no se ejecutaron desde esta sesión.
- No se crearon recursos de alojamiento, URL pública, backend separado, VPS ni demo.
  La publicación se configura en el entorno elegido con los comandos y variables
  genéricos; no es un paso ligado a una plataforma para cerrar F4.
- F4 implementada y verificada dentro de estos límites. **F5 pendiente**.
- Sin commit, push ni publicación realizados por el agente.
