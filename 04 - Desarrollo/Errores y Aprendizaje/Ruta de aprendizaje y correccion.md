# Ruta de aprendizaje y correccion

Trabaja un problema por vez. Antes de cambiar algo, explica con tus palabras qué esperas que ocurra, demuestra el comportamiento actual y guarda un cambio pequeño. Usa [[Como registrar una correccion]] para dejar evidencia. No necesitas reestructurar toda la aplicación para aprender estas lecciones.

## 1. Preparar una base repetible

Lee [[M03 - Preparar control de versiones para aprender]] y [[M02 - Las pruebas no cubren el ciclo completo ni tienen comando unico]]. Aprende a reconocer código fuente, archivos generados y datos locales. Guarda un punto inicial en Git sin secretos ni archivos de compilación. Define cómo ejecutar una comprobación desde una instalación limpia. El catálogo contiene 3.080 productos: usa una copia reducida para provocar errores sin modificar sus datos reales.

**Resultado:** puedes explicar qué cambiaste y repetir una comprobación.

## 2. Configuración y errores visibles

Empieza por [[E12 - Leer settings acepta objetos incompletos]], [[E13 - La pantalla oculta el error de carga]] y [[E14 - El campo manual de impresora queda inaccesible]]. Son buenos ejercicios de validación, estados de interfaz y recuperación. Continúa con [[E23 - Guardar el nombre de empresa no cambia la plantilla]] y [[E24 - La busqueda oculta que faltan resultados]].

**Ejercicio:** introduce una configuración parcial y otra inválida. Describe qué valores se completan, qué se rechaza y qué ve el usuario. No ocultes el fallo con valores por defecto si cambia el destino de impresión.

## 3. Identidad de productos

Estudia E01, E02, E03 y E25 desde [[Mapa de errores y aprendizaje]]. Distingue código interno, barcode original y barcode emitido. Una búsqueda exacta puede tener más de un candidato. Un dígito verificador corregido cambia lo que escanea el lector.

**Ejercicio:** construye un catálogo mínimo con un duplicado, un código corto y un barcode corregido. Comprueba el ciclo producto → etiqueta → lectura → mismo producto. No inventes códigos comerciales para ocultar duplicados; registra la decisión que necesitan los datos.

## 4. Trabajo simultáneo

Lee E04, E16, E07 y E22. Aprende primero FIFO y promesas; después caché y deduplicación. Modela estados explícitos: pendiente, enviando, aceptado por el transporte, fallido y resultado desconocido.

**Ejercicio:** simula una impresión lenta e introduce A, B y C. Verifica orden y cantidad sin una impresora. Simula también una respuesta perdida después de aceptar el trabajo: un timeout no demuestra que no haya llegado.

## 5. Bytes y diseño de la etiqueta

Lee E06, E08, E09, E18, E19 y E05. Aprende qué son ZPL, UTF-8, Base64, módulos y dots en [[Conceptos para entender los errores]]. El cálculo del tamaño debe describir el comando que realmente se envía.

**Ejercicio:** genera una etiqueta con Ñ, una con nombre largo y un lote de diez. Inspecciona los bytes, el comando y el tamaño antes de enviar. Para el ejemplo medido, 10 etiquetas ocupan 36.070 bytes y su Base64 48.096 caracteres: supera el límite de argumentos de Windows. Una estrategia de envío por stdin o un comando de copias evita repetir ese argumento; debe comprobarse con el helper real.

Una vista previa y una medida matemática ayudan, pero el cierre de legibilidad, fuentes y lectura requiere la impresora y el lector. Agregar líneas al nombre exige revisar también la posición del barcode.

## 6. Integración Windows y cierre

Estudia E10, E11, E15 y E21 cuando comprendas el transporte. Compara la declaración nativa con la API oficial, comprueba bytes escritos y usa la misma identidad de cola para estado y envío. Continúa con E17, E20, M01, M04, M05 y M06 para persistencia, ejecución local, trazabilidad y documentación.

**Resultado:** una matriz de pruebas USB/TCP, lote pequeño/grande, acentos, nombre largo y error recuperable, con fecha y equipo. No marques pruebas físicas como aprobadas por haber pasado una simulación.

## Antes de usarlo en operación

El orden anterior facilita aprender; las fichas P1 siguen siendo prioritarias para uso real. Revisa todas en [[Mapa de errores y aprendizaje]]. El problema de plugins E26 se atiende por separado en el vault. Mantén XETUX fuera del ejercicio mientras siga en suspenso.
