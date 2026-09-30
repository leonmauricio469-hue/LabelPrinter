# ZPL - Lenguaje de Impresion

## Que es ZPL?

**ZPL (Zebra Programming Language)** es el lenguaje de comandos que usan las impresoras Zebra para generar etiquetas. Se envia como texto plano directamente a la impresora.

## Comandos Basicos

| Comando | Funcion |
|---|---|
| `^XA` | Inicio de etiqueta |
| `^XZ` | Fin de etiqueta |
| `^PW` | Ancho de impresion (dots) |
| `^LL` | Alto de etiqueta (dots) |
| `^CF` | Fuente por defecto |
| `^FO` | Posicion (X,Y) |
| `^FD` | Datos/Texto |
| `^FS` | Fin de campo |
| `^BY` | Ajustes de barra: `^BYw,r,h` (ancho de modulo, ratio, ...) |
| `^BC` | Codigo de barras Code 128 |
| `^BE` | Codigo de barras EAN-13 |
| `^GF` | Grafico en linea (logo) |
| `^FB` | Campo con ajuste de linea y alineacion |
| `^A0` | Fuente escalable |
| `^LH` | Posicion de referencia |
| `^LR` | Rotacion de texto |

## Conversion: mm a Dots

A 203 DPI: **1 mm = 8 dots**

| Medida | Dots |
|---|---|
| 10 mm | 80 dots |
| 20 mm | 160 dots |
| 30 mm | 240 dots |
| 40 mm | 320 dots |
| 50 mm | 400 dots |

## Codigos de barras: lo que hay que mirar

Un codigo de barras se puede imprimir perfecto y no lo leer **ningun** lector. No se ve en
el papel. Estas son las medidas que deciden si sirve:

| Medida | Que es | Minimo | En esta etiqueta |
|---|---|---|---|
| **X** (ancho de modulo) | `^BYw`, el primer parametro | **0.264 mm** (ISO/IEC 15420) | `^BY3` = 3 dots = **0.375 mm** |
| **Alto de barras** | `^BC`/`^BE`, el segundo parametro | **6.64 mm** practico | `^BEN,72` = 72 dots = **9.00 mm** |
| **Zona quieta** | el blanco a cada lado | **10X** | 58 y 57 dots = **7.1 mm** cada lado |
| **Digito de control** | el ultimo digito del EAN-13 | correcto | validado antes de imprimir |

Con `^BY2` el modulo mide **0.250 mm**, por debajo del minimo, y con `^BCN,48` las barras
miden **6.00 mm**, por debajo del practico. Las dos cosas a la vez: etiqueta impecable,
cero lectores. Paso de verdad, ver [[Prueba Legibilidad Barcode]].

### `^BE` (EAN-13) contra `^BC` (Code 128)

Para el catalogo de PA PICAR se usa **EAN-13**, no por moda:

- **EAN-13 son 95 modulos fijos.** El ancho del simbolo no depende del dato.
- **Code 128 con `^BC` automatico cambia de ancho segun la cadena**: 13 digitos = 123
  modulos (Start C x6 + Start B x1), 12 digitos = 101 (Code C), alfanumerico = 178 (Code B).
  Un barcode de 13 digitos a `^BY3` ocupa 369 dots y **no deja zona quieta** dentro de una
  etiqueta de 400 dots.
- El catalogo guarda EAN-13 de todos modos, que es justo el formato que usan las
  góndolas de la tienda.

### Digito de control EAN-13

Los 12 primeros digitos se pesan alternando 1 y 3 (empezando por 1); el decimo digito es el
que hace que la suma Closing sea multiplo de 10. Con el digito mal, **las barras se ven
iguales de nítidas y el lector rechaza el codigo**. `src/lib/labels/ean13.ts` lo calcula,
`POST /api/labels` rechaza el producto con 422, y `scripts/check-ean.ts` valida un
catalogo entero:

```
node .preview-build\scripts\check-ean.js data\catalog.json
```

## Trampas de ZPL que ya costaron tiempo

- **Orden `^A` -> `^FB` -> `^FO` -> `^FD`.** Con `^FB` antes de `^A`, ZPL ignora el ajuste
  de linea y el texto largo se desborda del papel.
- **Todo `^A0N` lleva alto Y ancho.** ZPL usa el ancho de caracter igual al alto si no se
  dice, y eso descuadra cualquier calculo de posicion.
- **`^GFA` lleva los datos con saltos de linea internos.** Trocear el ZPL por lineas rompe
  el logo; hay que buscar el bloque completo antes.

## Ejemplo: Etiqueta Basica

```zpl
^XA

; Configuracion de pagina
^PW400                  ; Ancho: 50mm
^LL300                  ; Alto: 37.5mm
^LH0,0                  ; Origen: esquina superior izquierda

; Cabecera
^CF0,24                 ; Fuente size 24
^FO20,20                ; Posicion: 2.5mm x 2.5mm
^FDPA PICAR^FS          ; Texto: nombre del negocio

; Nombre del producto
^CF0,20                 ; Fuente size 20
^FO20,60                ; Posicion: 2.5mm x 7.5mm
^FDCAFE AMANECER 500GR^FS

; Codigo de barras (ver "^BE": aqui deberia ser EAN-13)
^BY2                    ; Ancho de modulo: 2 dots = 0.250 mm  <-- POR DEBAJO DEL MINIMO
^BCN,80,Y,N,N          ; Code128, alto 80 dots
^FO20,100               ; Posicion: 2.5mm x 12.5mm
^FD7591234567890^FS

; Precio (grande)
^A0N,40,40              ; Fuente escalable, 40x40 dots
^FO280,200              ; Posicion: 35mm x 25mm
^FD$7.80^FS

; Referencia
^CF0,16                 ; Fuente size 16
^FO20,240               ; Posicion: 2.5mm x 30mm
^FDREF: 001^FS

^XZ
```

## Ejemplo: Generar ZPL en TypeScript

```ts
// lib/labels/zpl.builder.ts
function buildZpl(productName: string, barcode: string, price: number, reference: string): string {
  return [
    "^XA",
    "^PW400",
    "^LL300",
    "^CF0,24",
    "^FO20,20",
    "^FDPA PICAR^FS",
    "^CF0,20",
    "^FO20,60",
    `^FD${productName}^FS`,
    "^BY2",
    "^BCN,80,Y,N,N",
    "^FO20,100",
    `^FD${barcode}^FS`,
    "^A0N,40,40",
    "^FO280,200",
    `^FD$${price}^FS`,
    "^CF0,16",
    "^FO20,240",
    `^FDREF: ${reference}^FS`,
    "^XZ",
  ].join("\n");
}
```

> En la app real esto **no** esta escrito como una lista de cadenas: la plantilla es una
> lista de zonas (`LabelTemplate`) y el builder la convierte. Y antes de mandar nada se
> comprueba que el simbolo del barcode quepa en la etiqueta. Ver [[Plantilla Etiqueta]].

## Ver tambien

- [[Impresora Zebra GK420t]]
- [[Plantilla Etiqueta]]
- [[Dimensiones Etiqueta]]
- [[Prueba Legibilidad Barcode]]
