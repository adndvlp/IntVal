# Capturas de la demo

Estado: **resumen y detalle capturados, revisados e incorporados al README**.
Ambas imágenes proceden de la aplicación real y de los datos sintéticos
versionados. No son reconstrucciones de la interfaz.

## Evidencia revisada

| Archivo | Estado | Revisión |
| --- | --- | --- |
| [demo-resumen.jpg](demo-resumen.jpg) | Aceptada | UI real con los tres casos, dos estados OK y uno incompleto; filtros, supuestos al 10 %/10 %, aviso sintético, referencia y botón de descarga visibles |
| [demo-detalle.jpg](demo-detalle.jpg) | Aceptada | DEMO-MX.MX: precio 200 MXN, mediana 209,14 MXN, metodología y cuatro gráficas completas de proxies, precio, estados y márgenes; fuente y referencia visibles en la barra lateral |

Procedencia en [captura-demo.json](captura-demo.json): dataset `demo-1.0`,
referencia **2025-01-03**, fuente Demostración y captura
**2026-11-13T04:55:44.765Z**. Viewports: resumen 1920 × 1080 y detalle
1920 × 1800. Ambas son JPEG, sin EXIF ni comentarios incrustados. No se encontraron rutas,
credenciales ni contenido personal en las imágenes revisadas.

El usuario ejecutó el script de captura sobre el árbol de F5 sin commit, basado
en `d90fc2a`. El script abrió Streamlit sólo en localhost, comprobó su health
check, cargó la demo, bloqueó solicitudes del navegador a hosts externos y cerró
sus propios procesos. No registró errores JavaScript. El registro del navegador
y la inspección visual son comprobaciones distintas: también se inspeccionaron
los archivos finales y se conciliaron sus cifras con el ejemplo público.

La primera captura de detalle fue rechazada porque sólo mostraba el comienzo
del título. Se corrigió el desplazamiento y se exigieron las cuatro gráficas
dentro del viewport ampliado antes de guardar. El usuario repitió la captura y
se aceptó tras revisión visual. Sólo se conservan las imágenes finales.
El script temporal no forma parte de las dependencias del producto; el
procedimiento manual siguiente permite repetir las capturas sin depender de él.

## Reproducir una captura real

1. Abrir la aplicación actual en un navegador y seleccionar **Demostración**, o
   usar un servicio preparado con `VALORACION_DEMO=1`.
2. Mantener los supuestos iniciales y los tres casos de `demo-1.0`, referencia
   2025-01-03. Comprobar que el aviso de datos sintéticos está visible.
3. Capturar el resumen y, por separado, el detalle de una empresa completa con
   sus cuatro gráficas. Registrar el símbolo que realmente aparezca.
4. Recortar únicamente elementos ajenos al producto, como la barra de direcciones
   o ventanas personales. Evitar secretos, rutas privadas y pestañas de otras apps.
5. Guardar imágenes optimizadas como `demo-resumen.jpg` y `demo-detalle.jpg`,
   inspeccionar ambas y añadir los enlaces al README.

Las capturas deben reflejar la UI real, no un diseño conceptual. Registrar
versión de datos, referencia, tamaño de viewport y fecha de captura junto a las
imágenes. La fecha de captura no sustituye la referencia histórica del dataset.
No afirmar una URL pública si la captura procede de una instancia de desarrollo.
