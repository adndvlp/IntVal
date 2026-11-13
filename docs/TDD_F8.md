# F8 — API de análisis, trabajos, cachés, históricos y Excel

Fecha: 2026-11-13. Base: `4dedb81`, cierre de F7. Alcance: sección 18.3 de
[SDD_WEB.md](SDD_WEB.md). Implementación local; sin commit, push ni despliegue.

## Línea base y método

Antes de implementar: **396 pruebas Python, dos warnings, 97.90 % de cobertura
combinada de líneas y ramas**, en 62.26 s. Se conserva el umbral de 85 % y todo
el conjunto anterior, incluidos AppTest, CLI, oráculos y Excel.

Se escribieron pruebas de comportamiento antes de cada incremento. Los casos
que verificaron directamente un comportamiento ya correcto se registran como
regresión; no se provocó un RED artificial. No se generaron nuevos valores
esperados desde el motor ni se sobrescribieron fixtures históricas.

## Ciclos RED → GREEN

| Incremento | RED observado | Cambio y verificación |
| --- | --- | --- |
| Solicitud y DTO | 13 fallos por ausencia de SolicitudAnalisis/empresa_a_dto | UUID canónico, símbolos normalizados, validación estricta, cuatro proxies, mediana, analistas y mapeo explícito de los 73 campos; 13 pasan |
| Adquisición aislada | Dos pruebas sin módulo de ejecución | Procesos spawn propios, IPC limitado, watchdog y recolección; el proveedor bloqueado termina y otro proceso obtiene el resultado esperado |
| Gestor | Seis errores por ausencia del gestor | Cola serial, snapshots, idempotencia, cancelación, cursores, TTL y caché; seis pasan |
| Operaciones HTTP | 12 fallos por operaciones/inyección todavía inexistentes | Lifespan, rutas reales, errores uniformes, históricos, límite ASGI y exportación de snapshot; 12 pasan |
| Cliente | Una prueba rechazaba las capacidades aditivas de F8 | Aceptar identificadores de capacidad de texto y consumir sólo catálogo; también rechazar capacidades numéricas; diez pruebas del cliente pasan |
| Límites y cancelación | Dos fallos: ID cancelado seguía en deque y deadline tenía causa genérica | Retirar pendientes cancelados; código JOB_DEADLINE_EXCEEDED; nueve pruebas del gestor pasan |
| Finalización | El histórico de la demo con procesos reales no devolvía items | El estado terminal se confirma después de cerrar el proceso y liberar el carril; se elimina el 503 por esa carrera |
| Queries del snapshot | financials aceptaba supuestos adicionales con 200 | Modelo de query vacío; históricos financieros y Excel rechazan parámetros ajenos con 400 |
| Años financieros | La prueba exigía year y recibía una fecha inventada | Preservar el año entregado por el servicio; precios sí conservan date; sin inventar el día del período |
| Observabilidad | Faltaban correlación y duración en la transición terminal | ID técnico, estado, procesados/total y duración monotónica en logs, sin payload financiero |
| Moneda histórica con FX | El histórico convertido a USD se etiquetaba MXN | Publicar moneda de cotización, que es la unidad ya transformada por el servicio; sin aplicar otra conversión |
| Retención y reloj UTC | Un salto hacia atrás desalojaba el terminal más reciente | Ordenar desalojos por instante monotónico, igual que los TTL; el ajuste del reloj civil no determina antigüedad |

Refactorización en verde: Ruff, DTOs separados del dominio, errores públicos
centralizados, transformaciones históricas y exportación aisladas del gestor.
La prueba adicional del Excel se ajustó a sus encabezados reales de la fila 3;
el título de la fila 1 no se trató como encabezado tabular. No cambió el exportador.

## Evidencia funcional y contratos

- Normalización conserva orden y deduplica antes de contar. Se caracterizaron
  los 604 símbolos; `PE&OLES.MX` exige admitir `&`, además de puntos y guiones.
  Se rechazan rutas, URLs, símbolos vacíos y longitudes superiores a 32.
- Fuente obligatoria, demo restringida a sus tres símbolos, nueve supuestos
  editables y configuración completa congelada. El mismo UUID/payload obtiene
  el mismo trabajo, también bajo concurrencia; un payload diferente produce 409.
- Un worker, dos pendientes, publicación append-only, revisión monotónica y
  páginas de hasta 100. Eventos/barriers coordinan las carreras de las pruebas.
  Cancelar termina la empresa actual sin comenzar la siguiente; el terminal
  confirmado prevalece en reintentos.
- Un lote con todas sus filas ERROR termina completed y conserva descarga.
  Infraestructura, deadline y presupuesto fallan el trabajo, conservando los
  parciales y sin fabricar filas para los símbolos restantes.
- Cachés separadas por recurso, fuente/versión, ticker y configuración o período.
  Un hit conserva computed_at/expires_at y las fechas originales de precio/FX.
  ERROR y excepciones históricas no se cachean. Los estados financieros
  DATOS INCOMPLETOS/REVISAR conservan su semántica.
- TTL monotónico, retención terminal, tombstones limitados, 410 conocido y 404
  tras pérdida/reinicio. Se comprueba presión de memoria sin desalojar activos.
- Carriles de adquisición acotados por fuente: un recurso sin caché devuelve
  503/Retry-After si está ocupado; la demo dispone de un carril independiente
  del histórico de mercado. Un hit no requiere el carril.
- Históricos por empresa ya procesada y perteneciente al lote. Configuración
  aceptada, millones sin volver a dividir, márgenes como ratios, años ordenados,
  null para observaciones ausentes y rechazo de Infinity. Vacío válido y fallo
  del proveedor son respuestas diferentes; ninguno cambia el resumen.
- Se reabren siete hojas de Excel y se concilian importes y tasa del análisis
  anterior después de crear otro lote. La descarga no vuelve a consultar al
  proveedor. El temporal se elimina antes de transmitir, también ante errores
  de escritura; el nombre demo y los registros ERROR se conservan.
- DTOs conciliados contra los escenarios/oráculos anteriores y la migración
  explícita F3, sin cambiar los JSON originales. La demo con procesos reales
  devuelve 116.1879930510067 USD y 209.138387491812 MXN como medianas.
- Liveness, readiness, metadatos y estado responden con un proveedor bloqueado.
  Se verifican límite del cuerpo antes de JSON, creación rechazada sin
  adquisición, CORS para POST y mensajes sin rutas/credenciales privadas.
- OpenAPI real de once rutas, tipos TypeScript regenerados y detección de drift.
  La creación/exportación del contrato no inicia hilos ni proveedores de mercado.

Pruebas principales: [DTOs](../tests/api/test_dtos_f8.py),
[gestor](../tests/api/test_gestor_f8.py),
[aislamiento](../tests/api/test_aislamiento_f8.py),
[HTTP](../tests/api/test_operaciones_f8.py) y
[contrato generado](../tests/api/test_contrato_archivo.py).

## I/O, procesos y recuperación

Se inspeccionó yfinance **1.5.1 instalado**, además del adaptador del repositorio.
PriceHistory.history tiene timeout=10 por defecto; YfData.get y get_raw_json
usan 30 s. La adquisición real incluye info/fast_info, estados, acciones,
históricos y FX; sus fallbacks y llamadas múltiples impiden presentar esos
defaults como un plazo total fiable de una empresa.

La API ejecuta toda adquisición en un proceso spawn propio. Por lote usa un
proveedor persistente durante sus tickers, con caché FX nueva. Un cache hit
financiero conserva el FX anterior y no lo reetiqueta como reciente. Las
instancias Yahoo de trabajos distintos no usan CACHE_FX de la CLI.

El watchdog de cada operación tiene **60 s** por defecto y mata el proceso al
agotarse, incluso si el padre estaba leyendo una respuesta parcial del pipe.
El padre recolecta al hijo y falla el trabajo con ACQUISITION_FAILED; el worker
puede tomar el siguiente. IPC acepta hasta **4 MiB** de respuesta y sólo objetos
producidos por el hijo propio; nunca pickle recibido por HTTP. El proveedor de
prueba bloquea una llamada durante 120 s: con deadline de prueba de 2 s el
proceso termina y el siguiente análisis se completa, sin esperar esos 120 s.

Los históricos usan procesos propios con el mismo límite y se cierran en finally.
Los carriles limitan las adquisiciones simultáneas a una por fuente. El cierre
del runtime detiene admisión, cancela pendientes y cierra los ejecutores propios.
No queda un thread de proveedor abandonado después de devolver un timeout.

El plazo global de **1800 s desde el inicio** se comprueba entre empresas y
produce JOB_DEADLINE_EXCEEDED. Es cooperativo; cancelar tampoco promete cortar
instantáneamente la consulta actual. El watchdog resuelve el bloqueo de I/O,
independientemente de ese plazo del lote. No se hicieron peticiones reales a Yahoo.

## Presupuesto medido

El límite de 64 MiB se aplica a una estimación explícita: bytes UTF-8 de JSON del
contenido normalizado de la solicitud (fuente, tickers y configuración efectiva)
y filas almacenadas, más payloads duplicados en las cachés.
Se incluyen registros de dominio y sello de cálculo. No es RSS ni incluye
overhead Python, índices/UUID y metadatos del registro, librerías nativas, procesos hijos, copias transitorias
o buffer del XLSX. Los registros y caches también tienen límites por cantidad.

Medición local del lote de tres empresas sintéticas, sin caché previa:

| Medida | Bytes |
| --- | ---: |
| Payload administrado de trabajo | 17388 |
| Payload de caché financiera | 16742 |
| JSON de estado | 1428 |
| JSON de resultados completos | 37068 |

La medición usa el proveedor demo, los defaults web y el mismo estimador del
gestor. Las medidas de estado/resultados usan json.dumps UTF-8 sin compresión;
no son tamaño garantizado de transferencia. El pico RSS, carga y capacidad de
un plan PaaS siguen en F10, sin atribuir esta cifra al consumo total del servicio.

## Comprobaciones finales

Entorno: macOS ARM64, CPython 3.12.2, Node 26.13.1 y npm 11.12.1. Se usan los
locks existentes; no se añaden dependencias ni se actualizan versiones.

| Comprobación | Resultado |
| --- | --- |
| Suite Python final | 458 pruebas, dos warnings, 95.28 % combinado de líneas/ramas; 92.71 s |
| Ruff lint/formato | Correctos |
| pip check | Sin requisitos incompatibles |
| OpenAPI --check y tipos sin drift | Correctos; regeneración determinista verificada |
| ESLint / Prettier / Astro check | Correctos; cero errores, warnings o hints de tipos |
| Vitest | 14 pruebas; 100 % líneas y 88.23 % ramas de la capa cubierta |
| Build Astro | Cuatro páginas estáticas; correcto |
| HTML compilado | Cinco pruebas; correctas |

No se repitieron navegador/capturas de F7: F8 no cambia la presentación. Se
verifican el cliente de capacidades y el build. Los ocho E2E de navegador siguen
en CI; no se atribuye a F8 una ejecución que esta sesión no realizó. TestClient
ASGI sí ejecuta el flujo real de API y procesos sin necesitar puertos TCP.
CI remoto del commit futuro y publicación son verificaciones independientes.

## Continuidad

La fase siguiente es **F9**, cuando se solicite: dashboard React e integración
de estos contratos, APP-01 a APP-18. El shell todavía no es el dashboard; no
se anuncia una interfaz nueva de análisis terminada. El arranque público sigue
en Streamlit hasta F11. readyz acredita el runtime API en F8; la comprobación
del build estático al servir la distribución corresponde a F11.

Se conservan metodología proxies-1.0, contrato 2.0 con 24/73 campos, motor,
proveedores existentes, catálogo, datos/ejemplos, CLI, capturas F7 y licencia.
Los trabajos son efímeros: usar **un proceso ASGI** por instancia, sin prometer
persistencia ni compartir IDs entre workers/réplicas independientes.
