# Arquitectura General

## Diagrama del Sistema

```
┌─────────────┐    ┌─────────────────────┐
│   ESCANER   │───►│  NEXT.JS MONOLITO   │
│  USB (HID)  │    │  UI + API 1 proceso │
└─────────────┘    │  App Router         │
                   │  Catalogo local JSON│
                   └─────────┬───────────┘
                             │ ZPL crudo (USB o TCP 9100)
                             ▼
                    ┌─────────────────┐
                    │ Zebra GK420t    │
                    │ Impresora Termica│
                    └─────────────────┘
```

> Nota: XETUX / POSADMIN esta temporalmente fuera de alcance. Los datos vienen del **catalogo local** (`data/catalog.json`).

## Modulos del Monolito

| Modulo | Responsabilidad | Estado |
|---|---|---|
| UI (`app/`) | Paginas: normal, fast, settings, history | Las 4 pantallas listas |
| API (`app/api/`) | Endpoints de impresion, productos, config, historial | 6 endpoints, probados |
| Products | Repositorio sobre el catalogo local | Hecho (Patineta) |
| Labels | Template visual + builder ZPL | Hecho (Rueda) |
| Printing | Transport a la Zebra | Hecho: USB en uso, TCP sin probar |
| Settings | `settings.json` | Hecho |
| Audit | Historial de impresiones | Hecho (Patineta) |

## Decisiones Arquitectonicas

### 1. Un solo proceso (monolito)
Next.js sirve la interfaz Y expone la API. Corre en el PC del puesto y se accede por `http://localhost:3000`. Un solo deploy, una sola configuracion.

### 2. Sin base de datos
Los datos viven en archivos JSON: el **catalogo** de productos (`data/catalog.json`), la config (`settings.json`) y el historial plano (`print-history.jsonl`). Cero infraestructura.

### 3. Catalogo local aislado detras de un contrato
`product.repository` define el contrato y hoy lee el catalogo local. Cuando XETUX vuelva, solo cambia la implementacion del repositorio; la UI y el flujo de impresion no se tocan.

### 4. Impresion directa sin PDF
ZPL se envia crudo a la Zebra: por socket TCP 9100 si esta en red, o por la cola de Windows
si esta por USB. Sin dialogos de Windows, sin archivos intermedios. El campo `transport` de
`settings.json` elige cual de los dos se usa.

### 5. Diseno por capas
Presentacion (UI) -> Aplicacion (routes) -> Dominio (types/builders) -> Infraestructura (repos/transports). Detalle en [[Patrones de Diseno]].

## Ver tambien

- [[Stack Tecnologico]]
- [[Estructura de Carpetas]]
- [[Modulos del Programa]]
- [[Impresora Zebra GK420t]]