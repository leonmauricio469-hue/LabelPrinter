---
id: E10
tipo: ficha-aprendizaje
area: impresion
prioridad: P2
estado: pendiente
verificacion: contrato oficial contrastado con codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E10 - La firma nativa de StartDocPrinter es incorrecta

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** contrato oficial contrastado con codigo. **Prioridad:** P2.

## Qué ocurre

La declaración C# tiene cuatro parámetros y retorno `bool`; la función de Windows recibe tres parámetros y devuelve un DWORD con el ID del trabajo. El cuarto `out IntPtr jobId` no representa una salida de la API.

## Por qué ocurre

P/Invoke exige describir el contrato nativo exactamente. En Windows de 64 bits la impresión puede aparentar funcionar porque el argumento adicional se ignora y un retorno no cero se trata como verdadero, pero se pierde el ID real. No significa que toda impresión de 64 bits vaya a fallar.

## Dónde estudiarlo

- [scripts/send-raw.ps1](../../label-printer-web/scripts/send-raw.ps1) · línea 67
- [scripts/send-raw.ps1](../../label-printer-web/scripts/send-raw.ps1) · línea 125
- [src/lib/audit/audit.store.ts](../../label-printer-web/src/lib/audit/audit.store.ts) · línea 36

## Cómo arreglarlo paso a paso

1. Cambiar la declaración a retorno `uint`, tres parámetros y `DOCINFOW` compatible.
2. Guardar el retorno como ID y comprobar cero como fallo.
3. Obtener el error Win32 inmediatamente cuando corresponda.
4. Devolver el ID al transporte y conservarlo en el historial aparte del UUID de auditoría.
5. Revisar las demás declaraciones P/Invoke contra la documentación.

## Cómo comprobar la solución

Comparar firma, tipos y parámetros con Microsoft. En Windows crear un trabajo pequeño y comprobar que el ID devuelto coincide con el observado en la cola. La revisión actual solo verificó el contrato; no ejecutó llamadas nativas en Windows.

## Qué aprender con este error

Aprender interoperabilidad: `bool`, `uint` e `IntPtr` representan cosas distintas aunque una llamada parezca funcionar.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E07 - Enviado no significa impreso]]
- [[M01 - El historial no permite reconstruir la etiqueta]]

## Fuentes

[Microsoft: StartDocPrinter](https://learn.microsoft.com/en-us/windows/win32/printdocs/startdocprinter).
