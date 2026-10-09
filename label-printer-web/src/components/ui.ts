/**
 * Primitivos visuales compartidos.
 *
 * Por que existe: el estilo estaba repetido a mano en 7 paginas. `rounded-md border
 * border-neutral-300 px-4 py-2.5 text-sm ...` aparecia 14 veces con variaciones de 2
 * clases, y cambiar el radio o el padding era tocar cada aparicion por separado.
 *
 * Ahora el estilo de un boton se decide AQUI, una vez, y las paginas deciden cual boton.
 * Si mañana el botoner primario pasa de `bg-brand` a otro color, es un sitio, no 7.
 *
 * LA REGLA DE ORO
 *
 * Los semanticos (`ok` / `warn` / `danger`) son SOLO para feedback de estado. Un boton
 * verde decorativo deja al mismo color sin significado cuando algo sale bien de verdad.
 * Antes el proyecto ya cumplia esto en `print-status.tsx`, que es el sitio donde mas se
 * nota, y hay que no romperlo.
 *
 * Los nombres son en ingles por convencion de Tailwind; el texto visible siempre en
 * espanol.
 */

/** Contenedor de seccion: papel blanco sobre el fondo. */
export const card = "rounded-lg border border-line bg-surface shadow-card";

/** Variante hundida, para bloques de datos dentro de una tarjeta. */
export const sunken = "rounded-md border border-line bg-surface-sunken";

/** Titulo de seccion. Mismo tamaño en todas las paginas. */
export const h2 = "text-lg font-semibold tracking-tight text-ink";

/** Titulo de subseccion dentro de una tarjeta. */
export const h3 = "text-sm font-semibold tracking-tight text-ink";

/** Etiqueta de campo de formulario. */
export const label = "text-sm font-medium text-ink-soft";

/**
 * Input de formulario.
 *
 * El anillo de foco esta en `globals.css` como `:focus-visible`, asi que aqui solo se
 * pinta el borde. Antes cada input traia `focus:border-neutral-900 focus:outline-none`,
 * que desactivaba el outline global y dejaba el foco invisible a los lectores de pantalla
 * que no muestrean bordes.
 */
export const input =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-mute";

/** Select de formulario. Al mismo alto que `input` para que no bailen al alternar. */
export const select = `${input} appearance-none`;

/** Texto de ayuda bajo un campo. */
export const hint = "mt-1 text-xs leading-relaxed text-ink-mute";

/**
 * Boton base.
 *
 * `min-h` y no `h`: los botones crecen con el texto largo (el de imprimir cambia con la
 * cantidad) y `h` los cortaria en medio de una palabra. El `transition` es de 150 ms, no
 * mas: este operador pulsa el boton decenas de veces por hora y una animacion lenta se
 * siente como un retraso, no como un remate.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium " +
  "transition duration-150 disabled:cursor-not-allowed disabled:opacity-40";

/** Boton secundario: buscar, limpiar, probar. El color mas bajo del grupo. */
export const buttonGhost = `${base} border border-line-strong bg-surface text-ink hover:bg-surface-sunken`;

/** Boton informativo, no destructivo. */
export const buttonQuiet = `${base} bg-surface-sunken text-ink hover:bg-line`;

/** Boton destacado. El que manda. Solo uno por pantalla. */
export const buttonPrimary = `${base} bg-brand text-white hover:bg-brand-hover active:translate-y-px`;

/**
 * El boton de IMPRIMIR.
 *
 * Mas grande que el resto a proposito: es el unico que gasta papel y el unico al que se
 * llega sin mirar, con el raton en el mismo sitio siempre. `min-w` para que no se
 * encoge ni se ensancha entre 1 y 6 etiquetas: un boton que cambia de ancho hace que el
 * segundo clic caiga fuera.
 */
export const buttonPrint =
  `${base} min-w-[9.5rem] bg-brand px-8 py-3.5 text-base font-bold tracking-wide text-white hover:bg-brand-hover active:translate-y-px disabled:active:translate-y-0`;

/** Boton de aviso, para acciones reversibles que conviene frenar un poco. */
export const buttonWarn = `${base} border border-danger-line bg-danger-soft text-danger hover:bg-danger-line/40`;

/** Chip o badge de estado compacto. */
export const badge = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";

/*
 * ---- ClearCraft F0: clases nuevas. SOLO AGREGA, nada de arriba cambia. ----
 *
 * Las paginas siguen importando las de arriba; F1-F6 migraran cada pantalla a
 * estas. Usan los tokens `--color-primary`, `--color-edge`, `--color-panel`,
 * `--color-canvas`, `--color-strong`, `--radius-*` y `--shadow-*` de
 * `globals.css`. Reusan `base` (misma metrica de boton: min-h, 150 ms).
 */

/** Boton destacado ClearCraft: royal `#2563EB`, hover `#1D4ED8`. */
export const buttonClear = `${base} bg-primary text-white hover:bg-primary-hover active:translate-y-px`;

/** Boton secundario ClearCraft: papel blanco, borde sutil. */
export const buttonClearSecondary = `${base} border border-edge bg-panel text-strong hover:bg-canvas`;

/** Tarjeta ClearCraft: panel blanco, radio 12px, sombra flotante nivel 2. */
export const cardClear = "rounded-card border border-edge bg-panel shadow-float";

/** Pill ClearCraft (forma): el tono lo pone cada uso, como `badge`. */
export const pillClear = "inline-flex items-center gap-2 rounded-pill border border-edge bg-panel px-3 py-1.5 text-xs font-medium";

/** Titulo con la display (Plus Jakarta Sans): marca y encabezados del shell. */
export const displayTitle = "font-display font-bold tracking-tight text-strong";

/*
 * ---- ClearCraft F1: clases nuevas. SOLO AGREGA, nada de arriba cambia. ----
 */

/**
 * El boton de IMPRIMIR en ClearCraft.
 *
 * Primario royal (`bg-primary`) con la metrica estable de `buttonPrint`: `min-w`
 * para que no se encoja ni se ensanche entre 1 y 6 etiquetas (un boton que cambia
 * de ancho hace que el segundo clic caiga fuera) y altura mayor que el resto
 * porque es el unico que gasta papel.
 */
export const buttonClearPrint =
  `${buttonClear} min-w-[9.5rem] px-8 py-3.5 text-base font-bold tracking-wide disabled:active:translate-y-0`;

/*
 * ---- ClearCraft F2: clases nuevas. SOLO AGREGA, nada de arriba cambia. ----
 */

/** Badge de exito ClearCraft: SOLO para el resultado OK del historial. */
export const badgeOkClear = `${badge} bg-success-soft text-success`;

/** Badge de error ClearCraft: SOLO para los fallos del historial. */
export const badgeErrorClear = `${badge} bg-error-soft text-error`;

/** Etiqueta de KPI (Trabajos / Etiquetas / Fallos). */
export const kpiLabel = "text-xs font-medium uppercase tracking-wide text-muted";

/** Valor grande de KPI, tabular para que no baile al cambiar. */
export const kpiValue = "mt-0.5 text-2xl font-bold tabular-nums text-strong";

/** Encabezado de tabla ClearCraft. */
export const thClear = "px-3 py-2.5 font-medium";

/** Fila seleccionada en la tabla del historial. */
export const rowSelectedClear = "bg-primary-soft";

/*
 * ---- ClearCraft F4: clases nuevas. SOLO AGREGA, nada de arriba cambia. ----
 */

/** Tarjeta de plantilla: como `cardClear`, con hover para las que se pueden elegir. */
export const cardTemplateClear = `${cardClear} transition duration-150 hover:shadow-pop`;

/** Tarjeta de la plantilla activa: borde primario, para que se vea de un vistazo. */
export const cardTemplateActiveClear = `${cardClear} border-2 border-primary`;

/** Badge de plantilla activa. SOLO para la que imprime. */
export const badgeActiveClear = `${badge} bg-primary-soft text-primary`;

/** Badge de plantilla raw. Aviso honesto, no error: lo raw es valido, solo sin previa. */
export const badgeRawClear = `${badge} bg-warn-soft text-warn`;

/** Badge de archivada. Tono neutro: archivada no es rota, es guardada. */
export const badgeArchivedClear = `${badge} bg-canvas text-muted`;

/*
 * ---- ClearCraft F5: clases nuevas. SOLO AGREGA, nada de arriba cambia. ----
 */

/** Badge de lote en espera: neutro, todavia no toco la impresora. */
export const badgeLoteEsperaClear = `${badge} bg-canvas text-muted`;

/** Badge de lote en curso: primario, esta imprimiendo ahora. */
export const badgeLoteCursoClear = `${badge} bg-primary-soft text-primary`;

/** Badge de lote pausado: aviso, frenado entre etiquetas, retomable. */
export const badgeLotePausaClear = `${badge} bg-warn-soft text-warn`;

/** Badge de lote finalizado: exito, la cola se agoto. SOLO para ese estado. */
export const badgeLoteFinClear = `${badge} bg-success-soft text-success`;

/** Badge de lote cancelado: el operador lo aborto. */
export const badgeLoteCancClear = `${badge} bg-error-soft text-error`;

/** Badge de fila pendiente: neutra, todavia no se intento. */
export const badgeLotePendClear = `${badge} bg-canvas text-muted`;
