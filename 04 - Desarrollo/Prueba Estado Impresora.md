# Prueba Estado Impresora

Segundo trabajo de la fase **Carro**: que la app diga la verdad sobre la impresora.

> **Estado: codificado y verificado por software. SIN CONFIRMACION FISICA.**
> Falta la prueba que de verdad importa, y la tiene que hacer una persona: **apagar la
> impresora o quitarle el papel** y mirar si la app se entera. Ver "Lo que falta" abajo.

## El problema que resuelve

`POST /api/printer/test` respondia `ok: true` cuando la cola existe y se puede abrir. Eso
es literalmente lo unico que hacia: su modo `Check` solo hace `OpenPrinter`.

Asi que la app podia decir "impresion correcta" con la impresora apagada, sin papel o sin
cinta. En un puesto de trabajo eso es la peor clase de fallo: no se ve, y el operador se
lleva una etiqueta que nunca existio.

## Lo que se averiguo antes de escribir codigo

Nada de esto se dedujo: se pregunto a Windows.

1. **Que expone la Zebra en este PC.** Con la impresora sana, `Get-Printer` da
   `PrinterStatus = Normal`, `JobCount = 0`, `PortName = USB002`.
2. **`PrinterStatus` es un enum de banderas**, no un texto. Sus 27 valores se leyeron del
   propio sistema con `[Enum]::GetNames(...)` y son potencias de dos. Por eso se pueden
   sumar varios y por eso el mapa se escribe con `&`, no con `==`.
3. **Los valores que importan estan ahi**: `PaperOut` (16), `DoorOpen` (4194304),
   `Offline` (128), `NoToner` (262144), `Paused` (1), `TonerLow` (131072).
4. **`WorkOffline` y `ExtendedPrinterStatus` vienen nulos** en `Get-Printer`, incluso con
   `-Full`. Solo el WMI (`Win32_Printer`) los rellena. Como las banderas ya incluyen
   `Offline` y `ServerOffline`, no hace falta la segunda consulta.

## El coste, medido (esto fue lo que condiciono el diseno)

| Llamada | Coste |
|---|---|
| Ruta pura de la app (`/api/products`) | 11-69 ms |
| Con un `powershell.exe` (`/api/printers`) | ~2.000 ms |
| Consultar el estado de la cola | ~2.300 ms |

Un `powershell.exe` cuesta unos **2,3 segundos** en este PC. No es el script: es arrancar
PowerShell y cargar el modulo `PrintManagement`. (Se intento evitar el `Add-Type` de P/Invoke
en el modo `Status`; es correcto y sigue midiendo lo mismo, porque el costo esta en otra
parte.)

**Consecuencia directa**: consultar el estado en cada escaneo de `/fast` limitaria el ritmo
a una etiqueta cada dos segundos. El modo rapido quedaria inservible. Por eso el estado se
consulta **en segundo plano**, nunca en el camino del escaneo.

## Que se hizo

- **`scripts/send-raw.ps1`**: nuevo modo `Status`. Devuelve las banderas crudas en JSON.
  Va **antes** del `Add-Type` porque no necesita abrir la cola.
- **`src/lib/printing/queue.status.flags.ts`**: el mapa de banderas. Sin `server-only` y sin
  hablar con Windows, para poder ejecutarlo y comprobarlo.
- **`src/lib/printing/queue.status.ts`**: lee el estado, lo cachea y lo traduce.
- **`src/lib/printing/queue.status.types.ts`**: los tipos, aparte, porque los necesita tambien
  el componente de cliente (mismo motivo que `product.types.ts`).
- **`GET /api/printer/status`**: el endpoint. Acepta `?force=1`.
- **`src/components/printer-status-banner.tsx`**: el banner, en `/`, `/fast` y `/settings`.

### Decisiones

- **El estado NO bloquea la impresion.** Si la cola esta mal, Windows guarda el trabajo y lo
  imprime cuando la impresora vuelva. Negarse a imprimir seria tirar las etiquetas. Lo que
  hace es **avisar**, que es justo lo que faltaba.
- **Un error de la impresora es un estado, no un fallo de la API.** `/api/printer/status`
  responde 200 con `state: "blocked"`. El 500 queda para no poder leer la configuracion.
- **Sin banderas desconocidas se dice "desconocido", nunca "lista".** Una etiqueta que no sale
  cuesta papel, tiempo y un producto sin precio puesto; mentir en la direccion contraria
  sale mas caro.
- **`blocked` gana sobre `warning`, y `warning` sobre `busy`.** Si no va a imprimir, da
  igual que ademas este ocupada.
- **`Paused` cuenta como bloqueante.** Una cola en pausa acepta trabajos y no imprime nada,
  y el operador veria "1 etiqueta impresa" igual que si la impresora estuviera apagada.
- **El refresco va despues de cada impresion**, no en temporizador corto. El estado solo
  cambia cuando alguien usa la impresora, y lo unico que la usa es esta app. Hay un sondeo
  de 20 s como red de seguridad. Sondear cada 10 s seria un PowerShell constante.
- **La cache se sella despues de leer, no antes.** Sellarla antes hacia que el valor pasara
  2,3 de sus 3 s de vida caducado solo por el spawn, y dos pestanas nunca compartian nada.
  Medido: 2.349 ms -> 17 ms.
- **En `/fast` el banner se oculta cuando todo esta bien.** La pantalla es un cartel grande
  y un aviso verde ahi solo distrae. Si algo falla, aparece.
- **`/settings` muestra las banderas en crudo.** No esta verificado que el driver de la
  Zebra rellene todas, asi que hace falta poder mirar el numero sin abrir PowerShell.

## Dos bugs que aparecieron de paso

### 1. `settings.json` con BOM tumbaba la app entera

Encontrado por casualidad, al escribir el archivo desde PowerShell.

- **Sintoma**: `/api/settings` y `/api/printer/status` devuelven 500. `/api/products`
  funciona, porque no lee ese archivo. El panel del navegador muestra
  `Unexpected token '﻿'`.
- **Causa**: PowerShell con `-Encoding UTF8` escribe un BOM (`EF BB BF`). `JSON.parse` no lo
  acepta. El archivo estaba **perfectamente bien formado**.
- **Por que importa mas de lo que parece**: `settings.json` lo edita gente desde Windows.
  Cualquier editor de los habituales lo guarda con BOM, y entonces la app deja de arrancar
  sin que haya nadie que haya tocado nada.
- **Arreglo**: `stripBom()` en `src/lib/data/json-file.ts`, aplicado en `settings.store.ts`
  y en `product.catalog.repository.ts`. El error del catalogo ahora dice explicitamente que
  es un BOM, y da el comando de PowerShell para guardarlo sin el.
- **Comprobado**: `trim()` **si** quita el BOM, asi que el historial (`print-history.jsonl`,
  que se lee linea a linea) nunca tuvo este problema. Verificado en Node, no de memoria.
- **Verificado**: con BOM, las tres rutas responden 200. Con el JSON realmente roto, el
  catalogo responde 500 con el mensaje correcto.

### 2. El banner se llevaba la pagina entera por delante

- **Sintoma**: `TypeError: Cannot read properties of undefined (reading 'found')` y pantalla
  en blanco.
- **Causa**: el endpoint devuelve 500 con `{ error }` cuando no puede leer la
  configuracion, y el banner hacia `(await res.json()) as QueueStatus` sin comprobar nada.
  Un error del servidor se traducía a un error de JavaScript.
- **Arreglo**: `asQueueStatus()` valida la forma de lo que llega y, si no encaja, pinta
  "La API no devolvio un estado reconocible" con el HTTP. La pagina no se cae.
- **Verificado**: con `settings.json` roto, el banner avisa y el resto de la pagina
  funciona. Consola sin errores de JavaScript.

## Verificacion hecha

| Que | Como | Resultado |
|---|---|---|
| Modo `Status` con la cola real | `send-raw.ps1 -Mode Status` | `flags=0`, `Normal`, `jobCount=0` |
| Modo `Status` con cola inexistente | idem, nombre inventado | `found: false` |
| El modo `Send`/`Check` no se rompio | `-Mode Check` | respuesta igual que antes |
| Mapa de banderas | `node .preview-build\scripts\check-queue-status.js` | **34 comprobaciones, todas ok** |
| `ready` | `GET /api/printer/status` | `Lista` |
| `missing` | nombre de cola inexistente | `No existe ninguna cola...` |
| Resolucion por subcadena | nombre `GX420t` | encuentra `ZDesigner GX420t` |
| Cache | 3 llamadas seguidas | 2.349 ms -> 17 ms -> 25 ms |
| Banner en `/` | navegador | visible siempre |
| Banner en `/fast` | navegador | oculto si esta bien, visible si falla |
| Banner en `/settings` | navegador | visible + banderas en crudo |
| Consola del navegador | 4 pestanas | sin errores de JavaScript |
| `tsc --noEmit` y `next build` | linea de comandos | limpios |

La comprobacion de banderas incluye una que vale la pena: **ninguna de las 27 banderas del
enum queda sin decidir**. Una bandera sin decidir en produccion se lee como una averia, y
eso seria un fallo que se ve mientras el equipo funciona.

## Lo que falta (esto es lo importante)

**El mapa esta construido sobre lo que Windows *declararia*, no sobre lo que el driver de
la Zebra *declara*.** Nadie ha comprobado nunca si el driver rellena `PaperOut`, `Offline` o
`DoorOpen` en este equipo. Puede que los rellene todos, puede que solo `Offline`, y puede
que no rellene ninguno.

Por eso el banner enseña el numero en crudo: si el mapa falla, se ve por que.

### Prueba fisica pendiente

1. Abrir `/settings` con la impresora encendida. Debe decir `Lista`, `flags=0`.
2. **Quitar el rollo de papel** y pulsar "Actualizar".
   - Si dice "No va a imprimir: sin papel" -> el driver informa, y el mapa esta bien.
   - Si dice "No va a imprimir: sin conexion" u otra cosa -> el driver informa de otra manera
     y hay que corregir el mapa.
   - Si dice `Lista` -> **el driver no informa de papel**, y hay que buscar otra via.
3. **Apagar la impresora** y repetir. Debe decir algo de conexion.
4. **Poner la tapa arriba**, si se puede, y repetir.
5. Reponer y confirmar que vuelve a `Lista`.

**Hasta que eso pase, esto no esta verificado.** El codigo esta, la logica esta comprobada
con 34 pruebas, pero la pregunta de fondo -- *¿el driver de la Zebra le dice a Windows que
se acabo el papel?* -- sigue sin respuesta.

## La pregunta de fondo

Windows tiene un canal mucho mejor que las banderas: el comando ZPL `~HS` (*host status*),
que devuelve el estado real del hardware (papel, cinta, tapa abierta). **No se puede usar
aqui**: la app escribe en la cola con `WritePrinter`, que es solo escritura. No hay forma de
leer la respuesta sin abrir la impresora como dispositivo, lo que entraria en conflicto con
la regla de no tocar drivers ni colas.

Asi que el limite real es: **se puede saber si va a imprimir, no cuanta queda.** El mensaje
lo dice asi a proposito ("No va a imprimir: sin papel"), y no dice "quedan 3".

## Deuda tecnica que aparecio

- **Imprimir cuesta ~2,4 s**, por el mismo `powershell.exe` por etiqueta
  (`POST /api/labels` -> `send-raw.ps1` en cada impresion). En `/fast` eso limita el ritmo a
  unas 25 etiquetas por minuto, con independencia de la impresora. Se arreglaria con un
  proceso Powershell persistente, o con un servicio que escuche un socket. **No se ha
  tocado**: es un cambio de transporte y no estaba en el encargo.
- **El servidor `next start` se murio en silencio** a mitad de una sesion, sin dejar error en
  ningun log. Se relanzo desligado con `Start-Process` + ruta absoluta a `node.exe`
  (`npm.cmd` falla en un proceso desligado porque `node` no esta en su PATH). Esto es
  exactamente el problema del punto 5 de Carro, servicio de Windows.

## Ver tambien

- [[Estado del Proyecto]]
- [[Proximos Pasos]]
- [[Prueba Patineta]]
- [[Prueba Coincidencias]]
- [[Prueba Legibilidad Barcode]]
