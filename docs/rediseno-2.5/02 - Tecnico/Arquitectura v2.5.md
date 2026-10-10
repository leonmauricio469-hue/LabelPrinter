# Arquitectura v2.5

## Decisiones (D1–D6)

- **D1 — No se porta el HTML.** Se implementa en React/Next con ClearCraft traducido a
  tokens propios (`globals.css` `@theme` + `components/ui.ts`). El HTML de Stitch usa
  Tailwind por CDN: portarlo seria deuda instantanea. Ojo: el `AGENTS.md` del proyecto
  avisa que este Next 16 tiene breaking changes; leer sus docs antes de escribir codigo.
- **D2 — Un `AppShell` comun**: topbar (logo, pill de impresora real, zoom, Configurar,
  Imprimir) + tabs (Editor, Plantillas, Lotes, Dispositivos, Historial) + drawer lateral.
  Reemplaza al `AppNav` actual.
- **D3 — Funcionalidad real por boton**: REAL YA / ADAPTABLE / NUEVO / RECORTE
  (ver [[docs/rediseno-2.5/01 - Requisitos/Alcance y Recortes|Alcance y Recortes]]). Nada decorativo.
- **D4 — Datos nuevos minimos**, mismo patron actual (`data/*.json`, `server-only`):
  `plantillas.json`, `lotes.json` (+ extender `print-history.jsonl`).
- **D5 — Fuentes** via `next/font` (Inter + Plus Jakarta Sans), con fallback a system
  fonts si el entorno no tiene red.
- **D6 — Los `code.html` quedan como referencia** en temp, no se commitean.

## Rutas objetivo

| Ruta | Base | Cambio v2.5 |
|---|---|---|
| `/` | modo normal | Re-estilado + preview PNG real + pill de impresora |
| `/fast` | modo continuo | Re-estilado liviano (si vive; ver [[docs/rediseno-2.5/01 - Requisitos/Pendientes de Alcance|Pendientes de Alcance]]) |
| `/teclado` | diagnostico | Idem |
| `/lotes` | no existe | NUEVO (F5) |
| `/plantillas` | no existe | NUEVO (F4) |
| `/historial` | basico | Potenciado (F2). Posible rename a `/historial` igual |
| `/dispositivos` | `/settings` | Potenciado (F3) |
| `/editor` | geometria | Re-estilado + reconciliacion (F6) |

## Motor que NO se toca

`buildZpl`, `renderLabel` (preview = ZPL real), `barcode-plan`, override de plantilla,
`settings.json`, transportes USB/TCP, `print-history.jsonl`, 11/11 checks. La rueda no
se reinventa: solo cambia la piel y se agrega lo que falta.
