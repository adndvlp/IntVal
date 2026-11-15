# UI-1 — Composición y apariencia en el frontend real

Fecha: 2026-11-15. Base: `f04b8b8` más el anexo local. Alcance autorizado: primer incremento de [SDD_UI.md, 16.3](SDD_UI.md#163-secuencia-de-implementación).

## Resultado

UI-1 integra el diseño en Astro/React: `/` abre el analizador directamente y `/app/` conserva compatibilidad, incluidos `?fuente=demo` y `?fuente=market`. La composición usa navegación lateral en escritorio y cabecera con enlaces que se redistribuyen en pantallas estrechas. El estado de fuente procede del formulario real; Resultados sólo se enlaza cuando existe un snapshot.

Se incorporan tokens de superficie, texto, controles, estados y gráficas; escena SVG estática, bordes y sombras Liquid Glass; seis paletas, color propio y modo claro/oscuro. El formulario se usa directamente también en móvil, sin una pantalla modal previa. La primera visita y el cambio a demo dejan la selección vacía y no crean análisis. La recuperación de trabajos guardados continúa automáticamente.

Cómo se calcula tiene cinco apartados visibles, texto de lectura de 18 px, columna acotada y enlace a la metodología completa. El enlace del pie tiene una superficie estable y color de texto ajustado a la paleta.

## Ciclo de pruebas

1. Las pruebas nuevas de apariencia fallaron inicialmente al no existir el módulo de producción.
2. La regresión de entrada falló porque abrir demo seleccionaba sus tres empresas e iniciaba un POST automáticamente. Se retiró exclusivamente ese efecto; se conservaron las ramas que recuperan IDs y solicitudes pendientes.
3. Las pruebas del HTML compilado fallaron ante la landing anterior. Se reemplazó esa entrada por un componente compartido entre `/` y `/app/`.
4. Se adaptaron las preparaciones de pruebas para seleccionar empresas e iniciar explícitamente el análisis. Recuperación, aceptación tardía, cancelación, desconexión, recarga y expiración conservan sus aserciones.
5. Las pruebas anteriores de landing se sustituyeron por contratos de rutas, navegación, entrada directa y apariencia. Los tests del anexo se conservan y el anexo no se modifica.

## Apariencia y persistencia

| Aspecto                  | Implementación y comprobación                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paletas                  | Océano, Bosque, Lavanda, Ámbar, Rosa y Grafito; color personalizado con `input type=color`                                                          |
| Independencia            | Claves `intval-liquid-glass-palette-v1` y `intval-liquid-glass-scheme-v1`; ningún cambio en borrador financiero, sesión de análisis o transporte    |
| Modo inicial             | Sistema cuando no existe preferencia; `color-scheme` en raíz y meta                                                                                 |
| Restauración             | Script inline anterior a CSS restaura únicamente un modo válido; controles completan la restauración de apariencia                                  |
| Sistema y pestañas       | Cambio de sistema, override persistente y sincronización del modo mediante `storage`; volver al esquema del sistema elimina el override             |
| Fallos de almacenamiento | Preferencias inválidas vuelven al valor inicial; bloqueo de lectura/escritura no impide cambiar la apariencia durante la visita                     |
| Contraste                | Texto/enlaces/botón en todas las paletas y colores extremos; tokens base, foco, bordes de control y series en ambos modos, con y sin `light-dark()` |
| Controles                | Paleta cierra al pulsar fuera y con Escape; conserva foco y se incorpora al diálogo activo cuando lo hay                                            |
| Compatibilidad           | Valores base más `@supports`, controles nativos, colores forzados y transparencia reducida                                                          |

La apariencia se aplica sobre el DOM y tokens CSS, sin añadir dependencias, pedir datos financieros, recrear el estado React ni recalcular valoraciones. No hay bucle de animación. Las gráficas conservan la carga diferida y sus series/datos; sus colores pasan a tokens compatibles con ambos modos.

La tipografía declara Source Sans 3 e IBM Plex Mono con alternativas de sistema. Esta integración no añade una descarga de fuentes ni presupone que estén instaladas. Su render final, como el resto de la apariencia, requiere revisión en UI-5.

## Verificación local

Comandos ejecutados desde `frontend/`:

| Comando                | Resultado                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `npm run test:unit`    | **70 aprobadas**, 12 archivos; incluye 5 pruebas nuevas de apariencia                         |
| `npm run test:shell`   | **69 aprobadas**; incluye 58 pruebas del anexo y 11 de shell, rutas y contraste de producción |
| `npm run test:assets`  | 2 pruebas del medidor aprobadas y presupuestos del build cumplidos                            |
| `npm run check`        | 0 errores, 0 advertencias, 0 sugerencias                                                      |
| `npm run lint`         | Aprobado                                                                                      |
| `npm run format:check` | Aprobado                                                                                      |
| `npm run build`        | 4 páginas compiladas                                                                          |

Cobertura de componentes y estado: **93.21 % sentencias, 86.01 % ramas, 91.63 % funciones y 95.25 % líneas**; supera los mínimos vigentes del 85 %.

La raíz tiene ahora el mismo presupuesto de JavaScript que `/app/` (300 KiB gzip), porque ambas rutas ejecutan el analizador. La ruta de explicación conserva 50 KiB; CSS conserva 50 KiB por ruta y sigue prohibida la carga inicial del módulo de gráficas. El build de UI-1 mide 108.97 KiB de JS inicial y 10.41 KiB de CSS en cada entrada del analizador; Cómo se calcula carga 2.56 KiB de JS y 6.16 KiB de CSS. El informe se obtiene con `test:assets`. El cambio de límite refleja el cambio de función de la raíz, no una landing más pesada.

No se han cambiado archivos Python, versiones de dependencias, resoluciones, endpoints, métodos financieros, parámetros de servicio o contrato Excel. Por ello no se repitió la suite Python para este incremento. No se han hecho commit, push ni despliegue.

## Revisión visual y límites

La colección Playwright enumera correctamente 60 casos en 6 archivos para los seis proyectos; enumerarlos no los ejecuta. Los escenarios se adaptan a la entrada explícita y al formulario directo. Se añaden persistencia de apariencia entre rutas/recarga, ausencia de POST al personalizar, modos, cuatro anchuras y texto al 200 %. Las pruebas visuales usan nombres nuevos `ui1-*`: las referencias F10 se mantienen como evidencia histórica y no se aprueban para este diseño.

**Navegador, capturas nuevas, auditoría renderizada y métricas de laboratorio del diseño conectado no se han ejecutado en esta sesión:** el entorno restringe el lanzamiento de navegadores y los puertos locales. Los tests DOM y las ratios de tokens no sustituyen esa evidencia. Su revisión continúa en UI-5; no se atribuye aquí un resultado a Chrome, Firefox, WebKit o al CI remoto. El capturador queda preparado para guardar imágenes UI-1 separadas de las históricas, únicamente tras un E2E satisfactorio.

UI-1 no completa la migración del HTML: el catálogo existente sigue pendiente de UI-2; resultados, detalle, ajustes e historial de UI-3; conciliación de integración/Excel de UI-4; óptica y validación del conjunto de UI-5. No se añaden enlaces a un historial todavía inexistente ni se trasladan temporizadores o datos simulados al transporte real.

El anexo normativo conserva su SHA-256:

```text
06694e7ba2628dbb0910243e72f80118f3caaa6c861e1ab505905fb16fafdb8f
```

Continuación: UI-2 según la solicitud del usuario, conservando los trabajos, contratos y mecanismos de recuperación existentes.
