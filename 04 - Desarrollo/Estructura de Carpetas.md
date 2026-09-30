# Estructura de Carpetas

## Arbol de la aplicacion

```
label-printer-web/
├── next.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── data/                        # estado local SIN base de datos
│   ├── catalog.json             # catalogo de productos (fuente actual)
│   ├── settings.json            # config impresora / etiqueta / empresa
│   └── print-history.jsonl      # historial de impresiones (append line)
├── public/                      # estaticos (logo, imagenes)
└── src/
    ├── app/                     # rutas y UI (App Router)
    │   ├── layout.tsx
    │   ├── page.tsx             # / modo normal
    │   ├── fast/page.tsx        # /fast modo continuo
    │   ├── settings/page.tsx    # /settings configuracion
    │   ├── history/page.tsx     # /history historial
    │   └── api/
    │       ├── labels/route.ts  # POST imprimir etiquetas
    │       ├── products/route.ts# GET buscar producto
    │       ├── settings/route.ts# GET / PUT settings
    │       ├── history/route.ts # GET historial
    │       ├── printers/route.ts# GET lista de colas de Windows
    │       ├── printer/test/   # POST comprueba que la cola existe (no que imprima)
    │       └── printer/status/  # GET  estado real de la cola (?force=1 salta cache)
    ├── components/
    │   ├── app-nav.tsx             # navegacion entre modos (client, usePathname)
    │   ├── scanner-input.tsx       # captura del escaner (client)
    │   ├── product-card.tsx        # tarjeta de producto
    │   ├── quantity-stepper.tsx    # cantidad de etiquetas
    │   ├── print-status.tsx        # banner listo / imprimiendo / error
    │   ├── printer-status-banner.tsx  # estado real de la impresora (sondea en 2o plano)
    │   └── use-print.ts            # estado de impresion + llamadas al API
    └── lib/                     # logica de dominio e infraestructura
        ├── data/
        │   └── json-file.ts             # stripBom + error util de JSON (BOM de Windows)
        ├── products/
        │   ├── product.types.ts          # contrato de dominio (importable por el cliente)
        │   ├── product.repository.ts      # interfaz del repositorio
        │   ├── product.lookup.ts          # resolveQuery + MatchKind (exacto/aproximado/ninguno)
        │   ├── product.catalog.repository.ts  # implementacion sobre catalog.json
        │   └── xetux.repository.ts        # en suspenso (futura)
        ├── labels/
        │   ├── label.types.ts
        │   ├── label.template.ts
        │   ├── pa-picar-logo.ts          # logo como ^GF (generado por script)
        │   └── zpl.builder.ts            # buildZpl + buildZplBatch
        ├── printing/
        │   ├── printer.types.ts
        │   ├── printer.transport.ts      # interfaz + factory
        │   ├── tcp.transport.ts          # socket 9100 (sin probar)
        │   ├── usb.transport.ts          # cola de Windows (en uso)
        │   ├── queue.status.types.ts     # contrato de estado (lo usa el cliente)
        │   ├── queue.status.flags.ts     # mapa de banderas de Windows -> estado
        │   └── queue.status.ts           # lee el estado de la cola + cache
        ├── settings/
        │   ├── settings.types.ts
        │   └── settings.store.ts
        ├── audit/
        │   └── audit.store.ts            # print-history.jsonl
        └── validation/
            └── schemas.ts                # zod
```

Y los scripts de apoyo, fuera de `src/` porque no forman parte de la app:

```
label-printer-web/
├── scripts/
│   ├── send-raw.ps1          # P/Invoke al spooler (lo invoca usb.transport.ts)
│   │                         # modos: Send | Check | Status
│   ├── generate-logo.ps1     # regenera pa-picar-logo.ts desde un PNG
│   ├── preview-zpl.ts        # imprime el ZPL sin gastar papel
│   ├── check-ean.ts          # valida un catalog.json entero (digito de control)
│   └── check-queue-status.ts # 34 pruebas del mapa de banderas de la cola
└── tsconfig.preview.json     # compila el preview a CommonJS
```

> `preview-zpl.ts` se compila aparte con `tsc -p tsconfig.preview.json` porque usa imports sin
> extension y CommonJS, que no es como compila Next. Por eso `tsconfig.json` excluye `scripts`.

## Tipos de archivos y su proposito

| Archivo / sufijo  | Ubicacion        | Responsabilidad                    |
| ----------------- | ---------------- | ---------------------------------- |
| `*.page.tsx`      | `app/**`         | Pagina (componente de servidor)    |
| `*.layout.tsx`    | `app/**`         | Layout compartido                  |
| `*.route.ts`      | `app/api/**`     | Endpoint API (borde del sistema)   |
| `*.tsx` (client)  | `components/**`  | UI interactiva (scanner, stepper)  |
| `*.types.ts`      | `lib/**`         | Contratos de dominio               |
| `*.repository.ts` | `lib/**`         | Acceso a datos de productos        |
| `*.transport.ts`  | `lib/**`         | Envio fisico a la impresora        |
| `*.builder.ts`    | `lib/**`         | Generacion de string ZPL           |
| `*.template.ts`   | `lib/**`         | Plantilla visual de la etiqueta    |
| `*.store.ts`      | `lib/**`         | Lectura/escritura de archivos JSON |
| `schemas.ts`      | `lib/validation` | Validacion zod (DTOs)              |

## Dos excepciones a "lib/ es puro servidor"

Los modulos de cliente necesitan los **contratos**, no la infraestructura. Por eso hay
archivos `.types.ts` que no llevan `server-only` y que el cliente importa a proposito
(`product.types.ts`, `queue.status.types.ts`). El patron es el mismo en los dos casos.

Y hay un modulo que se separo justo para poder **probarlo sin arrancar nada**:
`queue.status.flags.ts` no habla con Windows ni con la impresora, solo decide. Se ejecuta
con `node .preview-build\scripts\check-queue-status.js` y comprueba las 27 banderas del enum
de Windows, incluidas las que no existen en ningun otro sitio.

## Reglas de colocacion

- Solo `app/` y `components/` tocan React.
- `lib/` es puro servidor (import `server-only`).
- Un modulo (products, printing...) vive en una sola carpeta.
- La UI nunca importa de infraestructura directamente; siempre via el contrato del modulo.

## Ver tambien

- [[Patrones de Diseno]]
- [[Modulos del Programa]]
- [[Stack Tecnologico]]