# Despliegue agnóstico, dependencias y desarrollo

La aplicación se ejecuta como un **servicio web Python/Streamlit sobre Linux**.
El usuario accede por URL. El proveedor de alojamiento, su plan y su mecanismo
para publicar el servicio se eligen fuera de la aplicación: el repositorio no
requiere un Blueprint, una API o un manifiesto de una plataforma específica.

Las comprobaciones locales sirven para desarrollar y validar el código. La
referencia es **CPython 3.12** en `.python-version`, compartida con CI. La
verificación local usa macOS ARM64/Python 3.12.2; CI apunta a Ubuntu. La ejecución
remota de CI y la validación de una URL publicada son evidencias independientes.

## 1. Contrato de ejecución

| Requisito | Contrato |
| --- | --- |
| Runtime | Linux, Bash y CPython 3.12 |
| Preparación | `python -m pip install --no-deps -r requirements.txt` |
| Comprobar dependencias | `python -m pip check` |
| Arranque | `bash iniciar_servicio.sh` |
| Puerto | Variable de entorno `PORT`, obligatoria |
| Dirección de escucha | `0.0.0.0` |
| Health check | `/_stcore/health` |
| Comunicación | HTTP y WebSockets de Streamlit |

Configurar Python 3.12 explícitamente en el entorno elegido. `.python-version`
es la referencia del repositorio y CI; cada plataforma puede tener su propio
mecanismo para seleccionar el intérprete. No se supone que todas lean ese archivo.

La preparación instala la resolución de ejecución. Las herramientas pytest/Ruff
sólo pertenecen a desarrollo y CI. El arranque usa `python` del entorno preparado
y su `PORT`; no crea ni activa `.venv` dentro del checkout y no instala paquetes.

`iniciar_servicio.sh` ejecuta Streamlit en primer plano con `exec`, modo headless,
file watcher y telemetría opcional desactivados. Conserva señales/código de salida.
Sin `PORT`, termina con un diagnóstico genérico antes de iniciar Streamlit.

No se añade un backend HTTP separado, una base de datos ni almacenamiento
persistente como requisito de F4. El proceso web es el que proporciona Streamlit.

## 2. Configurar el alojamiento elegido

1. Preparar un runtime compatible con Python 3.12 y las bibliotecas del lock.
2. Configurar los comandos de preparación y arranque del contrato anterior.
3. Definir `PORT` y exponer ese puerto con soporte HTTP/WebSockets.
4. Configurar el health check, si el entorno admite esa comprobación.
5. Publicar y verificar la URL, análisis de un ticker, gráficas y descarga Excel.

La conexión al repositorio, los secretos del alojamiento, dominios, TLS, permisos,
planes y reglas de despliegue automático pertenecen a la configuración del
entorno. El código y sus pruebas no requieren SDK, credenciales ni recursos de
un proveedor concreto. CI verifica el repositorio y no publica el servicio.

No hay una URL ni recursos de alojamiento creados como parte de esta edición.
La comprobación final se realiza sobre la URL que genere el entorno elegido.

## 3. Estado de la aplicación

La app conserva resultados/cachés en memoria y exporta Excel para descarga.
Un reinicio puede requerir repetir el análisis; no se presupone persistencia del
sistema de archivos de un alojamiento. Esa característica y los límites de
recursos se deben revisar en el entorno de publicación elegido.

Yahoo sigue siendo un proveedor externo con disponibilidad y límites propios.
Un health check exitoso acredita que Streamlit responde, no que cada ticker tenga
datos. No se modificó la metodología para el alojamiento.

La UI incluye un selector **Fuente de datos → Demostración** que usa archivos
locales versionados y carga tres casos al activarse. Puede configurarse
`VALORACION_DEMO=1` para abrir esa vista en sesiones nuevas. Es una variable del
producto, independiente del proveedor de alojamiento; no cambia los comandos
de preparación/arranque ni exige una base de datos.

La demo no consulta Yahoo ni descarga históricos. La primera carga de recursos
de la página sigue necesitando acceder al servicio web. Los resultados son
deterministas para el dataset, la configuración y la metodología fijados; el
Excel incorpora la fecha de generación. No confundir el modo de producto con
la suite de tests ni prometer que todo el servicio web funciona sin conexión.

Al cambiar de fuente se descarta el análisis anterior. Las claves de caché de
análisis y ambos tipos de históricos incluyen la fuente, y no se mezclan precios
de mercado con la demo. La configuración guardada al analizar sigue siendo la
que se exporta hasta solicitar otro análisis.

## 4. Preparar un entorno de desarrollo

Usar Git y CPython 3.12 desde la raíz. En el Mac de desarrollo:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --no-deps -r requirements-dev.txt
.venv/bin/python -m pip check
```

Se invoca el intérprete directamente para que pip y herramientas usen el mismo
Python sin depender de la activación ni de un `python` global en PATH. Estos son
comandos de desarrollo, no la forma de consumir la aplicación desplegada.

Para desarrollar únicamente con dependencias de ejecución:

```bash
.venv/bin/python -m pip install --no-deps -r requirements.txt
```

`--no-deps` instala sólo los pines del archivo resuelto, incluidas sus transitivas;
`pip check` detecta una resolución incompleta. No usar esa opción con los `.in`,
que contienen entradas y no la resolución completa.

Para inspeccionar la UI durante desarrollo se puede ejecutar Streamlit con ese
intérprete. Se retiraron los antiguos lanzadores orientados a instalación local;
el arranque versionado del servicio es `iniciar_servicio.sh`.

## 5. Fuentes y regeneración de dependencias

| Archivo | Responsabilidad |
| --- | --- |
| `requirements.in` | Dependencias directas de ejecución y watchdog requerido en Linux |
| `requirements-dev.in` | Herramientas de desarrollo; incluye ejecución y la restringe con `-c requirements.txt` |
| `requirements.txt` | Resolución completa de ejecución con pines exactos |
| `requirements-dev.txt` | Resolución completa de desarrollo compatible con ejecución |
| `pyproject.toml` | Configuración de pytest, coverage y Ruff; no duplica dependencias |
| `.python-version` | Referencia de Python para ejecución y CI |

No editar manualmente los `.txt` para actualizar bibliotecas. Cambiar las entradas
y regenerar primero ejecución y después desarrollo. Pip-tools reutiliza los
pines existentes si siguen satisfaciendo las entradas. La resolución inicial
conserva las versiones del producto verificadas en F3.

Con pip-tools 7.6.2 y pip 26.3 en CPython 3.12, un comando por línea:

```bash
.venv/bin/python -m piptools compile --allow-unsafe --strip-extras --no-emit-index-url --no-emit-trusted-host --output-file requirements.txt requirements.in
.venv/bin/python -m piptools compile --allow-unsafe --strip-extras --no-emit-index-url --no-emit-trusted-host --output-file requirements-dev.txt requirements-dev.in
```

Para actualizar transitivas deliberadamente se puede añadir `--upgrade`; para
una directa hay que cambiar antes su pin en `.in`. Revisar el diff, comprobar una
instalación limpia y ejecutar la suite. `--allow-unsafe` permite fijar pip y
setuptools como dependencias de las herramientas; no significa que se haya
realizado una auditoría de seguridad.

La compilación de esta sesión se ejecutó en macOS y fijó explícitamente watchdog
porque Streamlit lo necesita en Linux. El contrato de dependencias verifica los
marcadores de Linux; Ubuntu en CI es la verificación del entorno de destino.
No se promete equivalencia binaria universal ni soporte de instalaciones de
usuario final en Windows/macOS. Las bibliotecas nativas deben estar disponibles
para la arquitectura del entorno de publicación.

La resolución depende de Python, plataforma, entradas, pines previos, compilador
y candidatos del índice. La [documentación de pip-tools](https://pip-tools.pypa.io/en/stable/)
recomienda resolver en el entorno correspondiente. No se cambia de herramienta
ni se interpreta un `pip freeze` de un entorno antiguo como una actualización
validada. Se fijan versiones; no hashes de todos los artefactos de cada plataforma.

## 6. Comprobaciones y TDD

```bash
.venv/bin/python -m pip check
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
.venv/bin/python -m pytest
```

Para aplicar correcciones seguras/formato durante el desarrollo:

```bash
.venv/bin/python -m ruff check . --fix
.venv/bin/python -m ruff format .
```

Pytest, cobertura y Ruff están en `pyproject.toml`; se retiraron `pytest.ini` y
`.coveragerc`. La cobertura mantiene ramas, todas las entradas y `valoracion`, con
umbral 85 %. Los reportes XML/JUnit permanecen ignorados por Git.

Ruff comprueba E4/E7/E9/F/I y formato a 100 columnas. La fachada tiene excepción
F401 por sus reexportaciones deliberadas. `.gitattributes` conserva LF para código
y shell; los fixtures versionados se leen en UTF-8. Véase la
[configuración oficial de Ruff](https://docs.astral.sh/ruff/configuration/).

TDD sigue siendo obligatorio: prueba de regresión, fallo observado, cambio mínimo
y refactorización con pruebas verdes. CI usa Ubuntu/Python 3.12, crea un entorno
nuevo, instala el lock de desarrollo, comprueba dependencias/lint/formato y ejecuta
pytest. CI no contiene credenciales ni publica la aplicación. Cualquier automatización
de publicación se configura en el entorno elegido.

## 7. Red y validación independiente

La instalación y regeneración normalmente necesitan el índice de paquetes.
Arrancar una imagen/build preparado no reinstala dependencias. Las pruebas usan
proveedores sintéticos y bloquean las consultas de mercado; las de arranque PaaS
usan un runtime temporal de prueba sin pip para registrar argumentos/señales de
salida, sin abrir un servicio público.

```bash
.venv/bin/python -m examples.valoracion_independiente
.venv/bin/python -m examples.analisis_demo
```

El ejemplo funciona sin Yahoo y genera su conciliación CSV/Excel. Para comprobar
un entorno limpio se crea otro `venv`, se instala `requirements-dev.txt` y se
repiten los cuatro comandos de validación. Una descarga previa para la plataforma
permite instalar con `--no-index --find-links RUTA`; la ruta de esa descarga no es
una dependencia del repositorio.

El [ejemplo público de F5](../examples/demo/README.md) incluye un CSV, un Excel real
y el manifest de los tres casos de demo. Los datos están descritos en
[data/demo](../data/demo/README.md). Las salidas por defecto de ambos scripts
permanecen en `examples/salida/`, ignorado por Git.

La [evidencia de F4](TDD_F4.md) y la [evidencia de F5](TDD_F5.md) registran los
resultados reales. Se verificó el run de Ubuntu del commit `d90fc2a`, previo a F5:
[Tests #5, correcto](https://github.com/adndvlp/IntVal/actions/runs/43363574654).
Ese run no valida cambios posteriores aún sin publicar. La validación local,
el run remoto correspondiente y la URL desplegada son evidencias distintas.
