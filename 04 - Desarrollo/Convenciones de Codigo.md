# Convenciones de Codigo

## TypeScript

- Strict mode habilitado siempre
- Tipos con PascalCase en archivos `*.types.ts`
- Nunca `any`; usar `unknown` + schema zod para desarmar
- Imports con alias `@/` (apunta a `src/`), sin extensiones

## Naming

| Concepto           | Convencion                | Ejemplo                |
| ------------------ | ------------------------- | ---------------------- |
| Archivos           | kebab-case                | `printer.transport.ts` |
| Componentes        | PascalCase                | `ProductCard.tsx`      |
| Paginas            | kebab-case + sufijo page  | `fast/page.tsx`        |
| Rutas API          | kebab-case + sufijo route | `labels/route.ts`      |
| Tipos / interfaces | PascalCase                | `PrintResult`          |
| Constantes         | UPPER_SNAKE               | `LABEL_DEFAULT_QTY`    |
| Funciones          | camelCase                 | `buildLabel()`         |

## Next.js

- Componentes de servidor por defecto; `"use client"` solo cuando hay interactividad (scanner, stepper, spinner)
- Mutaciones via route handler POST o server actions
- Todo `lib/` con import `server-only` para nunca filtrarse al cliente

## Ciclo de impresion (flujo estandar)

```
POST /api/labels
  -> validar con schema (zod)
  -> buscar producto (product.repository)
  -> generar ZPL (zpl.builder)
  -> enviar (printer.transport)
  -> registrar (audit.store)
  -> responder { ok, jobId, printedAt }
```

## Ver tambien

- [[Patrones de Diseno]]
- [[Estructura de Carpetas]]