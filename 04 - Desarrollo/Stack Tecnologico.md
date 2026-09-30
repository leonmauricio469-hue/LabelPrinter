# Stack Tecnologico

## Decision Final

| Componente        | Tecnologia                  | Justificacion                                             |
| ----------------- | --------------------------- | --------------------------------------------------------- |
| Framework         | **Next.js (App Router)**    | Monolito completo: interfaz + API en un solo proceso      |
| Lenguaje          | **TypeScript (strict)**     | Tipado fuerte en toda la app                              |
| UI                | **React Server Components** | Server-side render por defecto, minimo JS en cliente      |
| Interfaz          | **Web en el navegador**     | El puesto abre `http://localhost:3000`, sin instalar nada |
| Estilos           | **Tailwind CSS**            | Rapido de prototipar y consistente                        |
| Validacion        | **zod**                     | DTOs tipados en el borde de la API                        |
| Impresion         | **Node child_process + spooler de Windows (RAW)** | ZPL crudo a la Zebra; el socket 9100 queda como alternativa sin probar |
| Persistencia      | **Archivos JSON**           | Sin base de datos: `settings.json` + historial `jsonl`    |
| Datos de producto | **Catalogo local (JSON)**   | XETUX en suspenso (se reintegrara cuando se decida)       |

## Dependencias

```
Next.js (App Router) + TypeScript strict
react / react-dom
zod
tailwindcss
```

No hay base de datos. Los datos son el catalogo local y la config en archivos JSON.

## Por que Next.js monolitico?

| Alternativa | Pros | Contras |
|---|---|---|
| **Next.js monolitico** | 1 deploy, SSR, API en la misma app, escaner funciona igual | Nada relevante para este alcance |
| NestJS (API) + React (SPA) | Separacion de responsabilidades | Dos apps que mantener, mas infraestructura |
| Next.js + base de datos externa | n/a | Complejidad innecesaria para este alcance |

**Decision**: Next.js App Router sirve la UI y expone la API de impresion en el mismo proceso. Todo el codigo es TypeScript strict. Corre en el PC del puesto y se abre en el navegador.

## Ver tambien

- [[Arquitectura General]]
- [[Estructura de Carpetas]]
- [[Patrones de Diseno]]