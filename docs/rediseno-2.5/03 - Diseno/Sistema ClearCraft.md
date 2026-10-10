# Sistema ClearCraft

Design system de las maquetas (modo claro). Al implementar se traduce a los tokens
propios (`globals.css` `@theme` + `components/ui.ts`); no se copian clases del HTML.

## Marca y estilo

Workbench de precision, utilitario y amable. Primario indigo/azul sobre superficies
palidas, bordes 1px, sombras tenues.

## Colores (ficha)

| Rol | Valor |
|---|---|
| Primario | `#2563EB` (hover `#1D4ED8`, foco anillo `#93C5FD`) |
| Secundario | `#0284C7` · Terciario/ok | `#059669` |
| Fondo app | `#F8FAFC` · Paneles | `#FFFFFF` |
| Bordes | `#E2E8F0` · Texto | `#0F172A` · Muted | `#64748B` |
| Error | `#BA1A1A` / `#EF4444` |

## Tipografias

- Titulos/estructura: **Plus Jakarta Sans** (display 32/700, headline 22–18/600, title 15/600).
- Datos/parametros: **Inter** (body 15/13/12, label 12/11 600, mono-numerico 12/500 `tnum`).
- Dimensiones fisicas (W/H/X/Y) siempre en mono-numerico tabular.

## Layout

Shell: topbar 48px + drawer izquierdo 260px + canvas central + inspector derecho 300px.
Radio base 8px (campos), 12–16px (paneles), pills 9999px. Sombras por niveles 0–4
(canvas → modales). Ver `DESIGN.md` en [[docs/rediseno-2.5/05 - Referencias/Stitch Original|Stitch Original]] para la ficha completa.
