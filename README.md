# App de valoración de acciones USA y México

Aplicación local en Streamlit que descarga información de Yahoo Finance y compara, por acción:

- Precio de mercado
- Proxy de flujo de caja libre (FCL)
- Proxy de NOPAT (EBIT después de impuestos)
- Proxy de EBITDA ajustado
- Proxy de utilidad neta
- Mediana de los proxies disponibles y aplicables, con su cantidad
- Precio objetivo de analistas, identificando media o mediana cuando está disponible

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
3. Ajusta las tasas de descuento de accionista/empresa, el factor conservador y los múltiplos.
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
- Financieras, REIT/FIBRA y vehículos sin modelo implementado quedan fuera de los cuatro proxies y de su mediana.
- Un FX no verificable bloquea la valoración; deuda/efectivo desconocidos no se rellenan con cero.
- Las fórmulas son aproximaciones heurísticas, con supuestos manuales; no implementan un DCF completo ni tasas o múltiplos calibrados. La [metodología](docs/methodology.md) documenta las decisiones y sus límites.
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
[evidencia de F3](docs/TDD_F3.md), la
[matriz de trazabilidad](docs/F1_TEST_MATRIX.md) y los
[datos de referencia](tests/fixtures/README.md) explican qué se comprobó y con qué
esperados. F3 documenta y restringe la metodología; que la aritmética pase no
demuestra capacidad predictiva de los proxies.

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

F1, F2 y F3 están implementadas y verificadas localmente. La formalización completa
de dependencias (F4) y la demo/presentación de producto (F5) siguen pendientes.

## Metodología y ejemplo reproducible (F3)

La [metodología `proxies-1.0`](docs/methodology.md) explica fórmulas, unidades,
fuentes, aplicabilidad, fechas y cambios respecto al comportamiento anterior.
El contrato `2.0` conserva las claves originales y añade versiones y trazabilidad;
las etiquetas de UI y Excel identifican las métricas realmente calculadas.

Para conciliar un caso completo con `Decimal`, sin consultar Yahoo:

```bash
python -m examples.valoracion_independiente
```

Genera un CSV de conciliación y un Excel en `examples/salida/` (ignorado por Git).
El [ejemplo documentado](examples/README.md) incluye datos, pasos y esperados
independientes: 52, 44, 44 y 48 USD por acción; mediana 46. Son cifras ficticias,
no estimaciones sobre empresas reales.

## Especificación y plan de desarrollo

La [SDD del proyecto](docs/SDD.md) documenta el estado actual, los hallazgos, los contratos de datos, la matriz de pruebas y el plan de implementación por fases. Incluye instrucciones para continuar el trabajo sin el historial de la conversación.
