# Plantilla de Etiqueta

## Diseno Visual

Basado en la etiqueta fisica de referencia de PA PICAR:

```
┌─────────────────────────────────────┐
│                                     │
│            PA PICAR                 │
│            [LOGO]                   │
│                                     │
│   CAFE AMANECER DE 500GR            │
│                                     │
│         CODIGO DE BARRAS            │
│         |||||||||||||||             │
│                                     │
│   REF                        7.80  │
│                                     │
└─────────────────────────────────────┘
```

## Zonas de la Etiqueta

Layout real de 50 x 25 mm a 203 dpi (400 x 200 dots), el que imprime
`src/lib/labels/label.template.ts`:

| Zona | y (dots) | y (mm) | Contenido | ZPL |
|---|---|---|---|---|
| Logo | 1..68 | 0.1..8.5 | Logo PA PICAR (200 x 67 dots) | `^GFA` |
| Producto | 70..84 | 8.8..10.5 | Nombre del producto | `^A0N,14,8` + `^FB240,1,0,L,0` |
| Precio | 68..92 | 8.5..11.5 | Precio en grande | `^A0N,24,15` |
| Barcode | 96..168 | 12..21 | EAN-13 | `^BY3` + `^BEN,72,Y,N` en `^FO58,96` |
| HRI | ~170..182 | ~21.3..22.8 | Digitos del codigo | La pone la impresora (`Y` en `^BE`) |
| Referencia | 186..198 | 23.3..24.8 | Codigo de referencia | `^A0N,12,8` |

El precio va arriba a la derecha, junto al nombre, y **no abajo**: el barcode ocupa la
franja central baja y empujarlo obligaba a un tipo de letra mas pequeno. El reparto se
refizo entero cuando el barcode paso de 48 a 72 dots de alto.

## Regla de oro: el barcode manda

El barcode es lo unico de la etiqueta que no puede fallar sin que la etiqueta sirva para
nada. Los textos se pueden ver mal; el barcode, o se lee o no sirve. Por eso:

- **X (ancho de modulo) >= 0.264 mm**, el minimo de ISO/IEC 15420. En 203 dpi eso son
  **3 dots por modulo** (`^BY3` = 0.375 mm). Con `^BY2` (0.250 mm) la etiqueta se imprime
  impecable y no la lee nadie.
- **Alto de barras >= 6.64 mm**, el minimo practico; se usan **72 dots = 9 mm**.
- **Zona quieta >= 10X** a cada lado, o sea 30 dots con `^BY3`. Es lo que le dice al
  lector donde empieza el simbolo.
- **El ancho del simbolo se mide antes de imprimir.** Si no cabe, `POST /api/labels`
  responde 422 en vez de gastar el papel.

Todo esto esta razonado y medido, con numeros, en [[Prueba Legibilidad Barcode]].

## Campos Obligatorios

| Campo | Descripcion | Ejemplo |
|---|---|---|
| `business_name` | Nombre del negocio | PA PICAR |
| `product_name` | Nombre del producto | CAFE AMANECER DE 500GR |
| `barcode` | Codigo de barras | 7591234567801 |
| `price` | Precio actual | 7.80 |
| `reference` | Codigo de referencia | REF-001 |

`barcode` **debe ser un EAN-13 valido** (13 digitos con el digito de control correcto).
Hoy la plantilla usa `^BE`, que solo acepta EAN-13; si un producto tuviera otro tipo de
codigo, `POST /api/labels` lo rechaza con 422 en vez de imprimir algo ilegible.

## Campos Opcionales (Futuro)

| Campo | Descripcion |
|---|---|
| `logo` | Logo del negocio (imagen) |
| `description` | Descripcion adicional |
| `lot_number` | Numero de lote |
| `expiration` | Fecha de vencimiento |

## Generacion en ZPL

Ver [[ZPL Lenguaje Impresion]] para el comando ZPL que genera esta plantilla.

La plantilla **vive como datos**, no como codigo: `LabelTemplate` en
`src/lib/labels/label.template.ts` es una lista de zonas (texto, barcode, grafico) y
`zpl.builder.ts` la convierte en ZPL. Asi el editor de plantillas de la fase Carro tiene
algo que editar.

```ts
// src/lib/labels/label.template.ts (extracto, zona del barcode)
{
  kind: "barcode",
  x: 0,                                  // se recalcula al centrar
  y: 96,
  format: "^BY3\n^BEN,72,Y,N",
  source: "barcode",
  symbology: "ean13",                    // 95 modulos fijos, ancho predecible
  center: true,
  moduleWidth: 3,                        // 3 dots = 0.375 mm
}
```

Dos trampas que ya costaron tiempo:

- **Orden `^A` -> `^FB` -> `^FO` -> `^FD`.** Con `^FB` antes de `^A`, ZPL ignora el ajuste de
  linea y el texto largo se sale del papel.
- **Todo `^A0N` lleva alto Y ancho.** ZPL toma el ancho de caracter igual al alto si no se
  dice, y eso descuadra cualquier calculo de posicion.

## Ver tambien

- [[Dimensiones Etiqueta]]
- [[ZPL Lenguaje Impresion]]
- [[Prueba Legibilidad Barcode]]
- [[Editor Plantillas]]
