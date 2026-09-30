# Interfaz de Usuario

La interfaz es una **web app** servida por Next.js. Se abre en el navegador del puesto (`http://localhost:3000`). El escaner USB escribe como teclado, por lo que funciona identico en el navegador.

## Rutas de la app

| Ruta | Pantalla | Funcion |
|---|---|---|
| `/` | Modo normal | Buscar producto y definir cantidad |
| `/fast` | Modo continuo | Escanear -> imprimir automatico |
| `/settings` | Configuracion | Impresora, etiqueta, empresa |
| `/history` | Historial | Ultimas impresiones |

## Pantalla Principal - Modo Normal (`/`)

```
┌──────────────────────────────────────────┐
│        GENERADOR DE ETIQUETAS            │
│             PA PICAR                     │
│  [ Modo Normal ] [ Modo Rapido ]         │
├──────────────────────────────────────────┤
│                                          │
│  Codigo / Producto                       │
│  ┌──────────────────────────────────┐    │
│  │                                  │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Producto encontrado:                    │
│  CAFE AMANECER DE 500GR                  │
│  Precio: $7.80   Ref: REF-001            │
│                                          │
│  Cantidad: [-] [ 1 ] [+]                │
│                                          │
│            [ IMPRIMIR ]                  │
│  Estado: Listo / Imprimiendo / Error     │
└──────────────────────────────────────────┘
```

## Pantalla - Modo Continuo (`/fast`)

```
┌──────────────────────────────────────────┐
│         MODO IMPRESION RAPIDA            │
│                                          │
│          ESCANEA EL PRODUCTO             │
│          ████████████████                │
│                                          │
│          CAFE AMANECER 500GR             │
│                 $7.80                    │
│                                          │
│           ETIQUETA IMPRESA               │
│          Escanea siguiente...            │
└──────────────────────────────────────────┘
```

## Pantalla - Configuracion (`/settings`)

- Impresora: host (IP), puerto (9100), timeout
- Etiqueta: ancho y alto en mm
- Empresa: nombre que aparece en la etiqueta
- Guardar escribe `settings.json`

## Componentes de la Interfaz

| Componente | Archivo | Funcion |
|---|---|---|
| Captura de escaner | `scanner-input.tsx` | Escucha teclado, buffer hasta Enter |
| Tarjeta de producto | `product-card.tsx` | Muestra datos del producto |
| Stepper de cantidad | `quantity-stepper.tsx` | Aumenta/baja cantidad |
| Boton imprimir | `print-button.tsx` | Dispara POST /api/labels |
| Estado de impresion | `print-status.tsx` | Listo / Imprimiendo / Error |

## Principios de Diseno

1. **Velocidad** - Minimos clics para imprimir; el escaner no necesita clic
2. **Simplicidad** - Pocos campos, pocos botones
3. **Lectura clara** - Productos grandes, precios destacados
4. **Enfoque de teclado** - El input del escaner captura sin que el operador toque el mouse
5. **Operacion continua** - Listo para el siguiente escaneo

## Ver tambien

- [[Modo Continuo]]
- [[Plantilla Etiqueta]]
- [[Modulos del Programa]]
- [[Escaner USB]]