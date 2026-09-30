# Conceptos para entender los errores

Consulta este glosario mientras estudias [[Mapa de errores y aprendizaje]]. Los ejemplos describen decisiones que debes entender antes de implementar las propuestas.

| Concepto | Significado y relación con el proyecto |
|---|---|
| Tipo TypeScript | Describe lo esperado al compilar. `as AppSettings` no inspecciona ni arregla un JSON leído del disco. E12. |
| Validación en ejecución | Comprueba valores reales, rangos y campos con un esquema antes de usarlos. Un puerto inválido necesita un error entendible. |
| Mezcla superficial | `{...defaults, ...saved}` reemplaza objetos internos completos; no completa automáticamente sus campos faltantes. E12. |
| Identificador único | Una clave identifica una sola entidad. Coincidir con un barcode duplicado no permite elegir sin información adicional. E01. |
| Código interno | Identidad del producto dentro de esta aplicación; puede ser corta. No debe confundirse con un escaneo incompleto. E02. |
| EAN / UPC / Code 128 | Familias de códigos con reglas diferentes. Code 128 admite texto; no se debe tratar toda cadena numérica como EAN-13. |
| Dígito verificador | Detecta ciertos errores de lectura o transcripción. Corregirlo cambia el texto escaneado y exige conservar una relación con el producto. E03. |
| ZPL | Lenguaje de comandos de la impresora Zebra. `^FD` inicia datos y `^FS` termina el campo; un nombre puede interferir si no se escapa. E06. |
| Escape | Representar datos para que el receptor no los interprete como instrucciones. Debe hacerse según el campo y lenguaje, no con sustituciones improvisadas. |
| Byte y codificación | El texto se convierte en bytes mediante una codificación. UTF-8 y Latin-1 producen secuencias distintas para Ñ; la impresora debe interpretar la misma codificación. E18. |
| Base64 | Representación textual de bytes, aproximadamente un tercio mayor. No comprime ni cifra. E09. |
| Dot y DPI | Un dot es un punto de impresión. DPI son puntos por pulgada: dots ≈ mm × DPI / 25,4. La resolución usada debe corresponder al equipo. E05. |
| Módulo de barcode | Unidad mínima de ancho de barras. La cantidad de módulos depende de la codificación y se multiplica por los dots por módulo. E08. |
| Zona de silencio | Espacio libre alrededor del barcode necesario para su lectura. Que las barras entren no demuestra que el código completo sea legible. |
| Fuente proporcional | Letras diferentes ocupan anchos diferentes. Contar caracteres detecta exposición, pero no demuestra el desborde de cada nombre. E19. |
| Promesa | Representa el resultado futuro de una operación. Compartir una promesa pendiente evita lanzar varios procesos iguales. E16. |
| FIFO | Cola donde el primer elemento en entrar sale primero. Una variable con el último escaneo no es una cola. E04. |
| Caché | Conserva un resultado ya disponible. Por sí sola no evita solicitudes simultáneas mientras ese resultado aún se calcula. |
| Timeout | Límite de espera del cliente. El servidor o la cola pueden haber aceptado el trabajo aunque la respuesta no llegue. E22. |
| Idempotencia | Repetir una solicitud con la misma identidad no crea otro efecto. Necesita estado y un contrato; no garantiza por sí sola impresión física exactamente una vez. |
| Cola de impresión | El spooler recibe trabajos y los procesa. Aceptar un trabajo no prueba que salió una etiqueta. E07. |
| Job ID / UUID | El ID del spooler identifica el trabajo nativo; un UUID de la app identifica una solicitud o auditoría. Son distintos. E10 y M01. |
| Escritura parcial | Una llamada puede no transferir todos los bytes pedidos. Hay que comprobar el número devuelto y tratar el resto o el error. E11. |
| Atomicidad | El lector ve la versión completa anterior o nueva. Escribir un temporal y reemplazar ayuda a evitar archivos truncados; también hay que resolver concurrencia. E17. |
| Durabilidad | Un cambio permanece tras un fallo. No es lo mismo que atomicidad; un único trabajo tampoco significa impresión física indivisible. |
| Prueba con simulación | Controla entradas y respuestas sin hardware. Demuestra el comportamiento del programa bajo esas condiciones, no del dispositivo real. M05. |
| Regresión | Una corrección rompe algo que funcionaba. Un caso reproducible que pasa después del cambio ayuda a detectar que vuelva el mismo fallo. M02. |
| Archivo generado | Sale de una herramienta o compilación. Se mantiene su fuente y cómo regenerarlo; no se toma una salida antigua como versión actual. M06. |
