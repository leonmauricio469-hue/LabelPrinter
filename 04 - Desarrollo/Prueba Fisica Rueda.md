# Prueba Fisica Rueda

> Registra como se verifico de verdad la impresion de la etiqueta de PA PICAR.
> La definicion de hecho de la fase Rueda era "se imprime una etiqueta real desde el navegador".

## Fecha y lugar

- **2026-09-29**, en el PC del trabajo (el unico con la Zebra conectada).
- App servida en `http://localhost:3000` (tambien en `http://192.168.2.60:3000`).

## Como se determino el transporte

La fase se planifico sobre TCP 9100 porque es lo que documentaba el vault. Al llegar al PC
se comprobo que **la Zebra no esta en la red**. Evidencia recogida:

| Maquina / cola | Direccion | Resultado |
|---|---|---|
| `ZDesigner GX420t` | USB002 | Zebra GK420t. Es la impresora objetivo. |
| `EPSON4E9726 (L5190 Series)` | `192.168.2.80` | Unico host con 9100 abierto, pero es **tinta**, no habla ZPL. |
| `NE PA PICAR` (POS-X Thermal) | `192.168.2.231` | **Inalcanzable**: ARP `00-00-00-00-00-00`, sin ICMP, sin puertos. |
| `ETIQUETADORA` (4BARCODE 4B-2054TC) | USB001 | Otra etiqueta termica, no es la de PA PICAR. |

Conclusion: no hay Zebra por red. Se opto por USB sobre la cola `ZDesigner GX420t` **sin
tocar drivers ni crear colas nuevas**.

## Como se mando ZPL crudo por USB

`scripts/send-raw.ps1` hace P/Invoke a `winspool.drv` (`OpenPrinter` / `StartDocPrinter` /
`WritePrinter`) con `pDataType = "RAW"`. Es lo que hace que los bytes ZPL lleguen tal cual al
spooler en vez de ser reescritos por el driver. Se invoca desde Node con `child_process`, sin
anadir dependencias npm.

**Fallo encontrado y corregido**: declarar `CharSet.Unicode` hace que el P/Invoke resuelva a
`StartDocPrinterW`, que exige `DOCINFOW` con `LPWStr`. Pasar un `DOCINFOA` devolvia
`Win32 = 1804` (documento invalido). La regla a recordar: si la firma es `W`, el struct
tiene que ser `W` y sus cadenas `LPWStr`.

## Fallo de ZPL encontrado al ver la etiqueta

La primera etiqueta salio pero **con el texto descolocado y desbordado**. Causa: en ZPL,
`^CF0,18` fija el alto del caracter **y su ancho al mismo valor** (caracteres cuadrados).
Un nombre de 23 caracteres a ancho 20 son 460 dots, y el papel tiene 400. El precio a 40
tambien se salia.

Dos correcciones, ambas en el codigo y no en la plantilla:

1. Todos los `^A0N` llevan ahora **alto y ancho explicitos** (`^A0N,15,9` en vez de `^CF0,15`).
2. Se anadio soporte de `^FB` (ajuste de linea) en `zpl.builder.ts` para partir textos
   largos en varias lineas dentro de un ancho dado, con `justify` para alinear.

**Orden obligatorio en ZPL**: `^A` -> `^FB` -> `^FO` -> `^FD`. Si `^FB` va antes de `^A`, el
ajuste de linea se ignora silenciosamente. Este fue el segundo fallo, mas dificil de ver.

## Medidas

- Etiqueta fisica confirmada por el usuario: **50 x 25 mm** (400 x 200 dots a 203 dpi, 8 dots/mm).
- Rollo **continuo**: la impresora no corta, se corta a mano.
- El diseno final incluye el logo de PA PICAR como zona `graphic` (`pa-picar-logo.ts`,
  200 x 67 dots, generado con `scripts/generate-logo.ps1` desde `Pictures/logo vectorizado.png`).

## Resultado

| Comprobacion | Resultado |
|---|---|
| `POST /api/printer/test` | `{"ok":true}` |
| `POST /api/labels` | `HTTP 200 {"ok":true,"printedAt":"..."}` |
| Papel salen | **Si**, verificado por el usuario |
| Contenido legible y en su sitio | **Si**, verificado por el usuario |

> `{"ok":true}` **no prueba** que la impresora haya impreso: solo que Windows acepto el
> trabajo en el spooler. La unica prueba real es mirar el papel.

## Cosas que quedaron pendientes

- `buildZpl()` sigue usando la constante `DEFAULT_TEMPLATE` y **no lee** `label.widthMm` /
  `heightMm` de `settings.json`. Cambiar las medidas en la UI no cambia lo impreso. La
  plantilla y el `settings.json` estan duplicados y pueden desincronizarse.
- `tcp.transport.ts` nunca se probo contra una Zebra real, porque en esta subred no hay
  ninguna. Queda pendiente para cuando la impresora pase a Ethernet.

## Ver tambien

- [[Proximos Pasos]]
- [[Estado del Proyecto]]
- [[Impresora Zebra GK420t]]
- [[ZPL Lenguaje Impresion]]
