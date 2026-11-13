# Análisis público de la demo

Estos archivos se generaron desde el dataset sintético
[`demo-1.0`](../../data/demo/README.md), referencia **2025-01-03**, con el servicio,
las fórmulas y el exportador utilizados en la interfaz. No son valoraciones de
empresas reales.

- [analisis_demo.xlsx](analisis_demo.xlsx): libro real con siete hojas.
- [analisis_demo.csv](analisis_demo.csv): tabla principal con etiquetas de proxy.
- [manifest.json](manifest.json): configuración exacta, versiones y procedencia.

## Reproducir

Con las dependencias instaladas, desde la raíz del repositorio:

```bash
.venv/bin/python -m examples.analisis_demo
```

Se crean CSV, Excel y manifest en `examples/salida/demo/`, ignorado por Git.
Para regenerar intencionalmente los archivos públicos versionados:

```bash
.venv/bin/python -m examples.analisis_demo --output examples/demo
```

No se consulta Yahoo ni se requieren credenciales. El script puede ejecutarse
con las dependencias de producto; no importa código de pruebas. Invoca
`analizar_empresa(..., proveedor=ProveedorDemo())` y `escribir_excel`.

## Supuestos y resultados

La configuración coincide con la UI recién abierta en Demostración: diez años
de proyección; tasas de descuento de accionista y empresa del 10 %; factor
conservador 0,8; múltiplos terminales 12 para FCL, EBIT y EBITDA, y 15 para
utilidad neta. La configuración completa se conserva en el manifest y en la hoja
Supuestos. Metodología `proxies-1.0`, contrato `2.0`.

| Caso | Precio | Mediana sin redondear | Proxies disponibles | Estado |
| --- | ---: | ---: | ---: | --- |
| DEMO-USA (USD) | 100 | 116.1879930510067 | 4 | OK |
| DEMO-MX.MX (MXN) | 200 | 209.138387491812 | 4 | OK |
| DEMO-INCOMPLETA (USD) | 80 | Ausente | 0 | DATOS INCOMPLETOS |

La diferencia entre mediana y precio es, respectivamente, 16,187993 % y
4,569194 %. Las ausencias del tercer caso se conservan vacías en CSV/Excel.
No se confunden con un proxy cero. Son resultados sobre cifras inventadas, no
señales de inversión ni una validación predictiva.

Excel contiene Resumen, USA, MX, Detalle, Supuestos, Universo y Fuentes. Revisar
Detalle para procedencia, períodos, notas y versiones. Universo/Fuentes incluyen
el snapshot del catálogo de mercado de la aplicación; ese catálogo no es el
origen de los tres casos sintéticos.

Los valores financieros son reproducibles con las mismas entradas y configuración.
El libro incorpora fecha de generación y metadatos del archivo; no se promete
identidad binaria entre ejecuciones. Las pruebas reabren el Excel y concilian sus
valores y estructura, en lugar de comparar los bytes del ZIP.

Para una conciliación aritmética más pequeña con tasas cero y esperados calculados
independientemente mediante Decimal, usar el [ejemplo de F3](../README.md).
