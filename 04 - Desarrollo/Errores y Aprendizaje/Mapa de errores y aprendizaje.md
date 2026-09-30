---
tipo: indice-aprendizaje
fecha: 2026-09-29
---
# Mapa de errores y aprendizaje

La revisión de la copia actual reúne **27 fichas de problemas y riesgos y 6 fichas de mejoras** (E27 se agregó al preparar Git). Cada una explica el comportamiento, su causa, dónde leer el código, cómo corregirlo y cómo comprobarlo. Los riesgos de hardware no se presentan como fallos físicamente reproducidos. Algunos efectos se relacionan: no sumar los productos afectados de distintas fichas como si fueran casos independientes.

El proyecto es una oportunidad para aprender. Empieza por [[Ruta de aprendizaje y correccion]], consulta [[Conceptos para entender los errores]] y registra cada cambio con [[Como registrar una correccion]]. Los detalles de las mediciones están en [[Evidencias y alcance de la revision]].

**P1:** resolver antes de confiar en impresiones operativas: puede perder datos, elegir otro producto o impedir el envío. **P2:** corregir consistencia, recuperación y comportamiento. **P3:** mejorar mantenimiento y experiencia. La prioridad expresa impacto; el orden de aprendizaje comienza con cambios más pequeños.

Todas las correcciones de código descritas están pendientes. La eliminación de la copia antigua y artefactos ya se hizo; M06 plantea cómo evitar que vuelva a ocurrir.

| Ficha | Prioridad | Qué se comprobó |
|---|---|---|
| [[E01 - Un barcode identifica dos productos]] | P1 | reproducido en software |
| [[E02 - La proteccion de prefijos bloquea identificadores validos]] | P1 | reproducido en software |
| [[E03 - La etiqueta impresa no vuelve al mismo producto]] | P1 | reproducido en software |
| [[E04 - Los escaneos pendientes se sobrescriben]] | P1 | confirmado por lectura del codigo |
| [[E05 - Las dimensiones guardadas no cambian la etiqueta]] | P2 | confirmado por lectura del codigo |
| [[E06 - El texto puede convertirse en comandos ZPL]] | P2 | reproducido en software |
| [[E07 - Enviado no significa impreso]] | P2 | confirmado por lectura del codigo |
| [[E08 - El ancho de Code 128 no coincide con el comando emitido]] | P1 | contrato oficial y calculo en software |
| [[E09 - Los lotes USB exceden el limite de argumentos]] | P1 | tamaño medido y contrato oficial |
| [[E10 - La firma nativa de StartDocPrinter es incorrecta]] | P2 | contrato oficial contrastado con codigo |
| [[E11 - El helper no comprueba todos los bytes escritos]] | P2 | riesgo identificado en codigo |
| [[E12 - Leer settings acepta objetos incompletos]] | P2 | reproducido en copia temporal |
| [[E13 - La pantalla oculta el error de carga]] | P2 | confirmado por flujo de renderizado |
| [[E14 - El campo manual de impresora queda inaccesible]] | P2 | confirmado por lectura del codigo |
| [[E15 - El estado no sigue el transporte seleccionado]] | P2 | confirmado por lectura del codigo |
| [[E16 - Las consultas simultaneas no comparten el proceso]] | P2 | reproducido con proceso simulado |
| [[E17 - Guardar settings puede dejar el archivo incompleto]] | P2 | riesgo identificado en codigo |
| [[E18 - USB y TCP no usan la misma codificacion]] | P2 | bytes y contrato verificados - papel pendiente |
| [[E19 - Los nombres largos pueden superponerse]] | P2 | contrato y catalogo verificados - papel pendiente |
| [[E20 - La app puede escuchar fuera del puesto local]] | P2 | configuracion y contrato verificados |
| [[E21 - Estado y envio pueden usar colas diferentes]] | P2 | confirmado por lectura del codigo |
| [[E22 - Un timeout puede causar etiquetas duplicadas]] | P2 | riesgo identificado en flujo de envio |
| [[E23 - Guardar el nombre de empresa no cambia la plantilla]] | P3 | confirmado por lectura del codigo |
| [[E24 - La busqueda oculta que faltan resultados]] | P3 | confirmado por lectura del codigo |
| [[E25 - El aviso de EAN incorrecto no describe lo que se imprime]] | P3 | confirmado por codigo y revision del catalogo |
| [[E26 - Los plugins de Obsidian contienen HTML en lugar de codigo]] | P2 | contenido de archivos confirmado |
| [[E27 - Una clave de Share Note esta publicada en el repositorio]] | P1 | confirmado en el repositorio publico |
| [[M01 - El historial no permite reconstruir la etiqueta]] | P3 | mejora identificada en codigo |
| [[M02 - Las pruebas no cubren el ciclo completo ni tienen comando unico]] | P2 | scripts existentes revisados |
| [[M03 - Preparar control de versiones para aprender]] | P2 | no se encontro repositorio Git utilizable |
| [[M04 - Mantener la documentacion sincronizada]] | P2 | contradicciones documentales confirmadas |
| [[M05 - Verificar el resultado con hardware real]] | P1 | validacion fisica de hallazgos pendiente |
| [[M06 - Evitar copias y artefactos como fuentes de verdad]] | P3 | limpieza realizada - prevencion pendiente |

Los antecedentes corregidos anteriormente se conservan en [[Antecedentes y errores historicos]]. Vuelve a [[Inicio]] para navegar el resto del proyecto.
