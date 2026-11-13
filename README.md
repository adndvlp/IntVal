# App de valoración de acciones USA y México

Aplicación local en Streamlit que descarga información de Yahoo Finance y compara, por acción:

- Precio de mercado
- Valor intrínseco con flujo de caja libre
- Valor intrínseco con EBIT convertido a NOPAT
- Valor intrínseco con EBITDA ajustado
- Valor intrínseco con utilidad neta
- Mediana de los cuatro modelos
- Precio objetivo promedio de analistas

La app incluye filtros, gráficas históricas y exportación a un archivo Excel con hojas separadas para USA y México.

## Instalación

Se recomienda Python 3.10 o posterior.

```bash
python -m venv .venv
```

### Windows

```powershell
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

También puedes ejecutar `ejecutar_app.bat`.

### macOS o Linux

```bash
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

También puedes ejecutar:

```bash
chmod +x ejecutar_app.sh
./ejecutar_app.sh
```

## Uso

1. Selecciona `USA`, `MX` o `Todos`.
2. Selecciona los tickers.
3. Ajusta la tasa de descuento, el factor conservador y los múltiplos.
4. Pulsa **Analizar empresas**.
5. Filtra la tabla, revisa las gráficas y descarga el Excel.

## Archivos principales

- `app.py`: entrada Streamlit, controles, sesión y cachés.
- `motor_valoracion.py`: fachada compatible y entrada de la CLI.
- `valoracion/`: configuración, modelos, normalización, cálculos, servicio, proveedor Yahoo, exportación y presentación.
- `data/universo.json`: catálogo local de empresas y procedencia.
- `tests/`: pruebas de comportamiento, arquitectura y equivalencia.
- `requirements.txt`: dependencias.

## Consideraciones

- Yahoo Finance puede no entregar todos los campos para todos los tickers, especialmente objetivos de analistas de emisoras mexicanas.
- Las empresas financieras requieren una lectura diferente: la utilidad neta suele ser más útil que FCL, EBIT o EBITDA.
- La lista mexicana prioriza emisoras grandes y líquidas; se encuentra en `data/universo.json`. El catálogo conserva un snapshot local y no certifica la composición actual de un índice.
- Los resultados son aproximaciones educativas y no constituyen una recomendación de inversión.

## Pruebas y TDD

Con el entorno virtual activo, instala las herramientas de desarrollo y ejecuta:

```bash
python -m pip install -r requirements-dev.txt
python -m pip check
python -m pytest
```

La suite usa pytest, AppTest, mocks y datos sintéticos. Cubre cálculos, proveedor,
interfaz, sesión, cachés, CLI y libros Excel reales. Las consultas de mercado no
preparadas y los sockets de red de Python están bloqueados durante las pruebas.
La instalación de dependencias puede requerir Internet.

El comando completo mide líneas y ramas en las entradas y todo el paquete `valoracion`, exige
85 % de cobertura total y genera `coverage.xml` y `test-results.xml`. Los reportes
son archivos locales ignorados por Git. Para depurar un caso sin el umbral global:

```bash
python -m pytest -o addopts='' tests/ui/test_app.py -k todos_los_analisis_fallan -q
```

Los cambios de software deben seguir **TDD: prueba, fallo observado, cambio mínimo
y refactorización con pruebas verdes**. La [evidencia de F1](docs/TDD_F1.md), la
[evidencia de F2](docs/TDD_F2.md), la
[matriz de trazabilidad](docs/F1_TEST_MATRIX.md) y los
[datos de referencia](tests/fixtures/README.md) explican qué se comprobó y con qué
esperados. Las caracterizaciones de modelos actuales no validan su metodología
económica; esa revisión sigue pendiente de F3.

GitHub Actions ejecutará el mismo comando en push, pull requests y ejecución
manual, con Python 3.12 y permisos de lectura. El workflow no despliega la app.
Su ejecución remota debe verificarse en GitHub; la verificación local y sus
versiones están registradas en la SDD. El bloqueo integral de dependencias y la
ampliación de compatibilidad permanecen en F4.

## Arquitectura (F2)

La [decisión de arquitectura](docs/architecture.md) explica las dependencias,
el contrato del proveedor y la compatibilidad. La UI y la CLI comparten el
servicio; los cálculos se ejecutan sobre snapshots sin I/O. Se puede inyectar un
`ProveedorDatos` en el servicio o una factory en `ProveedorYahoo` para probar
datos alternativos sin cambiar las fórmulas.

F1 y F2 están implementadas y verificadas localmente. La revisión metodológica,
la formalización completa de dependencias y la demo de producto siguen pendientes
de F3, F4 y F5, respectivamente.

## Especificación y plan de desarrollo

La [SDD del proyecto](docs/SDD.md) documenta el estado actual, los hallazgos, los contratos de datos, la matriz de pruebas y el plan de implementación por fases. Incluye instrucciones para continuar el trabajo sin el historial de la conversación.
