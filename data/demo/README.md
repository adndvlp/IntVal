# Dataset de demostración `demo-1.0`

Datos íntegramente sintéticos creados para demostrar IntVal. Los nombres,
símbolos, estados, acciones, objetivos y precios son inventados. No se han
descargado datos de empresas reales para construir este dataset.

**Fecha de referencia fija: 2025-01-03.** No representa la fecha actual ni una
fecha de consulta a un proveedor externo.

## Archivos y unidades

| Archivo | Contenido |
| --- | --- |
| `empresas.json` | Versión, referencia y catálogo: nombre, moneda, acciones, precio y objetivo ficticio |
| `estados.csv` | Estados anuales por ticker y cierre; campos monetarios en la moneda indicada para la empresa |
| `precios.csv` | Cierres ficticios por ticker y fecha, en moneda por acción |

Los importes se expresan en unidades monetarias, sin multiplicadores ocultos.
Las acciones son cantidades de acciones. Las fechas usan `AAAA-MM-DD` y los
decimales de los archivos usan punto. Campos vacíos o `null` significan ausencia,
no cero. CapEx negativo representa salida de efectivo. Precio y estados están
en la misma moneda: FX es identidad, no una cotización de mercado.

## Casos incluidos

| Símbolo ficticio | Caso | Moneda | Acciones | Precio | Objetivo ficticio |
| --- | --- | --- | ---: | ---: | ---: |
| DEMO-USA | Industrial completa | USD | 10 | 100 | 120 |
| DEMO-MX.MX | Industrial completa | MXN | 100 | 200 | 240 |
| DEMO-INCOMPLETA | Sólo ingresos; faltan acciones y otras cuentas | USD | Ausente | 80 | Ausente |

Las dos empresas completas tienen cinco ejercicios, 2020–2024, con magnitudes
constantes para poder conciliar el crecimiento y los márgenes. El caso USA usa
ingresos 1000, EBIT 200, utilidad neta 120, impuestos 40, resultado antes de
impuestos 200, EBITDA 250, CFO 180, CapEx −50, FCL 130, deuda 300 y efectivo 100.
El caso MX multiplica esas cuentas por 18 y utiliza diez veces las acciones.
Sus proxies por acción son por ello 1,8 veces los del caso USA, en su propia
moneda. Esta relación es una construcción de prueba, no un tipo de cambio.

El caso incompleto tiene únicamente ingresos 1000 en 2024 y debe resultar en
`DATOS INCOMPLETOS`, con cuatro proxies y mediana ausentes.

Los precios se construyeron una vez como trayectorias ficticias con tendencia
y variaciones fijas, desde 2020-01-01 hasta 2025-01-03: 62 observaciones por
empresa. Los CSV versionados son la fuente de verdad; no se generan números
aleatorios ni se actualizan con el reloj al ejecutar la demo. El último cierre
coincide con el precio del catálogo. Un selector de diez años puede mostrar
menos historia porque el archivo sólo contiene ese intervalo.

## Uso y trazabilidad

`ProveedorDemo` implementa las tres operaciones de `ProveedorDatos` y entrega
snapshots copiados al servicio existente. El motor, las vistas y el exportador
son los mismos que en Mercado. No importa fixtures de `tests/`, clientes de
mercado ni vuelve a Yahoo ante símbolos desconocidos.

La fuente y los diagnósticos identifican datos sintéticos, versión y referencia.
No se inventa una fecha de obtención de Yahoo, cobertura de analistas ni horizonte
del objetivo ficticio. El Excel conserva esa información en Detalle y Notas.
Las hojas Universo y Fuentes describen también el catálogo de mercado incluido
en la aplicación: no convierten las tres empresas ficticias en componentes reales
de ese catálogo.

Las pruebas del proveedor y de UI comprueban el flujo con consultas de mercado
y red bloqueadas. El [ejemplo público](../../examples/demo/README.md) usa estos
archivos. El [ejemplo Decimal](../../examples/README.md) mantiene su propio caso
independiente para verificar las fórmulas.

## Mantenimiento

Un cambio en las entradas requiere nueva versión del dataset, revisión de los
esperados independientes, regeneración del ejemplo y actualización de las
capturas. Conservar explícitos procedencia ficticia, unidades y referencia.
No reutilizar la referencia para presentar una descarga de mercado como actual.
