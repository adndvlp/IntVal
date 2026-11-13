# Metodología: proxies de valoración y trazabilidad

Metodología **`proxies-1.0`**, contrato de resultados **`2.0`**. Introducida en F3,
sobre el commit `81ed7fb`. La investigación distingue definiciones financieras,
políticas elegidas para este producto y limitaciones que el software no resuelve.
Las pruebas demuestran aritmética y comportamiento; no acreditan capacidad de
predecir precios ni rentabilidades.

El producto compara cuatro aproximaciones heurísticas por acción. No implementa
un DCF completo de FCFF/FCFE ni garantiza un «valor intrínseco». Por eso la UI,
las gráficas y Excel muestran **proxy FCL, proxy NOPAT, proxy EBITDA ajustado y
proxy utilidad neta**. Se conservan nombres antiguos sólo como claves de la API
para facilitar la migración.

## 1. Definiciones y decisiones MET-01 a MET-05

Como referencia teórica, FCFF requiere ajustar NOPAT por reinversión, mientras
que FCFE parte de utilidad neta e incorpora reinversión y endeudamiento neto.
Una formulación habitual es:

```text
FCFF = EBIT × (1 − T) − (CapEx − depreciación) − Δcapital de trabajo no monetario
FCFE = utilidad neta − (CapEx − depreciación) − Δcapital de trabajo
       + deuda nueva − principal amortizado
```

Estas definiciones explican por qué proyectar una partida contable aislada no
reproduce automáticamente un flujo libre. Véanse las
[definiciones de Damodaran](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/definitions.html).

Las siguientes son decisiones de alcance del proyecto, no conclusiones de que
sus datos satisfagan esas definiciones:

| Cuestión | Decisión implementada | Componentes o comprobaciones ausentes |
| --- | --- | --- |
| MET-01: FCL | Usar `Free Cash Flow` si existe; en otro caso calcular CFO menos el valor absoluto de CapEx. Proyectarlo como proxy del accionista y no volver a restar deuda neta. | No se concilian deuda nueva/amortización, clasificación de intereses, diferencias contables ni el FCL publicado contra el reconstruido. No se afirma que sea FCFE; se supone financiación neta nula y clasificación compatible con el accionista. |
| MET-02: descuento | Usar tasa de accionista para FCL/utilidad neta y tasa de empresa para NOPAT/EBITDA ajustado. | Tasas ingresadas manualmente; no se calculan beta, prima de riesgo, estructura de capital ni WACC. La igualdad predeterminada de tasas es una simplificación visible. |
| MET-03: NOPAT | `EBIT × (1 − T)` como métrica operativa. Proyectar el proxy de empresa y restar deuda neta conocida y conciliable. | No se descuenta reinversión neta ni cambios de capital de trabajo; no es FCFF. El crecimiento no exige reinversión consistente dentro del algoritmo. |
| MET-04: EBITDA ajustado | `EBITDA − max(EBIT, 0) × T − |CapEx|`. Proyectar el proxy de empresa y restar deuda neta conciliable. | Se resta todo el CapEx disponible. No se distingue mantenimiento/crecimiento; faltan cambios de capital de trabajo y otros ajustes. Tampoco es FCFF validado. |
| MET-05: utilidad neta | Proyectar utilidad contable como proxy del accionista, sin restar otra vez deuda neta. | No se concilia caja distribuible, reinversión, dividendos ni financiación. Supone disponibilidad económica de la utilidad; esa hipótesis puede fallar aun en una empresa rentable. |

La separación entre resultado contable y movimientos de caja también se explica
en la [guía de estados financieros de la SEC](https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements).
La app conserva estas fórmulas para comparación exploratoria y expone sus límites;
no completa partidas faltantes con estimaciones presentadas como hechos.

## 2. Datos, prioridades y unidades

El adaptador `valoracion/proveedores/yahoo.py` entrega `DatosEmpresa` al motor
puro. Un proveedor alternativo puede entregar el mismo contrato sin Yahoo.
Los estados anuales se organizan como filas contables y columnas de cierre.
Se limpian valores no numéricos/no finitos, se ordenan fechas y se alinean series
por intersección de períodos. No se interpola ni se completa un año faltante.

Las prioridades de adquisición que afectan al cálculo son:

| Dato | Selección, en orden |
| --- | --- |
| Ingresos | `Total Revenue`, `Operating Revenue`, `Revenue` |
| EBIT | `EBIT`, `Operating Income`, `Operating Income Loss` |
| Utilidad neta | `Net Income Common Stockholders`, `Net Income`, `Net Income Including Noncontrolling Interests` |
| Impuestos / resultado antes de impuestos | `Tax Provision` o `Income Tax Expense`; `Pretax Income`, `Income Before Tax`, `Earnings Before Tax` |
| FCL | `Free Cash Flow`; si no hay fila, CFO menos `abs(CapEx)` |
| CFO alternativo | `Operating Cash Flow`, `Total Cash From Operating Activities`, `Cash Flow From Continuing Operating Activities` |
| CapEx | `Capital Expenditure`, `Capital Expenditures`, `Purchase Of PPE`, `Investments In Property Plant And Equipment` |
| EBITDA | `EBITDA`, `Normalized EBITDA`; si no hay fila, EBIT más valor absoluto de D&A |
| D&A alternativo | `Depreciation And Amortization`, `Depreciation Amortization Depletion`, `Depreciation` |
| Deuda | `Total Debt`, `Long Term Debt And Capital Lease Obligation`; después `info.totalDebt` |
| Efectivo | `Cash Cash Equivalents And Short Term Investments`, `Cash And Short Term Investments`, `Cash And Cash Equivalents`; después `info.totalCash` |
| Precio | Primer precio positivo de `fast_info.last_price`, `lastPrice`, `regular_market_price`; después último cierre positivo de `history(period='5d', auto_adjust=False)` |
| Acciones | `info.sharesOutstanding`, `impliedSharesOutstanding`; después `fast_info.shares`, `shares_outstanding`; después capitalización/precio; después último dato positivo de `get_shares_full()` |

La primera fila disponible tiene prioridad: no se rellenan sus huecos con otra
fila parecida. Los alias pueden tener perímetros contables distintos. En
particular, deuda de largo plazo no garantiza deuda total, y efectivo más
inversiones no equivale necesariamente a caja libre. La selección queda trazada
para revisión; no constituye conciliación con estados auditados.

Los importes se usan en **unidades monetarias completas**, las acciones en
unidades de acciones y las tasas como fracciones anuales (`0.10 = 10 %`). Las
valoraciones finales son moneda de cotización por acción. Sólo las gráficas de
históricos financieros dividen los importes entre un millón; los márgenes son
fracciones y se muestran como porcentajes.

## 3. Normalización de impuestos, crecimiento y márgenes — MET-07

Estas reglas son heurísticas del producto. Los valores predeterminados no se han
calibrado contra una muestra histórica de empresas ni validado por sector.

**Impuestos.** Se alinean provisión y utilidad antes de impuestos. Sólo se
conservan períodos con resultado antes de impuestos positivo y cociente finito
en `[-0.05, 0.60]`. Se toma la mediana de las últimas `max_anos_historicos`
observaciones aceptadas y se limita a los límites configurados. Con ninguna
observación se usa el fallback. Valores predeterminados: ventana 5, fallback
21 %, mínimo 0 %, máximo 35 %. La tasa histórica se aplica a todos los períodos
usados para NOPAT y EBITDA ajustado; no se reconstruye una tasa marginal anual.

**Crecimiento.** El CAGR usa los ingresos estrictamente positivos, desde el
primero al último, con años transcurridos `días / 365.25`:

```text
CAGR = (ingresos_finales / ingresos_iniciales)^(1 / años_transcurridos) − 1
g1 = limitar(CAGR × factor_inicial, crecimiento_mínimo, crecimiento_máximo)
g2 = g1 × factor_final
```

El CAGR utiliza todo el histórico de ingresos disponible, no la ventana de
márgenes. Necesita dos observaciones positivas y un lapso positivo. Si las fechas
no se pueden interpretar, la función heredada usa número de intervalos; índices
numéricos no certifican años fiscales y pueden producir lapsos inadecuados.
Si falta CAGR se usa `info.revenueGrowth` finito y, si también falta, el fallback
configurado. La etiqueta visible es «Crecimiento bruto utilizado» para no llamar
CAGR a un fallback. Se guarda la ruta realmente utilizada.

Descartar ingresos no positivos puede omitir pérdidas/cambios de perímetro;
filtrar no equivale a corregirlos económicamente. El proyecto no implementa
normalización de adquisiciones, ciclos, ingresos extraordinarios ni series
ajustadas por inflación. Un histórico corto produce menos observaciones, no
cinco años inventados.

**Márgenes.** Por cada métrica se alinean métrica/ingresos, se exigen ingresos
positivos y un cociente finito estrictamente entre `−2` y `2`. Se toman las últimas
cinco observaciones aceptadas, o la ventana configurada:

```text
margen_mediano = mediana(métrica / ingresos)
margen_conservador = margen_mediano × factor_margen, si la mediana > 0
margen_conservador = margen_mediano, si la mediana ≤ 0
base = último ingreso disponible × margen_conservador
```

Se conservan mediana, margen ajustado y cantidad/períodos realmente usados. Una
métrica sin datos o con base no positiva no produce un valor positivo. Los
límites de filtrado y el factor 0.8 son decisiones exploratorias; no se afirma
que 0.8 corrija todos los sesgos ni que el filtrado identifique extraordinarios.

## 4. Proyección, tasas y terminal — MET-02 y MET-06

Para cada proxy con base positiva:

```text
C0 = base
Ct = C(t−1) × (1 + g1), para años 1 a 5
Ct = C(t−1) × (1 + g2), para años 6 a N
PV_flujos = Σ[t=1..N] Ct / (1 + r)^t
PV_terminal = CN × múltiplo_terminal / (1 + r)^N
valor_total_proxy = PV_flujos + PV_terminal
```

Se usa cierre de cada año, sin convención de mitad de año. El terminal se aplica
a la métrica proyectada en **N**, no en N+1; no es crecimiento perpetuo de Gordon.
`PV flujos` representa aquí métricas proyectadas, no caja libre demostrada.

| Proxy | Tasa `r` | Conversión a acción |
| --- | --- | --- |
| FCL | `tasa_descuento` del accionista | `valor_total_proxy / acciones` |
| NOPAT | `descuento_empresa` | `(valor_total_proxy − deuda_neta) / acciones` |
| EBITDA ajustado | `descuento_empresa` | `(valor_total_proxy − deuda_neta) / acciones` |
| Utilidad neta | `tasa_descuento` del accionista | `valor_total_proxy / acciones` |

La teoría exige consistencia entre flujos y destinatario de la tasa, además de
moneda y tratamiento nominal/real. Esa es la razón de separar parámetros; hacerlo
no convierte una métrica incompleta en FCFF/FCFE. Véanse las
[notas de Damodaran sobre tasas](https://pages.stern.nyu.edu/~adamodar/pdfiles/eqnotes/dcfrates.pdf).

La UI permite editar ambas tasas, inicialmente 10 %. Para consumidores anteriores,
`tasa_descuento_empresa=None` hereda la tasa del accionista; el resultado registra
ambas tasas efectivas. No se calcula un WACC, ni se comprueba automáticamente su
consistencia con moneda, riesgo o apalancamiento. La CLI conserva sus parámetros
existentes y usa la configuración predeterminada.

Los múltiplos se aplican a **la métrica de cada proxy**, después de los ajustes y
del factor de margen. Los predeterminados son 12x para FCL/NOPAT/EBITDA ajustado y
15x para utilidad neta. Son supuestos editables heredados, sin una selección de
comparables contemporáneos ni una fuente empírica que los justifique para cada
empresa. Deben revisarse antes de interpretar un resultado. Puede dominar el
terminal aunque los cálculos no den error; no se publica un intervalo de confianza.

Las tasas deben ser finitas y mayores que −1, el horizonte entero positivo y los
múltiplos positivos. La validación matemática permite casos como descuento cero
para conciliación; no los recomienda como hipótesis de mercado. Desbordamientos,
capital por acción no positivo o acciones no positivas producen ausencia, no
valores infinitos ni precios negativos presentados como estimaciones utilizables.

## 5. Balance y acciones — MET-08

Se selecciona el último valor disponible de cada partida. No se presume cero
cuando el balance o sus fallbacks no entregan deuda o efectivo:

- Deuda o efectivo desconocidos: preservar `None`; deuda neta desconocida; excluir
  NOPAT/EBITDA ajustado. FCL/utilidad neta pueden mantenerse si sus datos sirven.
- Ambos valores confirmados en cero: deuda neta cero; ambos proxies de empresa
  pueden calcularse.
- Períodos de deuda/efectivo identificados e iguales: conciliar `deuda − efectivo`.
- Fechas diferentes, o una conocida y otra desconocida: preservar importes y
  fechas pero bloquear la conciliación y los dos proxies de empresa.
- Ambos importes conocidos sin fecha verificable: aceptar una conciliación
  **provisional**, conservar períodos desconocidos y marcar `REVISAR`.

La última política permite usar `info.totalDebt`/`info.totalCash` de forma visible
sin fabricar fechas. No equivale a garantizar simultaneidad. Los importes de
`info` se interpretan en moneda financiera, como los estados: debe comprobarse
esa hipótesis si se usa un proveedor con otras convenciones.

No se reconcilian fecha de acciones y fecha de balance, dilución futura, clases
accionarias, participación minoritaria, deuda fuera de balance, pensiones ni
ajustes de ADR. El cociente capitalización/precio es una estimación dependiente
de esos dos datos, no un conteo auditado. Se registra su ruta y la fecha de
acciones sólo cuando corresponde a una serie fechada. Precio, estados y acciones
pueden proceder de momentos distintos; un timestamp de descarga no elimina esa
limitación.

## 6. Aplicabilidad por clase — MET-09

La clasificación automática es una política prudente del proyecto, no un dictamen
sectorial. Usa `quoteType`, `sector`, `industry`, nombre corto y largo:

| Clase | Regla | FCL | NOPAT | EBITDA ajustado | Utilidad neta |
| --- | --- | --- | --- | --- | --- |
| `OPERATIVA` | Sector identificado que no cae en exclusiones, o `quoteType=EQUITY` | Proxy condicionado a datos | Proxy condicionado a datos/balance | Proxy condicionado a datos/balance | Proxy condicionado a datos |
| `FINANCIERA` | Texto financial, bank, insurance, capital markets, credit services, asset management | Excluido | Excluido | Excluido | Excluido |
| `REIT_FIBRA` | REIT/FIBRA en sector, industria o nombre | Excluido | Excluido | Excluido | Excluido |
| `NO_OPERATIVA` | ETF, MUTUALFUND, INDEX, CRYPTOCURRENCY, CURRENCY o FUTURE | Excluido | Excluido | Excluido | Excluido |
| `NO_CLASIFICADA` | Información insuficiente para las reglas anteriores | Excluido | Excluido | Excluido | Excluido |

En bancos/aseguradoras, deuda, regulación y reinversión tienen particularidades
que requieren un modelo específico. Que la utilidad neta sea informativa no
justifica tratarla sin ajustes como caja distribuible. Véanse
[características de firmas financieras](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/littlebook/financialsvccompanies.htm)
y [reinversión regulatoria](https://pages.stern.nyu.edu/adamodar/New_Home_Page/littlebook/bankvaluedriver.htm).

Los vehículos inmobiliarios requieren métricas y conciliaciones específicas;
Nareit publica una definición de [FFO](https://www.reit.com/glossary/funds-operation-ffo)
y advierte que [AFFO](https://www.reit.com/glossary/adjusted-funds-operations-affo)
no tiene una definición universal. Este proyecto no las implementa. La exclusión
de financieras y REIT/FIBRA es una restricción del producto, no una afirmación de
que esas empresas no puedan valorarse.

Las reglas de texto pueden fallar en conglomerados, datos ausentes o nombres
ambiguos. Un `EQUITY` con sector ausente se trata como operativa de forma
provisional según el tipo de instrumento, sin auditar su negocio. Se conserva la
clase para revisión. Los datos históricos pueden seguir mostrándose cuando hay
monedas verificables; tener un gráfico no habilita un modelo excluido.

## 7. Agregación y diagnósticos — MET-10

La mediana es la mediana aritmética de los **valores por acción positivos,
disponibles y aplicables**, después de las exclusiones. Se publican número e
identificadores de proxies incluidos y motivos de exclusión por modelo.

- Cero proxies: mediana y upside ausentes.
- Uno: la mediana coincide con ese único proxy; estado `REVISAR`.
- Dos o más: mediana de los disponibles; con cantidad par se promedian los dos
  centrales. No se rellenan proxies ausentes con cero ni con el objetivo de analistas.

Los cuatro comparten datos, crecimiento, márgenes y otras hipótesis. No son
cuatro observaciones independientes; su mediana no representa consenso externo,
probabilidad de rentabilidad, validación cruzada ni una recomendación.

El upside es `valor / precio − 1`, si ambos son finitos y el precio es positivo.
Es diferencia relativa frente al precio adquirido, sin dividendos, plazo de
inversión, comisiones, impuestos o probabilidad de ocurrencia.

La prioridad de estados es:

1. `ERROR`: una excepción impidió completar el análisis del ticker; se preserva
   el contrato tabular y el mensaje.
2. `DATOS INCOMPLETOS`: falta precio, acciones, ingresos actuales o FX verificable.
3. `REVISAR`: menos de dos proxies, deuda neta no conciliable, conciliación
   provisional sin fechas o clase excluida.
4. `OK`: no se cumple una condición anterior. Sólo acredita disponibilidad según
   estas reglas; no califica la inversión ni valida sus hipótesis económicas.

Los motivos por proxy y las notas complementan el estado; el número de proxies
no sustituye la revisión del balance ni la revisión metodológica.

## 8. Divisas — MET-11

El FX representa **unidades de moneda de cotización por una unidad de moneda
financiera**. Se usa último cierre disponible en una consulta de cinco días al
par directo; si falta, recíproco del inverso. Debe ser finito y positivo.
Una identidad de monedas conocidas tiene factor 1. Moneda ausente no se infiere
a USD ni a la otra moneda.

Si no se puede verificar la conversión:

- Conservar precio y objetivo, adquiridos en moneda de cotización.
- Dejar vacíos los importes convertidos, valoraciones y agregados afectados.
- Marcar datos incompletos y explicar el bloqueo.
- Devolver históricos financieros vacíos para no rotular importes mezclados.

Se convierte cada serie por el **mismo factor adquirido**, no por tipos históricos
anuales. Es una traducción de unidades para comparación, no una reconstrucción
contable de estados convertidos ni una proyección macroeconómica. No se usan
curvas futuras de divisa ni se calibra automáticamente inflación/moneda de tasas.
El soporte previsto es cotización y estados en unidades monetarias compatibles;
subunidades de cotización, ADR y otras convenciones requieren revisión manual.

El caché de FX sigue siendo por par, sin TTL propio, y guarda fallos como `None`.
La traza conserva fecha del cierre y adquisición del FX cuando se conoce; usar
el caché no renueva su fecha. Para caché suministrado sin metadata no se inventa
una adquisición. El caché puede quedar obsoleto durante un proceso prolongado;
reiniciar el proceso lo vacía. Los cachés de Streamlit mantienen sus TTL de
análisis/estados de una hora y precio histórico de media hora.

## 9. Objetivo de analistas — MET-12

Se intenta `analyst_price_targets.mean`, luego `median`; después
`info.targetMeanPrice` y `targetMedianPrice`. Sólo se admite un objetivo finito y
positivo. La traza registra ruta y estadístico (`mean`/`median`), además de
`numberOfAnalystOpinions` si el proveedor entrega un entero positivo. Esta es
cobertura reportada en `info`; no se garantiza que corresponda exactamente a la
misma muestra del objetivo.

La [API documentada de yfinance](https://ranaroussi.github.io/yfinance/reference/api/yfinance.Ticker.get_analyst_price_targets.html)
expone precios current/low/high/mean/median, sin fecha ni horizonte en ese
contrato. Por ello ambos quedan desconocidos; no se fabrica un horizonte de
12 meses ni una fecha de consenso a partir de la descarga. En la UI se conserva
«objetivo de analistas», sin afirmar que siempre es promedio. No participa en la
mediana ni valida la metodología del proyecto.

## 10. Contrato, versiones y trazabilidad

`DatosEmpresa.trazabilidad` contiene un `TrazabilidadDatos` sin objetos de yfinance.
`ResultadoAnalisis` asocia principal, detalle, configuración, diagnósticos y
traza estructurada. El motor no consulta relojes ni redes: la fecha de adquisición
la proporciona el adaptador. Un proveedor sintético sin metadata conserva
procedencia/fechas desconocidas; no se atribuye falsamente a Yahoo.

| Dato de traza | Semántica |
| --- | --- |
| Fuente de datos / obtenido en UTC | Proveedor y momento de completar la adquisición del snapshot; no fecha de mercado ni instante atómico de todos los campos |
| Fuente/fecha de precio | Ruta efectiva; fecha sólo si se obtiene de la observación histórica usada. No se asigna `regularMarketTime` de otra ruta a `fast_info` |
| Objetivo / cobertura / fechas | Estadístico y cobertura disponible; fecha/horizonte desconocidos cuando la API no los da |
| FX y sus fechas | Par directo/inverso o identidad; adquisición y cierre originales del dato cacheado |
| Período ingresos/deuda/efectivo | Fecha del último valor utilizado; no se convierte un índice numérico en un año ficticio |
| Períodos por modelo | Fechas de las observaciones que realmente pasaron alineación, filtros y ventana de margen; no todas las columnas originales |
| Fuentes por métrica | Campo directo o fórmula derivada con los alias efectivos, además de ingresos, CapEx, impuestos y procedencia de acciones |
| Crecimiento/impuestos utilizados | Fallback o método, valor y períodos disponibles; una lista vacía no demuestra que existieran observaciones |
| Configuración efectiva | JSON de todos los parámetros, incluyendo la tasa de empresa opcional; las dos tasas resueltas se publican aparte |
| Modelos incluidos/excluidos | Identificadores, número y motivos. La traza estructurada añade tasa, fuente, períodos y aplicabilidad por modelo |

No se infieren fechas no disponibles. Se conservan fechas financieras como
`YYYY-MM-DD` y timestamps con zona cuando la fuente la entrega. «Obtenido en UTC»
no representa un cierre bursátil. Los gráficos del detalle pueden requerir otra
consulta, con su propio caché; no son un snapshot atómico idéntico al del análisis.

El contrato `2.0` conserva el orden y nombres de los primeros **19 campos de
resumen y 45 de detalle** como alias heredados. Añade cinco campos de resumen
(**24**) y 28 de detalle (**73**). Un consumidor debe usar nombres y versión, no
asumir que la longitud permanece igual. Los aliases «Valor intrínseco EBIT» y
«Mediana de modelos» ya no son las etiquetas visibles; se traducen centralmente
en `presentacion/etiquetas.py`. Sus significados efectivos son proxy NOPAT y
mediana de proxies. «CAGR histórico ingresos» se muestra como crecimiento bruto
utilizado porque puede contener un fallback.

Excel conserva las siete hojas `Resumen`, `USA`, `MX`, `Detalle`, `Supuestos`,
`Universo`, `Fuentes`. Las tres primeras y `Detalle` usan etiquetas visibles;
`Supuestos` registra versiones, tasas y tratamiento de proxies. La procedencia
financiera vive en `Detalle`; `Fuentes` conserva las referencias del catálogo y
no debe confundirse con evidencia actual de cada cifra. Filas de error llevan
versiones y ausencias explícitas; un libro vacío conserva encabezados.

Cambios futuros de ecuaciones, selección económica o elegibilidad deben aumentar
la versión metodológica. Un cambio incompatible de esquema exige versión de
contrato nueva y explicación de migración. No reutilizar `proxies-1.0` para un
FCFF/FCFE completo con hipótesis distintas.

## 11. Ejemplo conciliado y migración de pruebas

[El ejemplo independiente](../examples/README.md) incluye datos ficticios,
esperados manuales y una segunda implementación con `Decimal` y anualidad
cerrada. Se ejecuta sin Yahoo, produce conciliación CSV y el Excel del motor,
y comprueba cuatro resultados: **52, 44, 44 y 48 USD por acción**; mediana **46**,
upside frente a 40 de **15 %**. También se comprueba descuento de empresa de 10 %
con descuento de accionista de 0 %: proxy NOPAT **31.06536438767844**.

Se conserva `tests/fixtures/resultados_f1.json` sin regenerar. La comparación de
sus ocho escenarios transforma explícitamente la referencia antigua:

| Cambio | Decisión | Efecto esperado respecto a F1/F2 |
| --- | --- | --- |
| FX ausente | MET-11, F3-R04 | De 1 artificial y cifras calculadas a FX/valoraciones ausentes, cero proxies y datos incompletos |
| Balance ausente | MET-08, F3-R05 | Sin deuda/efectivo ni fallback, sólo FCL/neto pueden sobrevivir; no deuda cero fabricada |
| Financiera | MET-09, F3-R06 | Cuatro proxies excluidos, cero en mediana, `REVISAR`; no priorización automática de utilidad neta |
| Fechas de balance distintas | MET-08 | No restar saldos no comparables; dos proxies de empresa excluidos |
| Fuente en proveedor manual | F3-R09 | `Campo:` o `Calculado:`; ya no «Yahoo» inferido del nombre contable |
| Fallback de crecimiento | MET-07 | Nota usa el valor configurado; deja de fijar «3 %» aunque cambie la configuración |
| Nombres y columnas | F3-R03/R08 | Prefijos heredados preservados, extensiones y etiquetas visibles explícitas |
| Tasas separadas | MET-02 | Con tasa de empresa omitida se conserva aritmética previa; al especificarla cambia sólo el descuento de los proxies de empresa |

Todos los campos heredados de esos snapshots siguen comparándose, con migración
explícita por caso y tolerancia `1e-12`. Las columnas nuevas, fuentes, fechas,
políticas y presentación tienen pruebas propias; no se omiten campos para tapar
fallos. El [registro TDD de F3](TDD_F3.md) contiene los ciclos y la verificación.

## 12. Límites y continuidad

F3 entrega una metodología explícita y restringe resultados que antes aparentaban
ser utilizables. No entrega calibración empírica, backtesting, recomendación de
compra, valoración sectorial completa ni comprobación de estados auditados.

Antes de ampliar el método se necesita una especificación propia: conciliación
FCFF/FCFE y financiación, reinversión consistente con crecimiento, tasas/múltiplos
justificados, acciones diluidas/ADR, modelos bancarios/inmobiliarios y revisión
de FX histórico/subunidades. Cada cambio debe seguir TDD y preservar una decisión
versionada, sin ampliar silenciosamente los supuestos de esta versión.

F4 (instalación y herramientas) y F5 (presentación/demo del repositorio) permanecen
pendientes. F3 no requiere backend, despliegue ni dependencias adicionales.
