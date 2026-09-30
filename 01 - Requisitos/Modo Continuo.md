# Modo Continuo

## Descripcion

El modo continuo permite al operador trabajar como una estacion de impresion rapida, minimizando la interaccion con la interfaz.

## Flujo

```
ESCANEAR PRODUCTO
      ↓
BUSCAR EN CATALOGO
      ↓
IMPRIMIR
      ↓
LISTO
      ↓
ESCANEAR SIGUIENTE
      ↓
IMPRIMIR
      ↓
...
```

## Objetivo

```
ESCANEAR → IMPRIMIR → ESCANEAR → IMPRIMIR → ESCANEAR → IMPRIMIR
```

Con la minima interaccion posible.

## Comportamiento

- Cada escaneo genera una etiqueta automaticamente
- Cantidad predeterminada: **1 etiqueta por escaneo**
- No requiere hacer clic en "Imprimir"
- La interfaz solo muestra: producto encontrado + confirmacion de impresion

## Pantalla del Modo Continuo

```
╔══════════════════════════════════════╗
║       MODO IMPRESION RAPIDA         ║
╠══════════════════════════════════════╣
║                                      ║
║       ESCANEA EL PRODUCTO            ║
║                                      ║
║          ████████████████            ║
║                                      ║
║       CAFE AMANECER 500GR            ║
║                                      ║
║              $7.80                   ║
║                                      ║
║        ETIQUETA IMPRESA              ║
║                                      ║
║       Escanea siguiente...           ║
╚══════════════════════════════════════╝
```

## Ver tambien

- [[Flujo Principal]]
- [[Cantidad de Etiquetas]]
- [[Interfaz de Usuario]]
