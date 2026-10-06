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
