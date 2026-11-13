# Conciliación independiente de F3

Este ejemplo demuestra la aritmética de `proxies-1.0`, sin datos de mercado ni
consultas externas. Los datos son ficticios y se pueden redistribuir con el
repositorio; no provienen de una descarga de Yahoo.

Con el entorno virtual del proyecto activo, desde la raíz:

```bash
python -m examples.valoracion_independiente
```

También se puede elegir el destino:

```bash
python -m examples.valoracion_independiente --output /tmp/ejemplo-valoracion
```

La salida predeterminada `examples/salida/` está ignorada por Git. Contiene
`conciliacion.csv` y `valoracion_independiente.xlsx`, con las siete hojas reales
del exportador. El script falla si el cálculo independiente no coincide con los
esperados manuales o si el resultado del motor difiere en más de `1e-10`.
El título del libro contiene la fecha de generación, por lo que no se promete
igualdad binaria del archivo entre ejecuciones.

## Datos e hipótesis

[datos.csv](datos.csv) contiene cinco ejercicios anuales, de 2020 a 2024, en USD.
Ingresos 1,000, EBIT 200, utilidad neta 120, impuestos 40, resultado antes de
impuestos 200, EBITDA 250, CFO 180, CapEx −50, FCL 130, deuda 300, efectivo 100.
Se supone una empresa industrial, diez acciones, precio 40 y objetivo de analistas
60, también ficticios. No se atribuyen a esos datos fechas de mercado ni de
adquisición reales.

El ejemplo usa tres años, crecimiento cero, factor de margen 0.8, descuento cero
y múltiplos 2x. El descuento cero sirve para comprobar aritmética; no es una
estimación de coste de capital. La tasa fiscal es 40/200 = 20 %.

| Paso | FCL | NOPAT | EBITDA ajustado | Utilidad neta |
| --- | ---: | ---: | ---: | ---: |
| Métrica anual | 180 − 50 = 130 | 200 × 0.8 = 160 | 250 − 40 − 50 = 160 | 120 |
| Margen mediano | 0.13 | 0.16 | 0.16 | 0.12 |
| Margen × 0.8 | 0.104 | 0.128 | 0.128 | 0.096 |
| Base sobre ingresos 1,000 | 104 | 128 | 128 | 96 |
| PV de tres métricas anuales | 312 | 384 | 384 | 288 |
| PV terminal: base × 2 | 208 | 256 | 256 | 192 |
| Total del proxy | 520 | 640 | 640 | 480 |
| Menos deuda neta, si es de empresa | 0 | 200 | 200 | 0 |
| Capital | 520 | 440 | 440 | 480 |
| Por acción: capital / 10 | **52** | **44** | **44** | **48** |

Mediana ordenada de `[44, 44, 48, 52]`: `(44 + 48) / 2 = 46`.
Upside: `46/40 − 1 = 0.15`. El objetivo de analistas no participa en la mediana.
Los pasos esperados están también en [esperados.csv](esperados.csv).

## Independencia del cálculo

[valoracion_independiente.py](valoracion_independiente.py) lee los números con
`Decimal`, construye las métricas/márgenes con operaciones propias y calcula
el descuento mediante una **anualidad cerrada**, en vez del bucle de proyección
del motor. No llama a las funciones del producto para producir esperados ni
importa fixtures de pytest. Después ejecuta el motor sobre esos datos y compara.
El caso tiene crecimiento cero deliberadamente para poder usar esa anualidad.

Para una tasa de empresa de 10 %, manteniendo accionista en 0 %:

```text
factor_actual = 1 / 1.1^3
anualidad = (1 − factor_actual) / 0.1
PV empresa NOPAT = 128 × anualidad + 128 × 2 × factor_actual
                = 510.653643876784...
capital por acción = (510.653643876784... − 200) / 10
                   = 31.06536438767844...
```

El oráculo Decimal de ese escenario se comprueba en la suite y no altera el FCL,
que sigue en 52. Las pruebas integradas reabren el Excel, comprueban etiquetas,
valores, versiones y períodos. El comando canónico sigue siendo:

```bash
python -m pytest
```

Que ambos cálculos concilien acredita la implementación de estas hipótesis.
Sus [limitaciones financieras](../docs/methodology.md) continúan aplicando.
