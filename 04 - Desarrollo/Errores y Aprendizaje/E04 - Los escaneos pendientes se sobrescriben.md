---
id: E04
tipo: ficha-aprendizaje
area: concurrencia
prioridad: P1
estado: pendiente
verificacion: confirmado por lectura del codigo
fecha: 2026-09-29
tags:
  - labelprinter
  - aprendizaje
  - revision
---
# E04 - Los escaneos pendientes se sobrescriben

> [!info] Proyecto de aprendizaje
> Esta ficha describe el problema y una propuesta. Documentarlo no significa que el código esté corregido. Trabaja con una copia del catálogo para los ejercicios.

**Evidencia:** confirmado por lectura del codigo. **Prioridad:** P1.

## Qué ocurre

Si A se está imprimiendo, B queda pendiente. Si C llega antes de terminar A, C reemplaza a B y B desaparece sin aviso. Un solo escaneo pendiente no equivale a una cola.

## Por qué ocurre

`pendingRef` guarda un string y cada asignación pisa el valor anterior. El tiempo de envío es mayor que el intervalo entre algunos escaneos. El problema es de capacidad y orden, aunque JavaScript ejecute el código en un solo hilo.

## Dónde estudiarlo

- [src/app/fast/page.tsx](../../label-printer-web/src/app/fast/page.tsx) · línea 36

## Cómo arreglarlo paso a paso

1. Representar pendientes como una lista FIFO: primero en entrar, primero en salir.
2. Usar un único consumidor que retire un escaneo después de procesar el anterior.
3. Establecer una capacidad pequeña y visible; cuando se llene, avisar y rechazar de forma explícita.
4. Mostrar cuántos quedan pendientes.
5. Definir qué pasa ante un fallo: pausar para decisión del operador evita perder trabajos o reimprimirlos a ciegas.

## Cómo comprobar la solución

Usar un transporte simulado que tarde y registrar cada envío. Ingresar A, B y C antes de terminar A: deben procesarse A, B, C, una vez cada uno. Probar además cola llena y fallo de B. No usar la impresora real para la primera prueba.

## Qué aprender con este error

Aprender estructuras de datos, productor/consumidor y contrapresión: cuando una entrada llega más rápido de lo que se procesa, hay que conservarla o rechazarla claramente.

## Criterio para cerrarlo

- [ ] Reproducir el caso anterior al cambio o registrar el riesgo si depende de hardware.
- [ ] Implementar la corrección y verificar el resultado esperado descrito arriba.
- [ ] Registrar comando, datos usados, resultado y fecha; hacer la prueba física cuando esta ficha la pida.

## Notas relacionadas

- [[Mapa de errores y aprendizaje]]
- [[Ruta de aprendizaje y correccion]]
- [[E22 - Un timeout puede causar etiquetas duplicadas]]
