# Prueba Legibilidad Barcode

> Por que el escaner no leia ninguna etiqueta, como se localizo sin adivinar, y que se
> cambio para que se lea. Es la continuacion de [[Prueba Patineta]]: el ciclo escanear ->
> imprimir ya funcionaba, pero **el codigo de barras impreso no lo leia nadie**.

## Fecha y lugar

- **2026-09-29**, PC del trabajo. App en `http://localhost:3000`, impresora por USB.

## Sintoma

El operador escanea y no ocurre nada. Primera reaccion habitual: pensar que el escaner esta
roto, el cable mal, o que el buffer de `scanner-input.tsx` pierde caracteres.

**Las tres eran falsas.** El escaner funcionaba todo el tiempo; lo que no funcionaba era la
etiqueta. Un `POST /api/labels` respondia `ok: true` y salia papel, y ese papel llevaba un
codigo de barras que ningun lector del mundo decodificaba.

> **Leccion**: `ok: true` solo significa que el spooler acepto el trabajo. Nada mas. Un
> trabajo de impresion puede ser correcto en todos los sentidos y producir una etiqueta
> inservible. Ver [[Prueba Fisica Rueda]].

## Como se localizo, descartando antes de tocar nada

Lo primero fue **descartar**, no arreglar. Cada descartado dejo constancia:

| Sospecha | Como se descarto | Veredicto |
|---|---|---|
| El escaner no esta conectado | `Get-PnpDevice`: `USB\VID_2258&PID_2348\0329`, descripcion real `"USB Keyboard"`, interfaz MI_00 clase `Keyboard`, driver `kbdhid`, en `Port_#0002.Hub_#0004`, estado OK | **Descartado** |
| El `scanner-input.tsx` pierde caracteres | Revision del buffer en `useRef` y del `onChange` con updater. Ademas se monto `/teclado`, que registra tecla por tecla | **Descartado** |
| Digito de control EAN-13 malo | `scripts/check-ean.ts` sobre los 12 productos: los 12 correctos | **Descartado** |
| Barcode cortado por el borde de la etiqueta | 246 dots de 400, con 77 dots de zona quieta a cada lado | **Descartado** |
| **Ancho de modulo (X) demasiado fino** | `^BY2` = 2 dots = **0.250 mm**, y el minimo de ISO/IEC 15420 es **0.264 mm** | **Causa raiz** |
| **Altura de barras insuficiente** | `^BCN,48` = 48 dots = **6.00 mm**, y el minimo practico es **6.64 mm** | **Causa raiz** |

Las dos ultimas medians no se ven en el papel. Por eso hace falta medirlas: un codigo de
barras por debajo del estandar se **imprime perfecto** y no lo lee nadie.

## El ZPL que lo causaba

```
^BY2              ^  modulo de 2 dots a 203 dpi = 0.250 mm
^BCN,48,Y,N,N     ^  barras de 48 dots = 6.00 mm
^FO88,110         ^  esquina superior izquierda
^FD7591234567801^FS
```

Las dos medidas estaban **por debajo del minimo** y el papel salia impecable. Ese es el
peor tipo de fallo posible: no se ve, y por eso se puede imprimir durante semanas sin
enterarse.

## Por que Code 128 no servia, y se paso a EAN-13

La idea obvia era subir `^BY` de 2 a 3 y ya. **No cabia.** El ancho del simbolo en puntos
crece con el modulo, y la etiqueta son 400 dots:

| Simbologia | ^BY | X (mm) | Ancho del simbolo | Zona quieta izq/der | |
|---|---|---|---|---|---|
| Code 128 (el que habia) | 2 | 0.250 | 246 dots (30.8 mm) | 77/77 dots | X por debajo del minimo |
| Code 128 | 3 | 0.375 | 369 dots (46.1 mm) | 16/15 dots | **no cabe** |
| Code 128 | 4 | 0.500 | 492 dots (61.5 mm) | 0 / -92 dots | **no cabe** |
| EAN-13 | 2 | 0.250 | 190 dots (23.8 mm) | 105/105 dots | X por debajo del minimo |
| **EAN-13** | **3** | **0.375** | **285 dots (35.6 mm)** | **58/57 dots** | **vale** |
| EAN-13 | 4 | 0.500 | 380 dots (47.5 mm) | 10/10 dots | **no cabe** (zona quieta de 2 modulos) |

`^BY4` es el X ideal (0.5 mm) pero deja 10 dots de zona quieta, o sea 2 modulos. El estandar
pide **10X**, que a `^BY4` son 40 dots por lado: 380 + 80 = 460 dots, y la etiqueta tiene 400.

### El segundo motivo: el ancho de Code 128 no es predecible

`^BC` sin el parametro `m` deja que **la impresora elija el subconjunto**, y el ancho del
simbolo cambia con el dato:

| Dato | Subconjunto que elige | Modulos |
|---|---|---|
| 13 digitos | Start C x6 + Start B x1 | **123** |
| 12 digitos | Code C completo | 101 |
| alfanumerico | Code B | 178 |

Con 13 digitos hacen falta 123 modulos, no los 112 que estimaba el codigo: hay que volver a
Code B para el ultimo digito, y ese Start B de en medio es un simbolo mas de 11 modulos.
O sea que **la anchura de la etiqueta dependia de una decision que tomaba la impresora**.
EAN-13 son **95 modulos fijos**, sin importar el dato. Por eso se paso a `^BE`.

## Lo que se cambio

```
^BY3            ^  modulo de 3 dots = 0.375 mm   (minimo 0.264 mm)
^BEN,72,Y,N     ^  EAN-13, barras de 72 dots = 9.00 mm   (minimo practico 6.64 mm)
^FO58,96        ^  centrado: (400 - 285) / 2 = 58
```

Reparto vertical nuevo de los 200 dots (25 mm), porque 72 dots de barras no caben donde
estaban las de 48:

| Zona | y (dots) | mm |
|---|---|---|
| Logo PA PICAR (200 x 67) | 1..68 | 0.1..8.5 |
| Nombre del producto | 70..84 | 8.8..10.5 |
| Precio | 68..92 | 8.5..11.5 |
| Barras EAN-13 | 96..168 | 12..21 |
| Linea de interpretacion (la pone la impresora) | ~170..182 | ~21.3..22.8 |
| Referencia | 186..198 | 23.3..24.8 |

Los textos bajaron un punto de tamano (`^A0N,14,8` el nombre, `^A0N,24,15` el precio) para
ganar los 24 dots que ocupaban las barras extras.

## Codigo que cambio

- **`src/lib/labels/ean13.ts`** (nuevo): digito de control y ancho fijo de 95 modulos.
- **`src/lib/labels/code128.ts`** (nuevo): encoder Code 128 con los 107 patrones de
  ISO/IEC 15417, y `encodeCode128Auto()` que reproduce la eleccion de subconjunto de ZPL.
  Vive en `src/lib` y no en `scripts` porque de el depende el ancho que usa `zpl.builder.ts`.
- **`src/lib/labels/zpl.builder.ts`**: `code128Dots()` era una estimacion
  (`11 + 11*ceil(n/2) + 11 + 13`) y decia 112 modulos donde el automatico da 123. Ahora
  `symbolModules()`, `symbolDots()` y `quietZoneDots()` calculan el ancho real por
  simbologia.
- **`src/lib/labels/label.template.ts`**: `BarcodeZone` gana `symbology` y `moduleWidth`
  pasa a ser obligatorio. Plantilla nueva con EAN-13 y el reparto de arriba.
- **`src/app/api/labels/route.ts`**: **antes de gastar papel** calcula el ancho real del
  simbolo y las zonas quietas, y responde **422** si no cabe. Tambien rechaza un barcode
  con el digito de control mal si la plantilla usa EAN-13. Antes solo se descubria
  mirando el papel.
- **`src/lib/products/product.catalog.repository.ts`**: avisa por consola de los EAN-13 con
  el digito de control mal. Solo avisa, no falla: la fila es valida y el codigo puede no
  ser EAN-13 (Code 128 admite cualquier cosa). Quien corta es `POST /api/labels`.
- **`scripts/check-ean.ts`** (nuevo): valida el digito de control de todo un catalogo.
  **Hay que correrlo sobre el catalogo real de PA PICAR cuando llegue.**
- **`scripts/render-label.ts`** (nuevo): dibuja la etiqueta a un PNG con la resolucion
  real de la impresora, rejilla de 1 mm, el logo bitmap real, las barras con el ancho de
  modulo exacto y la tabla de candidatos. Salida en `preview/label-preview.png`.
- **`src/app/teclado/page.tsx`** (nuevo): pagina de diagnostico que registra tecla por tecla
  lo que llega al navegador, con contador de eventos, si la ventana tiene el foco,
  reconstructor de buffer y detector de sufijos. Sirve para distinguir "el escaner no
  manda Enter" de "la ventana del navegador no tiene el foco". **No imprime nada.**

## Verificacion

| Prueba | Resultado |
|---|---|
| `tsc --noEmit` sobre el proyecto | Sin errores |
| `render-label.js` con la plantilla nueva | EAN-13, 95 mod x 3 = 285 dots, zonas quietas 58/57, minimo 10X = 30 |
| `check-ean.js` sobre `data/catalog.json` | 12 de 12 con digito de control correcto |
| `preview-zpl.js 1` | Emite `^BY3`, `^BEN,72,Y,N`, `^FO58,96` |
| `POST /api/labels` sigue imprimiendo | Registrado en `print-history.jsonl` |
| **El operador lee el barcode impreso con el escaner** | **Confirmado por el usuario** |

Las dos ultimas impresiones del historial (16:17 y 18 del 2026-09-29, `P-0001` en modo
normal y en modo rapido) son las de la geometria nueva, y la segunda la lanzo el propio
escaner desde `/fast`.

## Lo que NO quedo verificado

- **El aspecto del layout nuevo.** Se movieron cuatro zonas y se cambiaron dos tamanos de
  fuente, y eso se razono con numeros, no mirando la etiqueta. Habria que confirmar que el
  nombre largo no se pisa con el precio y que la referencia no queda pegada al borde.
  La pagina `/teclado` y el render helped, pero el render **no se pudo mirar**: el modelo
  que ayudo no acepta imagenes. Todo el analisis fue numerico.
- **El ciclo completo de ida y vuelta**: escanear un producto, que imprima, escanear la
  etiqueta resultante y comprobar que devuelve el mismo producto. Se confirmo que el
  escaner lee y que imprime, no las dos cosas encadenadas.
- **Lectura a distancia y con angulo.** Solo se verifico lectura de cerca.

## Deuda que dejo esto

- **`tcp.transport.ts`** sigue sin probarse: en `192.168.2.0/24` no hay ninguna Zebra.
- **Los 12 productos son inventados.** Sus precios y codigos de barras son de mentira, y
  ahora ademas el barcode se imprime como EAN-13, asi que cualquier codigo real que no sea
  un EAN-13 de 13 digitos devolvera 422. Hay que decidir si se mantiene Code 128 como
  alternativa para codigos que no sean EAN-13, antes de cargar el catalogo real.
- **`buildZpl()` sigue ignorando `label.widthMm` / `heightMm`.** Todo el reparto vertical
  de arriba esta en constantes de `DEFAULT_TEMPLATE`.

## Ver tambien

- [[Prueba Patineta]]
- [[Prueba Fisica Rueda]]
- [[ZPL Lenguaje Impresion]]
- [[Plantilla Etiqueta]]
- [[Escaner USB]]
- [[Proximos Pasos]]
