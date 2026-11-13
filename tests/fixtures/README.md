# Datos sintéticos y resultados de referencia

Todos los datos de `datos_sinteticos.py` fueron creados para las pruebas. No son
cotizaciones reales ni snapshots descargadas de Yahoo. Los símbolos `TEST` y
`TEST.MX` identifican escenarios; la suite nunca debe enviarlos al mercado.

Cada prueba recibe un objeto nuevo y puede modificar su escenario sin afectar a
las demás. `estado()` produce cinco columnas anuales, del 2020-01-01 al
2024-01-01. Los importes se expresan en unidades monetarias, no en millones.

## Industrial constante

| Dato anual | Valor |
| --- | ---: |
| Ingresos | 1,000 |
| EBIT | 200 |
| Utilidad neta | 120 |
| Impuestos | 40 |
| Utilidad antes de impuestos | 200 |
| EBITDA | 250 |
| CFO | 180 |
| CapEx | -50 |
| FCL | 130 |
| Depreciación y amortización | 50 |
| Deuda | 300 |
| Efectivo | 100 |
| Acciones | 10 |
| Precio | 40 |
| Objetivo medio de analistas | 60 |

Las monedas iniciales de estados y cotización son USD. El histórico de precio
tiene tres cierres sintéticos `[38, 39, 40]` con fechas UTC; permite comprobar
también la normalización de zona horaria.

## Cálculo independiente del escenario integrado

`config_simple` usa tres años, descuento cero, múltiplo terminal de dos para
todos los modelos y factor de margen 0.8. Los ingresos constantes producen
crecimiento cero. La tasa fiscal es `40 / 200 = 0.2`.

- NOPAT: `200 × 0.8 = 160`.
- EBITDA ajustado: `250 - 200 × 0.2 - 50 = 160`.
- Márgenes FCL/NOPAT/EBITDA ajustado/neto: `0.13 / 0.16 / 0.16 / 0.12`.
- Bases conservadoras: `104 / 128 / 128 / 96`.
- Con tres flujos constantes y un terminal de dos, valor total = `base × 5`.
- Deuda neta: `300 - 100 = 200`.

| Modelo del código actual | Conciliación por acción | Esperado |
| --- | --- | ---: |
| FCL | `104 × 5 / 10` | 52 |
| EBIT/NOPAT | `(128 × 5 - 200) / 10` | 44 |
| EBITDA ajustado | `(128 × 5 - 200) / 10` | 44 |
| Utilidad neta | `96 × 5 / 10` | 48 |
| Mediana | `(44 + 48) / 2` | 46 |
| Upside mediana | `46 / 40 - 1` | 0.15 |
| Upside analistas | `60 / 40 - 1` | 0.50 |

Estos esperados protegen la aritmética de la implementación actual; no validan
la interpretación financiera de los cuatro modelos. La revisión corresponde a
F3, incluidos la naturaleza de FCL, sectores, deuda desconocida y FX ausente.

## Variantes

Las pruebas modifican explícitamente los datos para construir fallbacks,
modelos parciales, compañías financieras, errores y ausencias. Para MX se
conservan los importes en MXN o se usa un FX directo de 20/inverso de 0.05.
El caso FX ausente está rotulado como caracterización pendiente de F3.

Las pruebas de UI usan la configuración visible predeterminada; sus importes
no deben confundirse con los esperados del escenario simplificado anterior.
Los casos numéricos de proyección, CAGR y márgenes adicionales están en la SDD.

## Equivalencia de F2 frente a F1

`escenarios_f2.py` define ocho variantes usadas para comparar el motor completo:
configuración predeterminada y simple, ausencia de acciones, fallo de flujo,
sector financiero, crecimiento fallback, sólo utilidad neta y FX ausente.

`resultados_f1.json` se capturó ejecutando el motor original del commit `b9852e6`,
antes de sustituirlo por la fachada. Contiene los 19 campos de resumen y 45 de
detalle, incluidas sus notas, para cada caso. La suite compara valores con una
tolerancia de `1e-12` y conserva los nombres y el orden de las columnas.

Estos archivos son una caracterización de compatibilidad, no datos de mercado
ni demostración de validez económica. No regenerar los esperados desde el motor
nuevo para hacer pasar un cambio de comportamiento; cualquier cambio de
metodología requiere la justificación y pruebas de F3.
