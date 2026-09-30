---
id: E18
tipo: ficha-aprendizaje
area: etiquetas
prioridad: P2
estado: pendiente
verificacion: bytes y contrato verificados - papel pendiente
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E18 - USB y TCP no usan la misma codificacion

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** bytes y contrato verificados - papel pendiente. **Prioridad:** P2.

## Qué ocurre

USB transforma el ZPL a latin1; TCP envía strings UTF-8. No se emite `^CI` para declarar la tabla de caracteres. Hay 105 nombres con caracteres no ASCII y 113 productos con esos caracteres en algún campo. Los glifos exactos que salgan en papel no se comprobaron.

## Por qué ocurre

Un string de JavaScript no es la secuencia de bytes que recibe la impresora. É y Ñ tienen bytes distintos según la codificación, y el dispositivo necesita saber cómo interpretarlos. La configuración previa de la Zebra también influye.

## Dónde estudiarlo

- [src/lib/printing/usb.transport.ts](../../label-printer-web/src/lib/printing/usb.transport.ts) · línea 97
- [src/lib/printing/tcp.transport.ts](../../label-printer-web/src/lib/printing/tcp.transport.ts) · línea 11
- [src/lib/labels/zpl.builder.ts](../../label-printer-web/src/lib/labels/zpl.builder.ts) · línea 85

## Cómo arreglarlo paso a paso

1. Elegir una codificación común para ambos transportes.
2. Para UTF-8, emitir `^CI28` en cada etiqueta y enviar bytes UTF-8.
3. Confirmar compatibilidad del firmware y cobertura de la fuente.
4. Coordinar el escape de E06 con los mismos bytes.
5. Si el dispositivo no soporta esa estrategia, documentar una alternativa comprobada.

## Cómo comprobar la solución

Comparar los bytes enviados por ambos transportes para `CAFÉ`, `PEQUEÑO` y nombres reales del catálogo. Deben ser idénticos y coherentes con el comando de codificación. Imprimir una muestra y verificar visualmente los caracteres, además de leer el barcode.

## Qué aprender con este error

Aprender Unicode, codificación y fuentes: que un texto se vea bien en el navegador no garantiza su representación en otro dispositivo.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E06 - El texto puede convertirse en comandos ZPL]]

## Fuentes

[Zebra: ^CI y soporte de UTF-8](https://docs.zebra.com/us/en/printers/software/zpl-pg/c-zpl-zpl-commands/r-zpl-ci.html).
