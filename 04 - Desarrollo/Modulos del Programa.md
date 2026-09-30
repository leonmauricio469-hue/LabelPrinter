# Modulos del Programa

## Mapa de modulos

```
┌────────────────────────────────────────────────────┐
│  app/ (UI)                                         │
│  / (normal)   /fast (continuo)   /settings  /history │
├────────────────────────────────────────────────────┤
│  app/api/ (borde del sistema)                      │
│  POST /api/labels        GET /api/products         │
│  GET/PUT /api/settings   GET /api/history          │
│  POST /api/printer/test  GET /api/printers         │
├────────────────────────────────────────────────────┤
│  lib/products/   repositorio de productos          │
│  lib/labels/     template + builder ZPL            │
│  lib/printing/   transport a la Zebra              │
│  lib/settings/   config JSON                       │
│  lib/audit/      historial de impresiones          │
└────────────────────────────────────────────────────┘
```

## Descripcion por modulo

### app/api/labels (Impresion)
- `POST` recibe `{ productCode, qty, mode }`
- El **precio sale del catalogo, nunca del cliente**: se busca el producto y el servidor arma el ZPL
- `productCode` admite codigo interno o barcode, porque el escaner entrega el barcode y el operador teclea el codigo
- Valida con zod, luego busca -> builder -> transport -> audit
- Devuelve `{ ok, printedAt, jobId, qty, product }`
- Un error del spooler se responde 502; un producto inexistente, 404

### app/api/products (Busqueda)
- `GET ?q=` codigo, barcode o nombre
- Exacta por codigo o barcode; si no hay coincidencia exacta, busqueda parcial
- Sin `q` devuelve el catalogo completo
- Responde 200 con lista vacia cuando no hay coincidencias, no 404

### app/api/settings (Configuracion)
- `GET` devuelve la config actual
- `PUT` valida y guarda en `settings.json`

### app/api/history (Historial)
- `GET ?limit=100` devuelve las ultimas impresiones, de la mas reciente a la mas antigua

### app/api/printer/test (Conexion)
- `POST` despacha segun `transport`: abre socket TCP o comprueba que la cola USB existe

### app/api/printers (Colas de Windows)
- `GET` lista las colas instaladas. Alimenta el desplegable de `/settings`

### lib/products
- `product.types.ts`: `interface Product { code, name, price, reference, barcode }`
- `product.repository.ts`: contrato (lee `data/catalog.json`)
- `product.catalog.repository.ts`: implementacion sobre el catalogo local
- `xetux.repository.ts`: integracion real (en suspenso, futura)

### lib/labels
- `label.template.ts`: zonas de la etiqueta (cabecera, producto, barcode, precio, ref)
- `zpl.builder.ts`: template + datos -> string ZPL

### lib/printing
- `printer.transport.ts`: `send(zpl): Promise<PrintResult>` + factory que elige implementacion
- `usb.transport.ts`: **en uso**. ZPL crudo a la cola de Windows vía `send-raw.ps1`
- `tcp.transport.ts`: socket 9100. Escrito, nunca probado con una Zebra real

### lib/settings
- `settings.store.ts`: lee/guarda `settings.json`
- Campos: impresora `{ transport, host, port, printerName }`, etiqueta `{ widthMm, heightMm, businessName }`
- Ojo: `widthMm` / `heightMm` **no llegan al ZPL**, la plantilla es fija. Deuda tecnica abierta

### lib/audit
- `audit.store.ts`: agrega lineas a `data/print-history.jsonl`
- Formato: `{ ts, jobId, code, name, qty, ok, mode, error? }`
- Registra tambien los fallos: sin ellos el historial solo diria "imprimio bien"

## Ver tambien

- [[Estructura de Carpetas]]
- [[Patrones de Diseno]]
- [[Arquitectura General]]