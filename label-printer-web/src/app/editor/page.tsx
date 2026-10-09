"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TEMPLATE, MM_TO_DOTS } from "@/lib/labels/label.template";
import { encodeCode128Auto } from "@/lib/labels/code128";
import {
  ASIDERES,
  MIN_DOTS,
  TITULO_ASIDERA,
  ejesRedimensionables,
  lados,
  redimensionar,
  type Asider,
  type ContextoResize,
} from "@/lib/labels/label.resize";
import { cajaEstimada, estirarMarco, type Marco } from "@/lib/labels/label.marco";
import { graphicDots, scaleGraphic } from "@/lib/labels/gf-graphic";
import { buscarProblemas } from "@/lib/labels/label-solapes";
import {
  badgeArchivedClear,
  badgeRawClear,
  buttonClear,
  buttonClearSecondary,
  cardClear,
  displayTitle,
  input,
  insertClear,
  layerActiveClear,
  layerRowClear,
  monoClear,
  rolBadgeClear,
  rulerClear,
  studioFooterClear,
  studioHeaderClear,
  studioSideClear,
  studioToolbarClear,
} from "@/components/ui";
import type { LabelZone } from "@/lib/labels/label.template";
import {
  EditorTabs,
  GuardarPlantillaPanel,
  OrigenTab,
  PruebaImpresionPanel,
  ZplTab,
  type AnyZone,
} from "@/components/editor-inspector";

/**
 * Editor visual de la plantilla.
 *
 * QUE ES Y QUE NO ES
 *
 * Es para decidir la geometria mirando, no para editar el codigo. El boton de abajo saca un
 * bloque de TypeScript con los valores finales, que es lo que se pega en `label.template.ts`.
 * Deliberadamente NO escribe el fichero desde el navegador: un POST que reescribe codigo
 * fuente es la clase de cosa que un dia se come una plantilla sin avisar.
 *
 * POR QUE EL DIBUJO VIENE DEL SERVIDOR
 *
 * El PNG lo pinta `renderLabel()`, que dibuja el ZPL de `buildZpl()`, que es el mismo que
 * va a la impresora. Dibujando en el navegador el editor ensenaria una geometria y la
 * impresora sacaria otra.
 *
 * F6: el editor edita la plantilla ACTIVA (`settings.label.templateId`). Solo la
 * 59x35 estructurada se abre en el workbench: es la unica cuya geometria entiende
 * el override (`plantilla-override.json` aplica SOLO a esa, ver
 * `label-override.store.ts`). Con otra activa (raw u otra estructurada) no hay
 * canvas ni inspector: aviso honesto, ZPL real y prueba real de la activa.
 */

interface Caja {
  etiqueta: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  texto?: string;
  /** Texto completo del `^FD` del que viene esta caja. Ver `RenderedZone.origen`. */
  origen?: string;
  alto?: number;
  anchoUsado?: number;
}

interface Preview {
  png: string;
  cajas: Caja[];
  resueltos: { indice: number; texto: string | null; alto: number; ancho: number }[];
  informe: string[];
  symbology: string | null;
  datosImpresos: string | null;
  anchoSimbolo: number;
  zonaQuieta: number;
  /** Modulo del plan de producto (F9, del preview): el `moduleWidth` de la zona. */
  modulo: number;
  /** Modulos del simbolo de producto (F9, del preview): 0 si no es imprimible. */
  modulos: number;
  /** Symbologia del plan de producto (F9, del preview): la que decide. */
  symPlan: string | null;
}

const MM = (dots: number) => dots / MM_TO_DOTS;
const DOTS = (mm: number) => Math.round(mm * MM_TO_DOTS);

/** Donde va cada asa, en tanto por ciento de la caja. */
const POS_ASIDERA: Record<Asider, { x: number; y: number }> = {
  nw: { x: 0, y: 0 },
  n: { x: 0.5, y: 0 },
  ne: { x: 1, y: 0 },
  e: { x: 1, y: 0.5 },
  se: { x: 1, y: 1 },
  s: { x: 0.5, y: 1 },
  sw: { x: 0, y: 1 },
  w: { x: 0, y: 0.5 },
};

/** El cursor de cada asa. Da la pista de que se puede arrastrar sin tener que leer el titulo. */
const CURSA_ASIDERA: Record<Asider, string> = {
  nw: "cursor-nwse-resize",
  n: "cursor-ns-resize",
  ne: "cursor-nesw-resize",
  e: "cursor-ew-resize",
  se: "cursor-nwse-resize",
  s: "cursor-ns-resize",
  sw: "cursor-nesw-resize",
  w: "cursor-ew-resize",
};

/**
 * Ancho en dots de la caja de texto de una zona, tal y como la ha dibujado el servidor.
 *
 * Sale del render y no de la zona porque, sin `maxWidthDots`, `emit()` no escribe `^FB`: la caja
 * no existe como dato y su ancho es el que ocupa el texto, que cambia con cada producto. Para
 * ensanchar esa caja hay que empezar por la medida que se ve, no por un supuesto.
 */
function anchoCajaDeTexto(
  indice: number,
  preview: Preview | null,
  pegables: number[],
): number | undefined {
  if (!preview) return undefined;
  const caja = preview.cajas[pegables.indexOf(indice)];
  if (!caja) return undefined;
  return Math.max(1, caja.x1 - caja.x0);
}

/**
 * Las zonas que se pueden mover y redimensionar arrastrando.
 *
 * El marco NO esta, y es lo unico que se ha sacado de aqui.
 *
 * En v1.6 se dejo que los cuatro tipos se movieran, con la razon de que "si el marco va a
 * 2 mm del borde, eso se decide mirando la etiqueta, y mirar exige poder arrastrarlo". La
 * razon era buena y la conclusion estaba equivocada: lo que se decide mirando la etiqueta
 * es el ancho del rollo, que es lo de `/settings`, no la posicion del marco.
 *
 * El marco es el margen fisico del papel. Si el borde queda a 0,4 mm del canto, la impresora
 * lo corta y la etiqueta sale con un lado comido, y eso no se arregla ni con ZPL ni con
 * arrastre. Es ademas la unica zona cuya medida se deduce sola de la plantilla
 * (`ANCHO_DOTS` menos el margen), de modo que si se pudiera mover, `label.template.ts` y lo
 * guardado en `data/plantilla-override.json` dirian dos cosas distintas y no habria forma de
 * saber cual manda.
 *
 * Sigue apareciendo en la lista, en gris y con "(fija)", y sigue dibujandose en la
 * previsualizacion: quitado del editor no es quitado de la etiqueta. Lo que se quita es el
 * tirador, que es lo que invita a moverlo.
 *
 * F8b: `"rect"` y `"line"` son figuras libres del operador y SI se editan, aunque tambien
 * salgan por `^GB`. El `kind` distinto es lo que permite esto: `"shape"` sigue siendo
 * solo el marco fijo, y las libres van por su propio camino.
 */
const EDITABLES = new Set(["text", "barcode", "graphic", "rect", "line"]);

const TITULOS: Record<string, string> = {
  productName: "descripcion",
  price: "precio",
  referenceLabel: "REF:",
  reference: "referencia",
  barcode: "codigo de barras",
  fixed: "texto libre",
};

/** Los identificadores de las zonas fijas, para que la lista no diga "zona 0". */
const FIJAS: Record<string, string> = {
  shape: "marco",
  graphic: "logo",
};

function etiquetaDe(z: AnyZone, i: number): string {
  if (z.kind === "barcode") return "codigo de barras";
  if (z.kind === "rect") return "rectangulo";
  if (z.kind === "line") return "linea";
  if (FIJAS[z.kind]) return FIJAS[z.kind];
  const src = String(z.source ?? "");
  return TITULOS[src] ?? `zona ${i}`;
}

/**
 * La primera zona que se puede tocar.
 *
 * El marco es la primera zona de la plantilla, y ya no es editable, asi que sin esto el editor
 * abriria con el marco seleccionado y sin ningun panel que enseñe. Empieza en la siguiente.
 */
function primeraEditable(zonas: AnyZone[]): number {
  const i = zonas.findIndex((z) => EDITABLES.has(z.kind));
  return i < 0 ? 0 : i;
}

type RolZona = "Fijo" | "Serie" | "Catálogo" | "Libre";

/**
 * Rol de cada zona para los badges de la lista ZONAS/CAPAS (F9, documentado).
 *
 * Mapeo: marco/logo/referenceLabel = Fijo; productName/barcode/barcodeData =
 * Serie; price = Catalogo; fixed/rect/line = Libre. `reference` y `header` no
 * estan en la lista del encargo: salen del catalogo/negocio por codigo (varian
 * por producto), asi que son Serie. El logo duplicado (graphic que no es el de
 * serie) y el codigo fijo son Libre: los puso el operador y se pueden borrar.
 */
function rolDe(z: AnyZone, i: number, logoSerie: number): RolZona {
  if (z.kind === "shape") return "Fijo";
  if (z.kind === "rect" || z.kind === "line") return "Libre";
  if (z.kind === "graphic") return i === logoSerie ? "Fijo" : "Libre";
  if (z.kind === "barcode") return String(z.source ?? "barcode") === "fixed" ? "Libre" : "Serie";
  const s = String(z.source ?? "");
  if (s === "fixed") return "Libre";
  if (s === "price") return "Catálogo";
  if (s === "referenceLabel") return "Fijo";
  return "Serie";
}

/**
 * Subtitulo real de cada fila de capas: coordenadas + que es.
 *
 * Todo sale de la zona (o del preview para la symbologia de producto): nada
 * inventado. El codigo fijo dice "Code128 fijo" porque SIEMPRE es Code 128
 * (`^BCN`); el de producto dice la symbologia del plan de la muestra actual.
 */
function detalleZona(z: AnyZone, symbology: string | null): string {
  const xy = `en ${String(z.x)},${String(z.y)}`;
  if (z.kind === "shape") return `${xy} · Borde papel`;
  if (z.kind === "graphic") {
    const d = graphicDots(String(z.gf ?? "")).dots;
    return d ? `${xy} · GFA ${d.w}x${d.h}` : `${xy} · GFA`;
  }
  if (z.kind === "barcode") {
    return String(z.source ?? "barcode") === "fixed"
      ? `${xy} · Code128 fijo`
      : `${xy} · ${symbology ?? "…"}`;
  }
  if (z.kind === "rect") return `${xy} · ${String(z.widthDots)}x${String(z.heightDots)} ^GB`;
  if (z.kind === "line") return `${xy} · ${String(z.largoDots)} ${String(z.orientacion)}`;
  const s = String(z.source ?? "");
  return `${xy} · ${s === "fixed" ? "fijo" : s}${z.autoFit ? " · AutoFit" : ""}`;
}

/**
 * Que zona de la plantilla corresponde a cada caja dibujada.
 *
 * NO es el mismo indice. `label.render.ts` saca las cajas del ZPL, asi que van en el orden en
 * que `emit()` las escribe, y ese orden no coincide con el del array `zones` (las zonas fijas
 * no se dibujan y el logo va el primero aunque sea la tercera zona).
 *
 * El emparejamiento va por el texto del `^FD` completo (`origen`), no por el trozo de la
 * linea: un nombre plegado en dos lineas sale en dos cajas con dos trozos distintos, y
 * emparejar por trozo devolvia `-1` y dejaba la zona sin caja arrastrable. Con `origen` las
 * cajas de un mismo plegado apuntan todas a su zona, y una zona de una sola linea sigue
 * emparejando por su texto entero, que es el mismo que su `origen`.
 *
 * Las barras son la unica zona de tipo `barcode` y el logo la unica de tipo `graphic`, asi
 * que esos dos van directos.
 *
 * Devuelve `-1` en las cajas que no corresponden a ninguna zona editable, que es como se sabe
 * que ese elemento no se debe mover.
 */
function mapearCajas(
  cajas: Caja[],
  zones: AnyZone[],
  resueltos: { indice: number; texto: string | null }[],
): number[] {
  const usados = new Set<number>();
  const map: number[] = cajas.map(() => -1);
  // Zona de la caja de texto anterior: decide si el siguiente trozo CONTINUA el mismo
  // plegado o empieza la caja de otra zona.
  let anterior = -1;

  // F9: puede haber VARIAS zonas de codigo y de logo (fijas + duplicados). Las
  // cajas salen en orden de emision y `emit()` recorre las zonas en orden, asi
  // que la n-esima caja de barras es de la n-esima zona de codigo. Con una sola
  // zona esto es identico al `findIndex` de antes.
  const colas: Record<string, number[]> = { barras: [], logo: [], marco: [] };
  zones.forEach((z, j) => {
    if (z.kind === "barcode") colas.barras.push(j);
    else if (z.kind === "graphic") colas.logo.push(j);
    else if (z.kind === "shape") colas.marco.push(j);
  });
  const turno: Record<string, number> = { barras: 0, logo: 0, marco: 0 };

  cajas.forEach((c, i) => {
    // El marco no tiene texto, asi que sin emparejarlo por tipo se quedaba sin caja
    // asociada: era la razon de que no se pudiera mover. Por tipo funciona porque solo hay
    // una zona de cada uno de estos tres tipos.
    if (c.etiqueta === "barras" || c.etiqueta === "logo" || c.etiqueta === "marco") {
      const cola = colas[c.etiqueta] ?? [];
      const j = cola[Math.min(turno[c.etiqueta], Math.max(0, cola.length - 1))] ?? -1;
      turno[c.etiqueta] += 1;
      map[i] = j;
      // Se guarda el INDICE DE ZONA, porque `usados` se compara contra `resueltos`, que va
      // por zona. Guardar el indice de caja ahi hacia que dos numeros distintos se
      // compararan como si fueran el mismo, y tumbaba el emparejamiento de las siguientes
      // cajas de texto.
      if (j >= 0) usados.add(j);
      anterior = -1;
      return;
    }
    if (!c.texto) return;
    const origen = c.origen ?? c.texto;

    // Continuidad de linea: mismo `^FD` que la caja anterior y texto de zona mas largo que
    // el trozo (la zona esta plegada). Solo asi se reutiliza una zona ya usada. Si el texto
    // de la zona fuera igual al trozo, seria una zona de una sola linea robando las cajas de
    // otra con el mismo texto, y ahi manda el `usados` de abajo.
    if (anterior >= 0) {
      const r = resueltos[anterior];
      if (r && r.texto === origen && r.texto !== c.texto) {
        map[i] = anterior;
        return;
      }
    }

    // Primero una zona sin usar, para que dos zonas con el mismo texto no acaben las dos
    // colgando de la primera; si no queda ninguna, se reutiliza la que tenga ese texto
    // (es la identidad exacta del `^FD`, asi que o es una linea mas del plegado o hay dos
    // zonas con texto identico y no hay ninguna senal que las desdiferencie).
    const j =
      resueltos.find((r) => r.texto === origen && !usados.has(r.indice))?.indice ??
      resueltos.find((r) => r.texto === origen)?.indice ??
      -1;
    map[i] = j;
    if (j >= 0) usados.add(j);
    anterior = j;
  });

  return map;
}

export default function EditorPage() {
  const [zones, setZones] = useState<AnyZone[]>(
    structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[],
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  /**
   * Las zonas con las que el servidor dibujo `preview`.
   *
   * La diferencia entre estas y `zones` es lo que desplaza la caja seleccionada mientras no
   * contesta el servidor: si la ultima respuesta se dibujo con la zona en (x, y) y ahora la
   * zona esta en (x + 10, y), el render la va a pintar 10 dots mas a la derecha, y la caja
   * puede anticiparse a eso sin inventar geometria. Cuando la respuesta llega, la diferencia
   * se hace cero y la caja queda donde la pinto el servidor.
   */
  /**
   * El estirado en curso, o el ultimo hasta que llegue el render nuevo.
   *
   * Mover NO necesita estado: la zona se actualiza con cada fotograma y `cajaEstimada()` de
   * esa zona ya es el marco, asi que sigue al puntero solo. Estirar si, porque la zona
   * cuantiza (modulos de 95 en 95, logo a multiplos de 8, letra en dots enteros) y el marco
   * tiene que seguir al RATON mientras dure el gesto; al soltar, el render del servidor
   * ajusta el marco a lo que de verdad se imprime.
   */
  const [estirando, setEstirando] = useState<{
    indice: number;
    asa: Asider;
    base: Marco;
    dx: number;
    dy: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<number>(() =>
    primeraEditable(structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[]),
  );
  const [nombre, setNombre] = useState("BADIA JALAPEÑO 2 OZ");
  const [barcode, setBarcode] = useState("033844007522");
  const [precio, setPrecio] = useState(5.68);
  const [zoom, setZoom] = useState(3);
  const [mostrarCajas, setMostrarCajas] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [aplicado, setAplicado] = useState<{ texto: string; clave: string } | null>(null);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const [rechazoDetalle, setRechazoDetalle] = useState<string[]>([]);
  const [hayOverride, setHayOverride] = useState(false);
  const [guardado, setGuardado] = useState<{ savedAt: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * La plantilla ACTIVA (`settings.label.templateId` + biblioteca).
   *
   * El editor solo abre la 59x35 estructurada: es la unica cuya geometria
   * entiende el override. La regla es la misma que en la biblioteca F4
   * (`template-detail.tsx`): estructurada + id `papicar-59x35` + activa.
   */
  interface ActivaInfo {
    id: string;
    name: string;
    kind: "estructurada" | "raw";
    widthMm: number;
    heightMm: number;
    widthDots: number;
    heightDots: number;
    dpi: number;
    category: string;
    archived: boolean;
  }
  const [activa, setActiva] = useState<ActivaInfo | null>(null);
  const [activaError, setActivaError] = useState<string | null>(null);
  const [negocio, setNegocio] = useState("PA PICAR");
  const editable =
    activa !== null && activa.kind === "estructurada" && activa.id === DEFAULT_TEMPLATE.id;

  /** Productos reales del catalogo, para la muestra de la prueba (la prueba imprime de verdad). */
  interface Muestra {
    code: string;
    name: string;
    barcode: string;
    price: number;
  }
  const [productos, setProductos] = useState<Muestra[]>([]);
  const [muestra, setMuestra] = useState("");

  /** Pestanas del bloque inferior: ZPL real y origen de cada zona. */
  const [tab, setTab] = useState<"zpl" | "origen">("zpl");
  const [zpl, setZpl] = useState<string | null>(null);
  const [zplCargando, setZplCargando] = useState(false);
  const [zplError, setZplError] = useState<string | null>(null);
  const [zplTick, setZplTick] = useState(0);

  /** Guardar como plantilla: nombre pedido en UI, siempre plantilla nueva. */
  const [nombrePlantilla, setNombrePlantilla] = useState("");
  const [guardandoPlantilla, setGuardandoPlantilla] = useState(false);
  const [plantillaCreada, setPlantillaCreada] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [plantillaError, setPlantillaError] = useState<string | null>(null);

  /**
   * Undo/redo (F9): pila de snapshots de `zones` en commits discretos.
   *
   * Solo se compromete al agregar, al borrar, al SOLTAR un arrastre o un
   * estirado, y cuando una edicion de campos se confirma (al salir del panel
   * de propiedades). Los fotogramas intermedios del arrastre NO van a la pila:
   * un arrastre es un commit, no cien. Tope 50 snapshots; mas alla se tira lo
   * mas viejo. Cargar o descartar el override no es una edicion: reinicia la
   * pila con lo cargado como punto de partida.
   *
   * Va en un ref + contador de version (para pintar deshabilitados honestos) y
   * no en estado, porque los commits llegan desde `setTimeout` (fin de gesto)
   * y desde `onBlur`, donde el estado de la pila estaria desfasado.
   */
  const histRef = useRef<{ stack: AnyZone[][]; idx: number } | null>(null);
  if (histRef.current === null) {
    histRef.current = {
      stack: [structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[]],
      idx: 0,
    };
  }
  const [histVer, setHistVer] = useState(0);
  /** Espejo de `zones` ya pintado: el fin de gesto compromete DESPUES de pintar. */
  const zonesRef = useRef<AnyZone[]>(zones);
  zonesRef.current = zones;
  /** JSON del ultimo commit: asi el blur solo compromete si algo cambio. */
  const ultimoCommitRef = useRef<string>(JSON.stringify(DEFAULT_TEMPLATE.zones));
  const puedeUndo = (histRef.current?.idx ?? 0) > 0;
  const puedeRedo =
    (histRef.current?.idx ?? 0) < (histRef.current?.stack.length ?? 1) - 1;

  function comprometer(zs: AnyZone[]) {
    const h = histRef.current;
    if (!h) return;
    h.stack = [...h.stack.slice(0, h.idx + 1), structuredClone(zs) as unknown as AnyZone[]];
    if (h.stack.length > 50) h.stack = h.stack.slice(-50);
    h.idx = h.stack.length - 1;
    ultimoCommitRef.current = JSON.stringify(zs);
    setHistVer((v) => v + 1);
  }

  /** Compromete lo que YA esta pintado (fin de arrastre/estirado, logo, toggle). */
  function comprometerActual() {
    window.setTimeout(() => comprometer(zonesRef.current), 0);
  }

  /** Cargar/descartar no es editar: la pila empieza de nuevo en lo cargado. */
  function baseHistorial(zs: AnyZone[]) {
    histRef.current = { stack: [structuredClone(zs) as unknown as AnyZone[]], idx: 0 };
    ultimoCommitRef.current = JSON.stringify(zs);
    setHistVer((v) => v + 1);
  }

  function deshacer() {
    const h = histRef.current;
    if (!h || h.idx <= 0) return;
    h.idx -= 1;
    const zs = structuredClone(h.stack[h.idx]) as unknown as AnyZone[];
    setEstirando(null);
    setZones(zs);
    setSel((s) => Math.min(s, Math.max(0, zs.length - 1)));
    ultimoCommitRef.current = JSON.stringify(zs);
    setHistVer((v) => v + 1);
  }

  function rehacer() {
    const h = histRef.current;
    if (!h || h.idx >= h.stack.length - 1) return;
    h.idx += 1;
    const zs = structuredClone(h.stack[h.idx]) as unknown as AnyZone[];
    setEstirando(null);
    setZones(zs);
    setSel((s) => Math.min(s, Math.max(0, zs.length - 1)));
    ultimoCommitRef.current = JSON.stringify(zs);
    setHistVer((v) => v + 1);
  }

  /**
   * Pill de impresora REAL (F9): sale de `/api/printer/status`, cero numeros
   * inventados. Mapeo documentado a los textos del mockup:
   *
   *   blocked/missing -> "Bloqueada: ..." (SOLO con estos dos estados reales;
   *     prohibido el texto sin estado detras)
   *   busy            -> "Ocupada: ..." (+ trabajos en cola si hay)
   *   warning         -> "Aviso: ..."
   *   ready           -> "Lista: ..." (cola + puerto reales)
   *   unknown         -> "Estado desconocido: ..."
   *
   * El boton Actualizar re-sondea con `force=1`; ademas se sondea cada 20 s
   * (mismo suelo que el banner) solo con la pestana visible.
   */
  interface EstadoImpresora {
    state: string;
    message: string;
    jobCount: number;
    queue: string;
    port: string | null;
    error: string | null;
  }
  const [imp, setImp] = useState<EstadoImpresora | null>(null);
  const [impCargando, setImpCargando] = useState(true);
  const leerImp = useCallback(async (fuerte: boolean, avisa: boolean) => {
    if (avisa) setImpCargando(true);
    try {
      const res = await fetch(
        fuerte ? "/api/printer/status?force=1" : "/api/printer/status",
        { cache: "no-store" },
      );
      const j = (await res.json().catch(() => null)) as {
        state?: unknown;
        message?: unknown;
        jobCount?: unknown;
        error?: unknown;
        raw?: { queue?: unknown; port?: unknown };
      } | null;
      setImp({
        state: typeof j?.state === "string" ? j.state : "unknown",
        message: typeof j?.message === "string" ? j.message : "sin respuesta",
        jobCount: typeof j?.jobCount === "number" ? j.jobCount : 0,
        queue: typeof j?.raw?.queue === "string" ? j.raw.queue : "",
        port: typeof j?.raw?.port === "string" ? j.raw.port : null,
        error: typeof j?.error === "string" ? j.error : null,
      });
    } catch (e) {
      setImp({
        state: "unknown",
        message: "No se pudo consultar el estado de la impresora",
        jobCount: 0,
        queue: "",
        port: null,
        error: (e as Error).message,
      });
    } finally {
      if (avisa) setImpCargando(false);
    }
  }, []);
  useEffect(() => {
    void leerImp(true, true);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void leerImp(false, false);
    }, 20000);
    return () => clearInterval(t);
  }, [leerImp]);

  /** Version REAL del package (F9): viene del GET de preview, nunca escrita a mano. */
  const [version, setVersion] = useState<string | null>(null);
  /** Coordenadas reales del cursor sobre la etiqueta, en mm. Fuera = null. */
  const [cursor, setCursor] = useState<{ xMm: number; yMm: number } | null>(null);
  /** Menu de "+ Anadir zona personalizada": los 5 tipos con handlers reales. */
  const [menuZonas, setMenuZonas] = useState(false);
  /** Cambiar imagen del logo (F9): fichero, subida y error honesto. */
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  /** Imprimir prueba: gasta 1 etiqueta de verdad. Nunca se invoca solo. */
  const [imprimiendo, setImprimiendo] = useState(false);
  const [pruebaOk, setPruebaOk] = useState<string | null>(null);
  const [pruebaError, setPruebaError] = useState<string | null>(null);

  /** Lee la activa, el negocio y las muestras al abrir. Sin esto no se sabe que se edita. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const s = (await fetch("/api/settings").then((r) => r.json())) as {
          label?: { businessName?: unknown; templateId?: unknown };
        };
        if (!vivo) return;
        if (typeof s?.label?.businessName === "string" && s.label.businessName !== "") {
          setNegocio(s.label.businessName);
        }
        const tid =
          typeof s?.label?.templateId === "string" && s.label.templateId !== ""
            ? s.label.templateId
            : DEFAULT_TEMPLATE.id;
        const t = await fetch(`/api/templates/${encodeURIComponent(tid)}`);
        if (!vivo) return;
        if (!t.ok) {
          const j = (await t.json().catch(() => null)) as { error?: string } | null;
          setActiva(null);
          setActivaError(j?.error ?? `La plantilla "${tid}" no existe`);
          return;
        }
        const tpl = (await t.json()) as ActivaInfo;
        setActiva({
          id: tpl.id,
          name: tpl.name,
          kind: tpl.kind,
          widthMm: tpl.widthMm,
          heightMm: tpl.heightMm,
          widthDots: tpl.widthDots,
          heightDots: tpl.heightDots,
          dpi: tpl.dpi,
          category: tpl.category,
          archived: tpl.archived,
        });
        setActivaError(null);
      } catch (e) {
        if (vivo) {
          setActiva(null);
          setActivaError((e as Error).message);
        }
      }
    })();
    (async () => {
      try {
        const j = (await fetch("/api/editor/preview").then((r) => r.json())) as {
          productos?: Muestra[];
          version?: unknown;
        };
        if (!vivo || !Array.isArray(j?.productos)) return;
        setProductos(j.productos);
        if (typeof j?.version === "string") setVersion(j.version);
        const preferida =
          j.productos.find((p) => p.barcode === "033844007522") ?? j.productos[0];
        if (preferida) setMuestra(preferida.code);
      } catch {
        // Sin muestras no hay prueba de impresion, pero el resto sigue en pie.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Carga el estado guardado al abrir.
   *
   * Solo con la 59x35 editable: con otra activa no hay override que cargar y
   * las zonas en pantalla no significarian nada.
   *
   * Sin esto, recargar la pagina con un override activo ensenaria la plantilla del `.ts` y
   * pareceria que el boton no ha hecho nada, cuando en realidad se sigue imprimiendo con lo
   * guardado. La pantalla tiene que abrir en lo que de verdad se usa.
   */
  useEffect(() => {
    if (!editable) return;
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/editor/apply");
        const j = await r.json();
        if (!vivo) return;
        setHayOverride(Boolean(j.activo));
        setGuardado(j.activo ? { savedAt: j.savedAt } : null);

        if (!j.activo || !Array.isArray(j.zones)) return;
        const cargadas = structuredClone(j.zones) as unknown as AnyZone[];
        setZones(cargadas);
        setSel(primeraEditable(cargadas));
        // Lo cargado es otro punto de partida, no una edicion: la pila de
        // undo empieza aqui.
        baseHistorial(cargadas);
        setAplicado({
          texto:
            `Cargado lo que hay guardado (${j.savedAt}). Estos son los valores con los que se ` +
            `esta imprimiendo, no los del codigo.`,
          clave: JSON.stringify(cargadas),
        });
      } catch {
        // Si el estado guardado no se puede leer, la pantalla arranca con la del codigo. Es
        // mejor que quedarse en blanco: el preview se dibuja igual y se ve en que plantilla.
      }
    })();
    return () => {
      vivo = false;
    };
  }, [editable]);

  /**
   * Guarda la geometria en `data/plantilla-override.json`.
   *
   * El servidor vuelve a renderizar antes de escribir y devuelve 422 con el detalle si las
   * zonas se pisan o se salen del rollo, asi que el boton no guarda nunca una plantilla rota.
   * Ahi se pierde el cambio, pero no el papel.
   */
  async function aplicar() {
    setAplicando(true);
    setRechazo(null);
    setRechazoDetalle([]);
    try {
      const res = await fetch("/api/editor/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: DEFAULT_TEMPLATE.id,
          zones,
          zonesWithoutBarcode: DEFAULT_TEMPLATE.zonesWithoutBarcode,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setAplicado(null);
        setRechazo(j.error ?? "no se ha podido guardar");
        setRechazoDetalle(Array.isArray(j.detalles) ? j.detalles : []);
        return;
      }
      setAplicado({ texto: j.aviso ?? "Guardado.", clave: JSON.stringify(zones) });
      setHayOverride(true);
      setGuardado({ savedAt: new Date().toISOString() });
    } catch (e) {
      setAplicado(null);
      setRechazo((e as Error).message);
    } finally {
      setAplicando(false);
    }
  }

  /** Borra el override. A partir de aqui se imprime con la plantilla del codigo. */
  async function descartar() {
    setAplicando(true);
    try {
      const res = await fetch("/api/editor/apply", { method: "DELETE" });
      if (!res.ok) {
        setRechazo("No se ha podido descartar.");
        return;
      }
      setHayOverride(false);
      setGuardado(null);
      setAplicado({
        texto: "Descartado. Se vuelve a la plantilla del codigo.",
        clave: JSON.stringify(DEFAULT_TEMPLATE.zones),
      });
      const base = structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[];
      setZones(base);
      setSel(primeraEditable(base));
      // Otro punto de partida, no una edicion.
      baseHistorial(base);
    } catch (e) {
      setRechazo((e as Error).message);
    } finally {
      setAplicando(false);
    }
  }

  // Solo vale la ultima peticion. Sin abortar, un arrastre rapido dejaba varias respuestas
  // en vuelo, y una respuesta lenta de ATRAS llegaba despues que la nueva y devolvia las
  // cajas a posiciones que ya no eran las buenas: el dibujo se movia solo para atras.
  const ctrlPeticion = useRef<AbortController | null>(null);

  const pedir = useCallback(async () => {
    // Sin la 59x35 editable no hay canvas: no se pide ningun render.
    if (!editable) return;
    ctrlPeticion.current?.abort();
    const mia = new AbortController();
    ctrlPeticion.current = mia;
    setBusy(true);
    try {
      // El snapshot de las zonas pedidas. `pedir` se recrea con cada cambio de `zones`, asi
      // que la `zones` del cierre es exactamente la que manda el cuerpo: si la respuesta
      // llega, es la respuesta para ESTE estado y el preview no se pinta con datos viejos.
      const pedidas = zones;
      const res = await fetch("/api/editor/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zones: pedidas,
          data: {
            productName: nombre,
            barcode,
            price: precio,
            reference: "RETAIL",
            businessName: "PA PICAR",
          },
          scale: zoom,
        }),
        signal: mia.signal,
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "fallo desconocido");
        return;
      }
      setPreview(j);
      setError(null);
    } catch (e) {
      // Una peticion abortada no es un error: es la senal de que ya no importa.
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message);
    } finally {
      // El `busy` solo lo suelta quien sigue siendo la ultima: si no, una abortada dejaria
      // el "calculando..." encima mientras la buena sigue dibujando.
      if (ctrlPeticion.current === mia) setBusy(false);
    }
  }, [zones, nombre, barcode, precio, zoom, editable]);

  // Cada cambio agenda una peticion. El retardo agrupa el tecleo rapido en una sola llamada.
  useEffect(() => {
    if (!editable) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(pedir, 180);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pedir]);

  /**
   * El ZPL texto de la pestana: lo guardado, con la misma muestra del canvas.
   *
   * No sale de las zonas en pantalla sino de `GET /api/editor/zpl` (activa +
   * override aplicado, misma muestra): con cambios sin aplicar, el texto es el
   * de lo guardado y se dice. Por eso depende de `aplicado`/`guardado` y no de
   * cada pulsacion: solo cambia cuando cambia lo guardado o la muestra.
   */
  useEffect(() => {
    if (tab !== "zpl" || !activa) return;
    let vivo = true;
    setZplCargando(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const q = new URLSearchParams({
            productName: nombre,
            barcode,
            price: String(precio),
          });
          const res = await fetch(`/api/editor/zpl?${q.toString()}`);
          if (!vivo) return;
          if (res.ok) {
            setZpl(await res.text());
            setZplError(null);
          } else {
            const j = (await res.json().catch(() => null)) as { error?: string } | null;
            setZpl(null);
            setZplError(j?.error ?? `La app respondio ${res.status}`);
          }
        } catch (e) {
          if (vivo) {
            setZpl(null);
            setZplError((e as Error).message);
          }
        } finally {
          if (vivo) setZplCargando(false);
        }
      })();
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [tab, activa, nombre, barcode, precio, aplicado, guardado, zplTick]);

  /**
   * Guardar como plantilla: la geometria efectiva actual, como plantilla nueva.
   *
   * DESVIO DECLARADO: `POST /api/templates` no sirve (solo acepta
   * `{ name, category?, from }` y copia las zonas guardadas, ignorando lo que
   * se ve en el canvas; `PUT` solo renombra) y no se pueden extender (fuera de
   * superficie F6). Se usa `POST /api/templates/import` con `format: "json"`,
   * endpoint existente sin modificar, que si crea estructuradas con zonas
   * propias e id nuevo. Lo importado es copia, nunca reemplazo.
   */
  async function guardarComoPlantilla() {
    if (!activa) return;
    setGuardandoPlantilla(true);
    setPlantillaError(null);
    try {
      const ahora = new Date().toISOString();
      const res = await fetch("/api/templates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "json",
          content: {
            id: "editor-temporal",
            name: nombrePlantilla.trim(),
            category: activa.category,
            kind: "estructurada",
            widthMm: activa.widthMm,
            heightMm: activa.heightMm,
            dpi: activa.dpi,
            zones,
            zonesWithoutBarcode: DEFAULT_TEMPLATE.zonesWithoutBarcode,
            archived: false,
            createdAt: ahora,
            updatedAt: ahora,
          },
        }),
      });
      const j = (await res.json()) as { id: string; name: string; error?: string };
      if (!res.ok) {
        setPlantillaCreada(null);
        setPlantillaError(j.error ?? `La app respondio ${res.status}`);
        return;
      }
      setPlantillaCreada({ id: j.id, name: j.name });
    } catch (e) {
      setPlantillaCreada(null);
      setPlantillaError((e as Error).message);
    } finally {
      setGuardandoPlantilla(false);
    }
  }

  /**
   * Imprimir prueba: 1 etiqueta de verdad con la activa y un codigo real.
   *
   * Nunca se invoca solo: siempre tras `window.confirm` que dice que gasta
   * papel. El resultado se muestra verbatim (el JSON tal cual responde
   * `POST /api/labels`).
   */
  async function imprimirPrueba() {
    if (!activa || muestra.trim() === "") return;
    if (
      !window.confirm(
        `La prueba se imprime de verdad y gasta 1 etiqueta con la plantilla ` +
          `«${activa.name}». ¿Imprimirla?`,
      )
    ) {
      return;
    }
    setImprimiendo(true);
    setPruebaOk(null);
    setPruebaError(null);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: muestra,
          qty: 1,
          mode: "normal",
          templateId: activa.id,
        }),
      });
      const j = (await res.json().catch(() => null)) as unknown;
      const texto =
        typeof j === "string" ? j : JSON.stringify(j, null, 2);
      if (!res.ok) {
        setPruebaError(`La app respondio ${res.status}: ${texto}`);
        return;
      }
      setPruebaOk(texto);
    } catch (e) {
      setPruebaError((e as Error).message);
    } finally {
      setImprimiendo(false);
    }
  }

  function editar(i: number, cambio: Record<string, unknown>) {
    setZones((prev) => prev.map((z, j) => (j === i ? { ...z, ...cambio } : z)));
  }

  function editarAutoFit(i: number, cambio: Record<string, number>) {
    setZones((prev) => prev.map((z, j) => (j === i ? conAutoFit(z, cambio) : z)));
  }

  function editarFuente(i: number, mm: number) {
    setZones((prev) => prev.map((z, j) => (j === i ? conAltoDeFuente(z, mm) : z)));
  }

  function editarFuenteAncho(i: number, mm: number) {
    setZones((prev) => prev.map((z, j) => (j === i ? conAnchoDeFuente(z, mm) : z)));
  }

  /**
   * Agrega una zona de texto fijo (F8a): contenido literal del operador, como "OFERTA".
   *
   * Posicion por defecto arriba a la izquierda (x 13, y 40 dots): al lado del logo, que
   * empieza en x 128, y por encima del nombre, que empieza en y 120. Tamano como el nombre
   * (`^A0N,48,20`, 6 mm de letra): se lee de lejos igual que el. La caja (`maxWidthDots`
   * 112) llega del borde interior (13) al logo (128) con 3 dots de aire, y `maxLines: 2`
   * como el nombre: si el texto no cabe en una linea se parte en dos, y si ni asi cabe o
   * pisa algo, Aplicar lo rechaza con 422 honesto.
   *
   * La caja propia es obligada y no un adorno: sin `^FB` la zona heredaria el `^FB` de la
   * zona anterior (`^FB` no caduca con el campo, en la impresora tampoco) y el texto
   * saldria partido y alineado como otro. Todas las zonas de texto de la plantilla traen
   * la suya; la fija tambien.
   */
  function agregarTextoLibre() {
    const nueva: AnyZone = {
      kind: "text",
      x: 13,
      y: 40,
      format: "^A0N,48,20",
      source: "fixed",
      text: "TEXTO",
      maxWidthDots: 112,
      maxLines: 2,
      justify: "L",
    };
    const nuevas = [...zones, nueva];
    setZones(nuevas);
    setSel(zones.length);
    comprometer(nuevas);
  }

  /**
   * Agrega un codigo de barras FIJO (F9): barras + HRI pareada, como el producto.
   *
   * Las barras van en x 360, y 40, con 40 dots de alto y modulo 1: a la derecha
   * del logo (acaba en x 344) y por encima del precio (empieza en y 196). El
   * contenido por defecto ("FIJO", 4 caracteres) mide 79 modulos = 79 dots a
   * modulo 1: de 360 a 439, dentro del rollo (472) y con las dos zonas quietas
   * de 10X (360 >= 10 y 472 - 439 = 33 >= 10). La HRI es una zona de texto fijo
   * debajo (y 88, 12 dots de letra, como la `barcodeData` del producto), con el
   * MISMO contenido: las dos se borran por separado, cada una con su boton.
   *
   * `interpretationLine: false` en las barras, como el producto: los digitos
   * los pone la zona de texto, en posicion controlada, no el firmware con su
   * hueco propio (que en la prueba fisica caia fuera de la etiqueta).
   */
  function agregarCodigoBarrasFijo() {
    const barras: AnyZone = {
      kind: "barcode",
      x: 360,
      y: 40,
      heightDots: 40,
      interpretationLine: false,
      source: "fixed",
      text: "FIJO",
      center: false,
      moduleWidth: 1,
    };
    const hri: AnyZone = {
      kind: "text",
      x: 360,
      y: 88,
      format: "^A0N,12,7",
      source: "fixed",
      text: "FIJO",
      maxWidthDots: 100,
      maxLines: 1,
      justify: "L",
    };
    const nuevas = [...zones, barras, hri];
    setZones(nuevas);
    setSel(zones.length);
    comprometer(nuevas);
  }

  /**
   * Agrega un duplicado del logo actual (F9): mismo bitmap, otra posicion.
   *
   * Sale 1 mm a la derecha del original, encima de el: no hay ningun hueco de
   * 27 x 9 mm libre en la etiqueta, asi que cualquier duplicado a tamano real
   * pisa algo. Se arrastra y se achica con los campos (o el asa); Aplicar no
   * guarda solapes (422 honesto). Solo el logo de SERIE (el primero) es fijo:
   * los duplicados se pueden borrar, cambiar y mover.
   */
  function agregarLogoExtra() {
    const serie = zones.find((z) => z.kind === "graphic");
    const gf = String(serie?.gf ?? "");
    if (gf === "") return;
    const nueva: AnyZone = {
      kind: "graphic",
      x: Number(serie?.x ?? 128) + 8,
      y: Number(serie?.y ?? 40),
      gf,
    };
    const nuevas = [...zones, nueva];
    setZones(nuevas);
    setSel(zones.length);
    comprometer(nuevas);
  }

  /**
   * Cambia una zona de codigo entre producto y fijo (F9).
   *
   * A fijo: conserva el contenido si ya trae uno, si no "FIJO". A producto: se
   * quita el literal (el dato vuelve a ser el del catalogo). El resto de la
   * geometria (alto, modulo, posicion) no se toca: el toggle es de FUENTE, no
   * de tamano.
   */
  function cambiarFuenteBarcode(i: number, fuente: "barcode" | "fixed") {
    setZones((prev) =>
      prev.map((z, j) => {
        if (j !== i || z.kind !== "barcode") return z;
        return fuente === "fixed"
          ? { ...z, source: "fixed", text: String(z.text ?? "") !== "" ? String(z.text) : "FIJO" }
          : { ...z, source: "barcode", text: undefined };
      }),
    );
    comprometerActual();
  }

  /** Abre el selector de fichero para cambiar la imagen del logo. */
  function pedirLogo() {
    setLogoError(null);
    logoInputRef.current?.click();
  }

  /**
   * Cambia la imagen de una zona `graphic` (F9): PNG del operador -> `^GFA`.
   *
   * Solo PNG y maximo 2 MB, validado AQUI y en el servidor (el servidor decide:
   * lo de aqui es para avisar pronto, no para dar por bueno). El ancho por
   * defecto es el del logo actual: se manda en `widthMm` para que el servidor
   * no tenga que adivinarlo. Devuelve `{ gf, wDots, hDots }` y se pone en la
   * zona; el commit va despues de pintar.
   */
  async function cambiarLogo(i: number, f: File | undefined) {
    if (!f) return;
    if (f.type !== "image/png" && !f.name.toLowerCase().endsWith(".png")) {
      setLogoError("Solo PNG: el convertidor no acepta JPG ni otros formatos.");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setLogoError(
        `Pesa ${(f.size / 1024 / 1024).toFixed(2)} MB: maximo 2 MB. Reducelo y vuelve a intentarlo.`,
      );
      return;
    }
    setLogoBusy(true);
    setLogoError(null);
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let k = 0; k < bytes.length; k += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(k, k + 0x8000));
      }
      const actual = zones[i];
      const d = actual ? graphicDots(String(actual.gf ?? "")).dots : null;
      const res = await fetch("/api/editor/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pngBase64: btoa(bin),
          widthMm: d ? d.w / MM_TO_DOTS : undefined,
        }),
      });
      const j = (await res.json()) as { gf?: unknown; error?: string };
      if (!res.ok || typeof j.gf !== "string") {
        setLogoError(j?.error ?? `La app respondio ${res.status}`);
        return;
      }
      editar(i, { gf: j.gf });
      comprometerActual();
    } catch (e) {
      setLogoError((e as Error).message);
    } finally {
      setLogoBusy(false);
    }
  }

  /**
   * Borra la zona seleccionada. Solo las libres se pueden borrar: los textos fijos (F8a)
   * y las figuras libres (F8b) los puso el operador y se quitan; las 7 de serie son la
   * estructura de la etiqueta (marco, logo, nombre, barras, digitos, REF y precio) y sin
   * ellas no hay etiqueta que imprimir. El boton solo se pinta para las libres, asi que
   * esto no necesita comprobar nada mas.
   *
   * F9: tambien son libres el codigo fijo y los logos duplicados (el de serie, no).
   */
  function eliminarZonaLibre(i: number) {
    const resto = zones.filter((_, j) => j !== i);
    setZones(resto);
    setSel(primeraEditable(resto));
    comprometer(resto);
  }

  /** Indice del logo de SERIE (el primero `graphic`): los demas son duplicados borrables. */
  const logoSerieIdx = useMemo(
    () => zones.findIndex((z) => z.kind === "graphic"),
    [zones],
  );

  /**
   * Que zonas se pueden borrar (F9): libres F8a/F8b + codigo fijo + logos
   * duplicados. Las de serie (marco, logo de serie, nombre, barras de
   * producto, digitos, REF y precio), no.
   */
  function esBorrable(z: AnyZone, i: number): boolean {
    if (z.kind === "rect" || z.kind === "line") return true;
    if (z.kind === "text" && String(z.source ?? "") === "fixed") return true;
    if (z.kind === "barcode" && String(z.source ?? "barcode") === "fixed") return true;
    if (z.kind === "graphic" && i !== logoSerieIdx) return true;
    return false;
  }

  /**
   * Agrega un rectangulo libre (F8b): 12 x 7 mm a la izquierda del logo.
   *
   * Posicion por defecto x 16, y 48 dots: dentro del hueco del marco (11,9..461,271),
   * a la izquierda del logo (empieza en x 128) y por encima del nombre (empieza en
   * y 120). Tamano 96 x 56 dots con trazo de 2: se ve sin tapar nada, y Aplicar lo
   * acepta con el producto corto y con el largo.
   */
  function agregarRectanguloLibre() {
    const nueva: AnyZone = {
      kind: "rect",
      x: 16,
      y: 48,
      widthDots: 96,
      heightDots: 56,
      thicknessDots: 2,
    };
    const nuevas = [...zones, nueva];
    setZones(nuevas);
    setSel(zones.length);
    comprometer(nuevas);
  }

  /**
   * Agrega una linea libre (F8b): vertical de 10 mm a la derecha del logo.
   *
   * x 400, y 16, largo 80 dots: dentro del hueco del marco, a la derecha del logo
   * (acaba en x 344) y por encima del nombre y del precio. Vertical porque en
   * horizontal ya estan el nombre y las barras: lo que falta es un separador, no otra
   * raya acostada.
   */
  function agregarLineaLibre() {
    const nueva: AnyZone = {
      kind: "line",
      x: 400,
      y: 16,
      largoDots: 80,
      orientacion: "vertical",
      thicknessDots: 2,
    };
    const nuevas = [...zones, nueva];
    setZones(nuevas);
    setSel(zones.length);
    comprometer(nuevas);
  }

  /**
   * Cambia el ancho o el alto del logo reescalando el `^GFA`.
   *
   * Se pasa por `redimensionar()` en vez de calcular el factor aqui, para que el campo numerico
   * y el tirador den EXACTAMENTE el mismo resultado. Si cada uno calculara su propia
   * proporcion, pondrias 30,0 mm en el campo y 31,0 mm desde la esquina, y no sabrias cual de
   * los dos manda.
   *
   * `ancho` o `alto` a `null` significa "no lo toques", que es como se reescala manteniendo la
   * proporcion: se cambia un lado y el otro le sigue.
   */
  function editarLogo(i: number, anchoMm: number | null, altoMm: number | null) {
    setZones((prev) =>
      prev.map((z, j) => {
        if (j !== i) return z;
        const gf = String(z.gf ?? "");
        const actual = graphicDots(gf).dots;
        if (!actual) return z;
        const wObjetivo = anchoMm === null ? actual.w : DOTS(anchoMm);
        const hObjetivo = altoMm === null ? actual.h : DOTS(altoMm);
        const r = scaleGraphic(gf, wObjetivo, hObjetivo);
        // Un fallo aqui (medida demasiado pequena, o un `^GF` ilegible) NO se guarda: dejar la
        // zona con un `gf` a medio cambiar dejaria el logo en blanco sin decir por que.
        return "error" in r ? z : { ...z, gf: r.gf };
      }),
    );
  }

  const zona = zones[sel];

  /**
   * El marco de la seleccion ya no "anticipa" nada respecto al render: sale de la zona misma
   * (`cajaEstimada()`), asi que no hay dos geometrias que reconciliar mientras el servidor no
   * contesta. Ver el bloque de interaccion mas abajo.
   */

  /** Que ejes se pueden estirar en la zona seleccionada, y el aviso de lo que no se puede. */
  const zonaEjes = useMemo(
    () =>
      zona
        ? (esFiguraLibre(zona) ? ejesFiguraLibre(zona) : ejesRedimensionables(zona as unknown as LabelZone))
        : null,
    [zona],
  );

  /**
   * Lo que se imprime de verdad en la zona seleccionada, con el nombre de prueba actual.
   *
   * El campo de arriba ("alto letra") es el techo del `autoFit` cuando la zona lo tiene. Este
   * es el alto que ha salido de ajustar ese nombre al ancho de caja. Con un nombre corto
   * coinciden; con uno de 50 caracteres el ajuste baja la letra y los dos numeros ya no son
   * el mismo, que es justo lo que hay que ver para decidir el techo.
   */
  const resuelto = preview?.resueltos.find((r) => r.indice === sel) ?? null;

  /**
   * Por que se ha bajado la letra del techo, en una frase.
   *
   * Antes de v1.8 solo habia una razon posible: el texto no cabia en UNA linea del ancho de
   * caja. Ahora hay dos, y se confunden: con `maxLines: 2` y `maxBlockDots`, un nombre puede
   * caber de sobra en una linea y estar bajadísimo porque el hueco que le queda hasta las
   * barras no da para dos lineas grandes. Decirle al usuario "no cabe a 56 dots" cuando lo
   * que pasa es que no cabe en 88 de bloque lo manda a subir `maxHeight`, que no es el
   * mando que sirve, y a bajar `minHeight`, que empeora el resultado.
   *
   * Se decide mirando la RAMA que `resolveAutoFit()` eligió de verdad, no una hipotesis. El
   * algoritmo prueba primero "cabe en una linea" bajando el alto, y solo si eso no sale por
   * abajo prueba a repartir en varias. Asi que un nombre que sale en UNA linea a 55 dots esta
   * limitado por el ancho y nada mas, aunque a 56 dots el hueco tampoco dejaria entrar el bloque
   * de dos lineas: ese segundo limite nunca llego a mandar porque el algoritmo
   * ya habia encontrado la solucion de una linea. Decir "el tope lo pone el hueco" ahi
   * manda a mover el hueco cuando el ancho es lo unico que aprieta.
   */
  const porQueSeBajo = useMemo((): string | null => {
    const af = zona?.autoFit as Record<string, number> | undefined;
    if (!af || !resuelto || resuelto.alto >= af.maxHeight || !zona || zona.kind !== "text") {
      return null;
    }
    // `caja`, `maxLineas` y `anchoTecho` salen de la zona con `as number`: `zona` es la union
    // de todas las zonas editables y `maxWidthDots` solo existe en las de texto, asi que el
    // tipo del union no lo afina solo. Ya se ha comprobado antes que `zona.kind === "text"`.
    const chars = resuelto.texto?.length ?? 0;
    const caja = (zona.maxWidthDots as number | undefined) ?? 0;
    const maxLineas = (zona.maxLines as number | undefined) ?? 1;
    const anchoTecho = Math.max(1, Math.round(af.maxHeight * af.widthRatio));
    const salidaEnUnaLinea = chars * resuelto.ancho <= caja;
    const topeBloque = af.maxBlockDots as number | undefined;

    const razones: string[] = [];
    if (salidaEnUnaLinea) {
      // Rama de una linea: el unico tope posible es el ancho, y solo si a la altura elegida el
      // bloque de una linea ya no cupiera (o sea, un `maxBlockDots` menor que el alto).
      razones.push(
        `no caben ${chars} caracteres en una linea de ${caja} dots a ${anchoTecho} de celda`,
      );
      if (topeBloque !== undefined && resuelto.alto > topeBloque) {
        razones.push(`una sola linea de ${resuelto.alto} ya no cabe en el hueco de ${topeBloque}`);
      }
      return (
        `Bajado del techo a ${resuelto.alto} dots: ${razones.join("; ")}. ` +
        `Cabe en una sola linea, asi que para mas alto hay que ensanchar la caja.`
      );
    }

    // Rama de varias lineas: aqui el ancho no es el problema (si lo fuera, no habria salida) y
    // el limite que manda es el alto total del bloque, que es lo que impide dos lineas grandes.
    const lineas = Math.min(
      Math.ceil(chars / Math.max(1, Math.floor(caja / Math.max(1, resuelto.ancho)))),
      maxLineas,
    );
    razones.push(`sale en ${lineas} ${lineas === 1 ? "linea" : "lineas"} de ${resuelto.alto} dots`);
    if (topeBloque !== undefined) {
      const bloque = (2 * lineas - 1) * af.maxHeight;
      razones.push(
        `y a ${af.maxHeight} dots de alto el bloque ocuparia ${bloque}, con un hueco de ${topeBloque}`,
      );
      return `Bajado del techo a ${resuelto.alto} dots: ${razones.join("; ")}. ` +
        `Subir el alto no ayuda: el tope lo pone el hueco hasta las barras, no el ancho.`;
    }
    return `Bajado del techo a ${resuelto.alto} dots: ${razones.join("; ")}.`;
  }, [zona, resuelto]);

  const pegables = useMemo(
    () => (preview ? mapearCajas(preview.cajas, zones, preview.resueltos) : []),
    [preview, zones],
  );

  /**
   * El aviso de "Guardado" o "Cargado" solo es cierto mientras las zonas siguen siendo las
   * que se guardaron: en cuanto se toca algo, la pantalla ya muestra cambios que la
   * impresora no tiene, y dejar el aviso ahi era mentir. La clave es el propio JSON de las
   * zonas, asi que caduca solo, sin estados intermedios que olvidar.
   */
  const clavesZonas = JSON.stringify(zones);
  const aplicadoTexto = aplicado && aplicado.clave === clavesZonas ? aplicado.texto : null;

  /**
   * Modulos del simbolo que hay en pantalla ahora mismo.
   *
   * El ancho de las barras es un escalon de `modulos` dots, y cuantos hay lo decide el servidor
   * al elegir la symbologia. Sin este numero, `redimensionar()` no puede pasar de "el rato se
   * ha movido 40 dots" a "`moduleWidth` 4".
   *
   * Se deduce del ancho de simbolo que ya devuelve el preview: `modulos = ancho / moduleWidth`.
   * No hace falta pedirlo aparte, y sale del mismo numero que se ve en el informe.
   */
  const modulosActuales = useMemo(() => {
    if (!preview || preview.anchoSimbolo <= 0) return 0;
    const bz = zones.find((z) => z.kind === "barcode");
    const mw = Number((bz as { moduleWidth?: number } | undefined)?.moduleWidth ?? 0);
    if (mw <= 0) return 0;
    return Math.max(1, Math.round(preview.anchoSimbolo / mw));
  }, [preview, zones]);

  // ------------------------------------------------------------------ interaccion
  //
  // PUNTERO, NO RATON. Los manejadores van en el lienzo con POINTER EVENTS y
  // `setPointerCapture`: el puntero sigue llegando aunque salga de la etiqueta o de la
  // ventana, no hay listeners globales que re-registrar cuando cambia el preview (que es
  // justo lo que pasaba en pleno arrastre), y el tacto entra solo con `touch-none`.
  //
  // EL MARCO NO ESPERA AL SERVIDOR. La caja de cada zona sale de `cajaEstimada()`, con la
  // misma informacion que usaria `emit()`, y se recalcula en el navegador con cada
  // fotograma. El render del servidor (~130 ms + 180 ms de debounce) solo hace falta al
  // SOLTAR, para que el dibujo se ajuste a lo impreso; mientras dura el gesto, la imagen es
  // la ultima buena y el marco es el que manda.
  //
  // Y EL CLIC SELECCIONA Y ARRASTRA A LA VEZ. Clic en cualquier zona editable = seleccion
  // + arrastre en el mismo gesto, como en Word: no hay que ir primero a la lista lateral,
  // que era lo que hacia que arrastrar "no funcionara".

  const lienzoRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  /**
   * El gesto en curso, en un REF y no en estado.
   *
   * Los manejadores de puntero se leen en el mismo tick en que se escriben: con estado, el
   * puntero siguiente llega a veces antes de que React haya pintado y el movimiento se pierde.
   * Ademas el gesto no necesita pintarse: el marco de MOVER ya lo lleva el estado de zonas, y
   * el de estirar se pinta desde `estirando`, que si es estado.
   */
  const gesto = useRef<{
    indice: number;
    /** `null` = mover la zona entera. Con asa = estirar por esa arista. */
    asa: Asider | null;
    /** Puntero en dots al empezar, para que la zona no salte bajo el cursor. */
    tomaX: number;
    tomaY: number;
    origen: LabelZone;
    /** Caja de la zona al empezar: la base sobre la que se estira. */
    base: Marco;
    ctx: ContextoResize;
    /** Si ha cambiado algo. Un pulsado sin mover es un clic de seleccion, no un arrastre. */
    movido: boolean;
  } | null>(null);

  /** Ultimo puntero visto, en pixels de pantalla. El `requestAnimationFrame` lo consume. */
  const puntero = useRef<{ clientX: number; clientY: number } | null>(null);
  const raf = useRef<number | null>(null);

  /**
   * Modulos de cada zona de codigo FIJO (F9), con la misma funcion que el servidor.
   *
   * Hacen falta en el navegador por dos cosas: el marco de la fija (su ancho es
   * `modulos * moduleWidth`, y `preview.anchoSimbolo` es el simbolo de PRODUCTO,
   * otro simbolo distinto) y el `ctx.modulos` del estirado (el escalon del
   * modulo sale de ahi). Si el contenido no se puede codificar, 0 y el marco
   * cae en la estimacion generica de 95 modulos, como antes.
   */
  const modulosFijos = useMemo(
    () =>
      zones.map((z) => {
        if (z.kind !== "barcode" || String(z.source ?? "barcode") !== "fixed") return 0;
        try {
          return encodeCode128Auto(String(z.text ?? "")).encoded.modules;
        } catch {
          return 0;
        }
      }),
    [zones],
  );

  /**
   * La caja de cada zona, estimada desde la zona y el ultimo render.
   *
   * Esta es el marco que se pinta y el area en la que se acierta al clic, y por eso no
   * depende de emparejar cajas del render: una zona plegada en dos lineas o cuya caja no se
   * pudo dibujar seguia quedando fuera del arrastre antes, y aqui tiene marco siempre que la
   * zona tenga geometria.
   */
  const marcos = useMemo(
    () =>
      zones.map((z, i) =>
        preview && EDITABLES.has(z.kind)
          ? // Las figuras libres no pasan por `cajaEstimada()` (no esta en la superficie
            // de F8b): su marco es el rectangulo que se imprime, calculado aqui.
            esFiguraLibre(z)
            ? marcoFiguraLibre(z)
            : cajaEstimada(z as unknown as LabelZone, {
                // La fija mide sus propios modulos, no el simbolo de producto.
                anchoSimbolo:
                  z.kind === "barcode" &&
                  String(z.source ?? "barcode") === "fixed" &&
                  modulosFijos[i] > 0
                    ? modulosFijos[i] * Math.max(1, Number(z.moduleWidth))
                    : preview.anchoSimbolo,
                texto: preview.resueltos[i]?.texto ?? null,
                altoLetra: preview.resueltos[i]?.alto,
                anchoCelda: preview.resueltos[i]?.ancho,
              })
          : null,
      ),
    [zones, preview, modulosFijos],
  );

  /**
   * El marco de la zona seleccionada.
   *
   * Sin estirar, es la caja estimada de la zona: como esa caja se deriva de `zones`, el
   * marco sigue al puntero solo, sin ningun calculo extra. Estirando, es la base del gesto
   * movida por el delta DEL PUNTERO, que es lo que hace que el borde quede pegado al raton
   * aunque la zona cuantize (modulos, multiplos de 8, dots enteros de letra).
   */
  const marcoSel = useMemo(() => {
    const base = marcos[sel];
    if (!base) return null;
    if (!estirando || estirando.indice !== sel) return base;
    return estirarMarco(estirando.base, estirando.asa, estirando.dx, estirando.dy, {
      minAncho: MIN_DOTS.ancho,
      minAlto: zones[sel]?.kind === "barcode" ? MIN_DOTS.altoBarra : MIN_DOTS.alto,
    });
  }, [marcos, sel, estirando, zones]);

  /** Las asas que la zona seleccionada admite de verdad. Las que no, no se dibujan. */
  const asasMarco: Asider[] = !zonaEjes
    ? []
    : ASIDERES.filter((a) => {
        const horizontal = a === "e" || a === "w";
        const vertical = a === "n" || a === "s";
        const esquina = !horizontal && !vertical;
        // Una esquina arrastra los dos ejes a la vez. Si la zona no admite uno, la esquina
        // no se ofrece: estirarla solo deformaria el elemento.
        if (esquina) return zonaEjes.x && zonaEjes.y;
        return horizontal ? zonaEjes.x : zonaEjes.y;
      });

  /**
   * Posicion del puntero sobre la etiqueta, en dots.
   *
   * Se mide contra el PROPIO `<img>`, no contra el contenedor con su `p-2` y su borde: el
   * offset magico de 8+1 px descolocaba el marco respecto al cursor, y aqui no hay ninguna
   * constante que restar porque el marco y la imagen empiezan en el mismo sitio.
   */
  function dotsDelPuntero(e: { clientX: number; clientY: number }) {
    const el = imgRef.current;
    if (!el) return { dx: 0, dy: 0 };
    const r = el.getBoundingClientRect();
    return { dx: (e.clientX - r.left) / zoom, dy: (e.clientY - r.top) / zoom };
  }

  /**
   * Aplica el ultimo puntero visto. Va montado en `requestAnimationFrame` para que, pase lo
   * que pase con la frecuencia de los eventos, no se pinte mas de una vez por fotograma.
   */
  function aplicarPendiente() {
    raf.current = null;
    const g = gesto.current;
    const p = puntero.current;
    if (!g || !p) return;
    const { dx, dy } = dotsDelPuntero(p);
    // El desplazamiento se mide en dots y se redondea al dot entero: es la unidad que
    // entiende la impresora, y dejar fracciones solo produciria ruido.
    const ex = Math.round(dx) - g.tomaX;
    const ey = Math.round(dy) - g.tomaY;

    if (g.asa === null) {
      // Con `center` la x de la zona no coloca nada (`barcodeX()` recentra el simbolo):
      // moverla prometeria un movimiento que el render no haria, y el marco se iria de
      // lado mientras las barras se quedarian quietas.
      const centrado = g.origen.kind === "barcode" && Boolean(g.origen.center);
      const x = centrado ? Number(g.origen.x) : Math.max(0, Number(g.origen.x) + ex);
      const y = Math.max(0, Number(g.origen.y) + ey);
      if (x === Number(g.origen.x) && y === Number(g.origen.y)) return;
      g.movido = true;
      const i = g.indice;
      setZones((prev) => prev.map((z, j) => (j === i ? { ...z, x, y } : z)));
      return;
    }

    // El marco del estirado sigue al puntero aunque la zona no cambie aun: un modulo de
    // barcode son 95 dots y el logo va a multiplos de 8, y el borde no puede esperar a que
    // el dato de la zona alcance al raton.
    g.movido = g.movido || ex !== 0 || ey !== 0;
    setEstirando({ indice: g.indice, asa: g.asa, base: g.base, dx: ex, dy: ey });

    // Las figuras libres no pasan por `redimensionar()` (fuera de superficie F8b): su
    // geometria es la del `shape`, calculada en la pagina. El resto va por el camino
    // generico, que cuantiza modulos, multiplos de 8 y dots de letra.
    const nueva = esFiguraLibre(g.origen as unknown as AnyZone)
      ? redimensionarFiguraLibre(g.origen as unknown as AnyZone, g.asa, ex, ey)
      : redimensionar(g.origen, g.asa, ex, ey, g.ctx);
    if (JSON.stringify(nueva) === JSON.stringify(g.origen)) return;
    const i = g.indice;
    setZones((prev) => prev.map((z, j) => (j === i ? (nueva as unknown as AnyZone) : z)));
  }

  function empezarGesto(e: React.PointerEvent) {
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const objetivo = e.target as HTMLElement;
    // El asa se mira ANTES que el marco: esta DENTRO, y si se mirara el marco primero,
    // tirar de una esquina moveria la zona en vez de estirarla.
    const asaEl = objetivo.closest<HTMLElement>("[data-asa]");
    const marcoEl = objetivo.closest<HTMLElement>("[data-marco]");
    const zonaEl = objetivo.closest<HTMLElement>("[data-zona]");

    let indice: number | null = null;
    let asa: Asider | null = null;
    if (asaEl && marcoEl) {
      asa = asaEl.dataset.asa as Asider;
      indice = sel;
    } else if (marcoEl) {
      indice = sel;
    } else if (zonaEl) {
      indice = Number(zonaEl.dataset.zona);
    }
    if (indice === null || Number.isNaN(indice)) return;

    const z = zones[indice];
    const base = marcos[indice];
    if (!z || !base || !EDITABLES.has(z.kind)) return;

    e.preventDefault();
    const p = dotsDelPuntero(e);
    setSel(indice);
    gesto.current = {
      indice,
      asa,
      tomaX: Math.round(p.dx),
      tomaY: Math.round(p.dy),
      origen: structuredClone(z) as unknown as LabelZone,
      base,
      ctx: {
        // La fija estira por SUS modulos, no por los del producto (F9): el
        // escalon del modulo sale de ahi y con los del producto saldria otro.
        modulos:
          z.kind === "barcode" &&
          String(z.source ?? "barcode") === "fixed" &&
          modulosFijos[indice] > 0
            ? modulosFijos[indice]
            : modulosActuales,
        anchoCajaTexto: anchoCajaDeTexto(indice, preview, pegables),
      },
      movido: false,
    };
    puntero.current = { clientX: e.clientX, clientY: e.clientY };
    if (asa) setEstirando({ indice, asa, base, dx: 0, dy: 0 });
    else setEstirando(null);
    lienzoRef.current?.setPointerCapture(e.pointerId);
  }

  function moverPuntero(e: React.PointerEvent) {
    if (!gesto.current) return;
    puntero.current = { clientX: e.clientX, clientY: e.clientY };
    if (raf.current == null) raf.current = requestAnimationFrame(aplicarPendiente);
  }

  function terminarGesto() {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
      // El ultimo fotograma se aplica ya, sin esperar: si no, el ultimo movimiento del
      // raton se perderia al soltar.
      aplicarPendiente();
    }
    const g = gesto.current;
    gesto.current = null;
    puntero.current = null;
    if (!g || !g.movido) {
      // Un pulsado sin mover es un clic de seleccion. No hay nada que refrescar, y poner
      // estado aqui dispararia una peticion al servidor por cada simple clic.
      if (g?.asa) setEstirando(null);
      return;
    }
    // Al soltar un MOVER no hace falta congelar nada: el marco ya es la caja estimada de la
    // zona, que acaba de moverse con ella. Al soltar un ESTIRADO si: el marco se queda donde
    // lo dejo el puntero hasta que llegue el render nuevo, y entonces se ajusta a lo impreso.
    if (g.asa === null) setEstirando(null);
    // Fin de arrastre o de estirado (F9): UN commit de undo, con lo ya pintado.
    comprometerActual();
  }

  /**
   * El estirado congelado vive hasta que el servidor contesta: entonces manda lo impreso.
   *
   * Si el gesto sigue activo (una pausa larga a mitad de estirar si dispara el debounce), el
   * marco NO se toca: es el que esta siguiendo al puntero.
   */
  useEffect(() => {
    if (gesto.current?.asa == null) setEstirando(null);
  }, [preview]);

  /**
   * Teclado, con la misma idea que Word.
   *
   * Flechas = mover la zona seleccionada un dot (0,125 mm); con Mayus, ocho, que es 1 mm.
   * Escape = cancelar el arrastre y devolver la zona a como estaba.
   *
   * Se cuelga de la ventana y no del lienzo porque el lienzo no tiene foco propio, y se
   * ignora el evento cuando el destino es un campo: mientras se teclea una X en un input, las
   * flechas tienen que mover el cursor de texto y nada mas.
   */
  useEffect(() => {
    const enCampo = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null;
      if (!el || typeof el.tagName !== "string") return false;
      return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable === true;
    };

    const teclado = (e: KeyboardEvent) => {
      if (enCampo(e.target)) return;

      if (e.key === "Escape") {
        const g = gesto.current;
        if (!g && !estirando) return;
        e.preventDefault();
        if (raf.current != null) {
          cancelAnimationFrame(raf.current);
          raf.current = null;
        }
        if (g) {
          const i = g.indice;
          const origen = g.origen;
          gesto.current = null;
          puntero.current = null;
          setZones((prev) => prev.map((z, j) => (j === i ? ({ ...z, ...origen } as AnyZone) : z)));
        }
        setEstirando(null);
        return;
      }

      const pasos: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const paso = pasos[e.key];
      if (!paso) return;
      // Con un gesto en curso las flechas no mando: moverian la zona por debajo del marco
      // que la esta estirando, y saldria una mezcla de las dos operaciones.
      if (gesto.current) return;
      const z = zones[sel];
      if (!z || !EDITABLES.has(z.kind)) return;

      e.preventDefault();
      const salto = e.shiftKey ? MM_TO_DOTS : 1;
      const centrado = z.kind === "barcode" && Boolean(z.center);
      const x = Math.max(0, Number(z.x) + (centrado ? 0 : paso[0] * salto));
      const y = Math.max(0, Number(z.y) + paso[1] * salto);
      // Si habia un estirado congelado, la posicion nueva ya no es la suya: que pinte la
      // caja estimada de la zona mientras llega el render.
      setEstirando(null);
      // Cada pulsacion es un commit discreto de undo (F9): se calcula la
      // siguiente en vez de leer el estado, que aqui esta fresco por las deps.
      const nz = zones.map((zz, i) => (i === sel ? { ...zz, x, y } : zz));
      setZones(nz);
      comprometer(nz);
    };

    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [sel, zones, estirando]);

  // Un `requestAnimationFrame` en vuelo no debe sobrevivir a la pantalla.
  useEffect(
    () => () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    },
    [],
  );

  // La misma regla que usa el endpoint de guardar, desde el mismo modulo. Si aqui se aceptara
  // algo que el servidor luego rechaza con un 422, el boton de aplicar pareceria roto sin que
  // hubiera forma de saber cual de los dos se equivoca.
  const solapes = useMemo(
    () =>
      preview
        ? buscarProblemas(preview.cajas, DEFAULT_TEMPLATE.widthDots, DEFAULT_TEMPLATE.heightDots)
        : [],
    [preview],
  );

  /**
   * Lineas del informe que describen algo que NO se ha dibujado entero.
   *
   * El render puede salir bien y aun asi faltar cosa: un `^GFA` que no llega al ZPL, un bitmap
   * vacio, una medida que no se puede leer, un nombre al que el `^FB` le corta el final. La
   * etiqueta sale incompleta y el informe lo dice en una linea de texto pequeno, que es justo
   * el sitio donde no se lee nada. Por eso se sacan aparte.
   */
  const avisos = useMemo(() => {
    if (!preview) return [];
    return preview.informe.filter((l) => /\bNO\b|EN BLANCO/.test(l));
  }, [preview]);

  /**
   * Cambios en pantalla que la impresora todavia no tiene.
   *
   * El aviso de Guardado/Cargado (`aplicadoTexto`) solo vale mientras las zonas
   * son las guardadas. Si es nulo y hay override, o las zonas ya no son las del
   * codigo, lo que se ve no es lo que se imprime: el ZPL y la prueba lo dicen.
   */
  const hayCambiosSinAplicar =
    aplicadoTexto === null &&
    (hayOverride || clavesZonas !== JSON.stringify(DEFAULT_TEMPLATE.zones));

  /** Lo que describe la pestana ZPL: plantilla, muestra y de donde sale el texto. */
  const zplCaptions = useMemo(() => {
    if (!activa) return [];
    const c = [
      `Plantilla activa: «${activa.name}» (${
        activa.kind === "raw" ? "raw: su ZPL tal cual, sin muestra aplicada" : "estructurada 59x35"
      }).`,
      `Muestra: «${nombre}» · ${barcode} · ${precio} · REF: RETAIL · negocio «${negocio}» (el de ajustes).`,
    ];
    if (guardado && activa.kind !== "raw") {
      c.push(`Con el override guardado (${guardado.savedAt}) aplicado encima.`);
    }
    return c;
  }, [activa, nombre, barcode, precio, negocio, guardado]);

  const avisoZplSinAplicar =
    editable && hayCambiosSinAplicar
      ? "Hay cambios sin aplicar: este ZPL es de lo guardado. Aplica los cambios para actualizarlo."
      : null;

  const avisoPruebaSinAplicar =
    editable && hayCambiosSinAplicar
      ? "Aplica los cambios antes de probar: la prueba imprime lo guardado, no lo que se ve."
      : null;

  /** Guardar como plantilla no guarda geometria rota: misma regla que Aplicar. */
  const motivoBloqueoGuardar =
    solapes.length > 0
      ? "No se guarda: con estos valores algo se pisa o se sale de la etiqueta (ver avisos del canvas)."
      : null;

  /** Texto y tono de la pill de impresora (F9): el mapeo esta documentado en `leerImp`. */
  const pillCola = imp && imp.jobCount > 0 ? ` · ${imp.jobCount} en cola` : "";
  const pillTexto = !imp
    ? "Consultando impresora…"
    : imp.state === "blocked" || imp.state === "missing"
      ? `Bloqueada: ${imp.message}`
      : imp.state === "busy"
        ? `Ocupada: ${imp.message}${pillCola}`
        : imp.state === "warning"
          ? `Aviso: ${imp.message}`
          : imp.state === "ready"
            ? `Lista: ${imp.queue !== "" ? imp.queue : imp.message}${pillCola}`
            : `Estado desconocido: ${imp.message}`;
  const pillTono = !imp
    ? "border-edge bg-panel text-muted"
    : imp.state === "ready"
      ? "border-success bg-success-soft text-success"
      : imp.state === "busy" || imp.state === "warning"
        ? "border-warn-line bg-warn-soft text-warn"
        : imp.state === "blocked" || imp.state === "missing"
          ? "border-error bg-error-soft text-error"
          : "border-edge bg-panel text-muted";
  const pillPunto = !imp
    ? "bg-ink-mute"
    : imp.state === "ready"
      ? "bg-ok"
      : imp.state === "busy"
        ? "bg-busy"
        : imp.state === "warning"
          ? "bg-warn"
          : imp.state === "blocked" || imp.state === "missing"
            ? "bg-danger"
            : "bg-ink-mute";

  /** Pestanas del estudio: las 6 rutas reales (+ editor, que es esta). */
  const tabsEstudio = [
    { href: "/", etiqueta: "Normal" },
    { href: "/fast", etiqueta: "Rápido" },
    { href: "/history", etiqueta: "Historial" },
    { href: "/editor", etiqueta: "Editor", activo: true },
    { href: "/plantillas", etiqueta: "Plantillas" },
    { href: "/lotes", etiqueta: "Lotes" },
    { href: "/settings", etiqueta: "Ajustes" },
  ];

  /**
   * Guardar como plantilla desde la cabecera: el MISMO handler. Sin nombre no
   * hay nada que guardar (el endpoint exige nombre): se baja al campo y se
   * dice, en vez de guardar "sin titulo".
   */
  function guardarDesdeCabecera() {
    if (guardandoPlantilla) return;
    if (nombrePlantilla.trim() === "") {
      setPlantillaError("Ponle un nombre abajo, en «Nombre de nueva variante», y vuelve a pulsar.");
      document.getElementById("editor-nombre-plantilla")?.focus();
      return;
    }
    void guardarComoPlantilla();
  }

  return (
    <main className="flex min-h-screen flex-col bg-canvas">
      {/* Cabecera del estudio (F9, piel del mockup): marca + pill REAL de
          impresora + Actualizar (re-sondea) + tabs reales + Guardar (mismo
          handler) + Aplicar (mismo handler). */}
      <header className={studioHeaderClear}>
        <div className="flex items-center gap-2">
          <span className={`${displayTitle} text-sm`}>LabelPrinter</span>
          <span className="text-xs text-muted">·</span>
          <span className="text-xs font-semibold text-primary">PAPICAR</span>
          <span className="font-mono text-[10px] text-muted">v{version ?? "…"}</span>
        </div>
        <div
          role={imp?.state === "blocked" || imp?.state === "missing" ? "alert" : "status"}
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${pillTono}`}
        >
          <span className={`inline-block size-2 shrink-0 rounded-full ${pillPunto}`} />
          <span className="max-w-xs truncate font-medium md:max-w-md">{pillTexto}</span>
          <button
            type="button"
            onClick={() => void leerImp(true, true)}
            disabled={impCargando}
            className="font-semibold underline hover:opacity-80 disabled:opacity-40"
          >
            {impCargando ? "Consultando…" : "Actualizar"}
          </button>
        </div>
        <nav aria-label="Modulos" className="hidden items-center gap-1 lg:flex">
          {tabsEstudio.map((t) => (
            <a
              key={t.href}
              href={t.href}
              aria-current={t.activo ? "page" : undefined}
              className={
                t.activo
                  ? "rounded-md bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"
                  : "rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:text-strong"
              }
            >
              {t.etiqueta}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={guardarDesdeCabecera}
            disabled={guardandoPlantilla || !editable}
            className={buttonClearSecondary}
            title="Guardar geometria como plantilla nueva en la biblioteca"
          >
            {guardandoPlantilla ? "guardando…" : "Guardar como plantilla"}
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={aplicando || !editable}
            className={buttonClear}
            title="Compila y guarda: a partir de ya se imprime con esto"
          >
            {aplicando ? "guardando…" : "Aplicar cambios"}
          </button>
        </div>
      </header>

      {/* Barra de insercion (F9): los 5 tipos con handlers reales + pill de
          activa REAL + zoom (estado existente) + ver cajas (toggle real,
          default ON) + undo/redo (pila de snapshots, deshabilitados honestos). */}
      {activa && editable && (
        <section aria-label="Insertar y lienzo" className={studioToolbarClear}>
          <span className="font-medium uppercase tracking-wide text-muted">Insertar:</span>
          <button type="button" onClick={agregarTextoLibre} className={insertClear}>
            Texto libre
          </button>
          <button type="button" onClick={agregarCodigoBarrasFijo} className={insertClear}>
            Código barras
          </button>
          <button type="button" onClick={agregarRectanguloLibre} className={insertClear}>
            Rectángulo
          </button>
          <button type="button" onClick={agregarLineaLibre} className={insertClear}>
            Línea
          </button>
          <button type="button" onClick={agregarLogoExtra} className={insertClear}>
            Logo GFA
          </button>
          <span className="ml-2 rounded border border-edge bg-canvas px-2 py-0.5 font-mono text-[11px] text-strong">
            Activa: {activa.name} · {activa.widthMm} × {activa.heightMm} mm ({activa.widthDots} ×{" "}
            {activa.heightDots} dots)
          </span>
          {hayOverride && (
            <span className="rounded border border-edge bg-canvas px-2 py-0.5 font-mono text-[11px] text-muted">
              Override guardado{guardado ? ` · ${guardado.savedAt}` : ""}
            </span>
          )}
          <span className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-muted">
              Zoom
              <input
                type="range"
                min={1}
                max={6}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 w-16 cursor-pointer accent-primary"
              />
              <span className="w-5 font-mono font-semibold text-strong">{zoom}x</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 font-medium text-muted">
              <input
                type="checkbox"
                checked={mostrarCajas}
                onChange={(e) => setMostrarCajas(e.target.checked)}
                className="size-3.5 rounded border-line-strong accent-primary"
              />
              Ver cajas
            </label>
            <span className="flex items-center overflow-hidden rounded border border-edge">
              <button
                type="button"
                onClick={deshacer}
                disabled={!puedeUndo}
                title="Deshacer"
                aria-label="Deshacer"
                className="p-1 text-muted hover:bg-canvas disabled:opacity-40"
              >
                ↩
              </button>
              <button
                type="button"
                onClick={rehacer}
                disabled={!puedeRedo}
                title="Rehacer"
                aria-label="Rehacer"
                className="border-l border-edge p-1 text-muted hover:bg-canvas disabled:opacity-40"
              >
                ↪
              </button>
            </span>
          </span>
        </section>
      )}

      {!activa && !activaError && (
        <p className="text-sm text-muted">Leyendo la plantilla activa...</p>
      )}

      {activaError && (
        <p role="alert" className="rounded-card border border-error bg-error-soft px-4 py-3 text-sm text-error">
          {activaError}
        </p>
      )}

      {activa && !editable && !activaError && (
        <>
          <section className={`${cardClear} p-5`}>
            <h2 className="text-lg font-semibold text-strong">No editable</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              El editor solo abre la 59x35 estructurada activa
              {activa.kind === "raw"
                ? " (esta es raw: ZPL opaco, no hay geometria que editar)"
                : " (las coordenadas del editor son de ese rollo y no valen en otro)"}
              . La activa es «{activa.name}»: elegi una estructurada 59x35 en la biblioteca para
              editar geometria. El ZPL y la prueba de abajo siguen siendo los reales de la activa.
            </p>
            <a href="/plantillas" className={`${buttonClearSecondary} mt-3`}>
              Ir a la biblioteca
            </a>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className={`${cardClear} p-4`}>
              <h3 className="mb-3 text-sm font-semibold tracking-tight text-strong">
                ZPL de «{activa.name}»
              </h3>
              <ZplTab
                texto={zpl}
                cargando={zplCargando}
                error={zplError}
                captions={zplCaptions}
                avisoSinAplicar={null}
                onActualizar={() => setZplTick((t) => t + 1)}
              />
            </div>
            <PruebaImpresionPanel
              productos={productos}
              muestra={muestra}
              onMuestra={setMuestra}
              plantillaNombre={activa.name}
              ocupado={imprimiendo}
              puede={muestra.trim() !== "" && productos.length > 0}
              avisoSinAplicar={null}
              resultado={pruebaOk}
              error={pruebaError}
              onImprimir={() => void imprimirPrueba()}
            />
          </div>
        </>
      )}

      {activa && editable && (
      <div className="grid flex-1 grid-cols-1 gap-0 xl:grid-cols-[288px_minmax(0,1fr)_320px]">
        {/* Columna 1: ZONAS/CAPAS (F9). Conteo REAL, badges por rol real,
            "+ Anadir zona personalizada" con menu de los 5 tipos reales. */}
        <aside aria-label="Zonas y capas" className={`${studioSideClear} border-r border-edge xl:col-start-1 xl:row-start-1`}>
          <div className="flex items-center justify-between border-b border-edge bg-canvas/60 p-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-strong">
              Zonas / Capas ZPL
            </h2>
            <span className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
              {zones.length} elementos
            </span>
          </div>
          <p className="border-b border-warn-line bg-warn-soft px-3 py-2 text-[11px] leading-tight text-warn">
            Las {zones.length - zones.filter((z, i) => esBorrable(z, i)).length} zonas de serie
            pertenecen a la plantilla base; las{" "}
            {zones.filter((z, i) => esBorrable(z, i)).length} libres las puso el operador.
          </p>
          <ul className="max-h-[60vh] flex-1 divide-y divide-edge overflow-y-auto">
            {zones.map((z, i) => {
              const esSel = i === sel;
              const rol = rolDe(z, i, logoSerieIdx);
              const tonoRol =
                rol === "Serie" || rol === "Catálogo"
                  ? "bg-primary-soft text-primary"
                  : rol === "Libre"
                    ? "bg-canvas text-strong"
                    : "bg-canvas text-muted";
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!EDITABLES.has(z.kind)}
                    onClick={() => setSel(i)}
                    className={esSel ? layerActiveClear : layerRowClear}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-strong">
                        {etiquetaDe(z, i)}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted">
                        {detalleZona(z, preview?.symPlan ?? preview?.symbology ?? null)}
                      </span>
                    </span>
                    <span className={`${rolBadgeClear} ${esSel ? "bg-primary text-white" : tonoRol}`}>
                      {esSel ? "ACTIVO" : rol}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-edge bg-panel p-3">
            <button
              type="button"
              onClick={() => setMenuZonas((m) => !m)}
              aria-expanded={menuZonas}
              className={`${buttonClearSecondary} w-full border-dashed`}
            >
              + Añadir zona personalizada
            </button>
            {menuZonas && (
              <div className="mt-2 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => {
                    agregarTextoLibre();
                    setMenuZonas(false);
                  }}
                  className={insertClear}
                >
                  Texto libre
                </button>
                <button
                  type="button"
                  onClick={() => {
                    agregarCodigoBarrasFijo();
                    setMenuZonas(false);
                  }}
                  className={insertClear}
                >
                  Código barras (fijo + HRI)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    agregarRectanguloLibre();
                    setMenuZonas(false);
                  }}
                  className={insertClear}
                >
                  Rectángulo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    agregarLineaLibre();
                    setMenuZonas(false);
                  }}
                  className={insertClear}
                >
                  Línea
                </button>
                <button
                  type="button"
                  onClick={() => {
                    agregarLogoExtra();
                    setMenuZonas(false);
                  }}
                  className={insertClear}
                >
                  Logo GFA (duplicado)
                </button>
              </div>
            )}
          </div>
        </aside>
        {/* Columna 3: inspector (F9). Propiedades por kind (las existentes) +
            PRODUCTO DE MUESTRA + Imprimir prueba + Guardar como plantilla
            (mismos handlers). En movil va despues del lienzo. */}
        <section className="flex min-w-0 flex-col gap-4 border-l border-edge bg-panel p-4 xl:col-start-3 xl:row-start-1">

          {zona && EDITABLES.has(zona.kind) && (
            <div
              className={cardClear + " p-4"}
              onBlurCapture={(e) => {
                // Edicion confirmada (F9): al salir del panel, si algo cambio,
                // UN commit de undo. Moverse entre campos del panel no cuenta.
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                const ahora = JSON.stringify(zones);
                if (ahora !== ultimoCommitRef.current) comprometer(zones);
              }}
            >
              <h3 className="mb-3 flex items-center justify-between text-sm font-semibold tracking-tight text-strong">
                <span>Propiedades de zona</span>
                <span className="rounded bg-primary-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                  {zona.kind === "barcode" && String(zona.source ?? "barcode") === "fixed"
                    ? "codigo fijo"
                    : etiquetaDe(zona, sel)}
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Num
                  label="X (mm)"
                  value={MM(Number(zona.x))}
                  onChange={(v) => editar(sel, { x: DOTS(v) })}
                />
                <Num
                  label="Y (mm)"
                  value={MM(Number(zona.y))}
                  onChange={(v) => editar(sel, { y: DOTS(v) })}
                />
              </div>

              {/* El marco (`kind: "shape"`) no tiene panel, y no es un olvido: ya no es
                  editable. El rectangulo LIBRE (`kind: "rect"`) si tiene el suyo mas abajo:
                  mismo `^GB`, distinto `kind`, y por eso uno se toca y el otro no. */}

              {zona.kind === "graphic" && (
                <>
                  {(() => {
                    const d = graphicDots(String(zona.gf));
                    return (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Num
                          label="ancho logo (mm)"
                          value={MM(d.dots?.w ?? 0)}
                          onChange={(v) => editarLogo(sel, v, null)}
                        />
                        <Num
                          label="alto logo (mm)"
                          value={MM(d.dots?.h ?? 0)}
                          onChange={(v) => editarLogo(sel, null, v)}
                        />
                      </div>
                    );
                  })()}
                  {/* Cambiar imagen (F9): PNG -> ^GFA via POST /api/editor/logo. */}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,.png"
                    className="hidden"
                    aria-label="Elegir PNG para el logo"
                    onChange={(e) => {
                      void cambiarLogo(sel, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={pedirLogo}
                    disabled={logoBusy}
                    className={`${buttonClearSecondary} mt-3 w-full`}
                  >
                    {logoBusy ? "convirtiendo…" : "Cambiar imagen…"}
                  </button>
                  {logoError && (
                    <p role="alert" className="mt-2 rounded-md border border-error bg-error-soft px-3 py-2 text-xs text-error">
                      {logoError}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Solo PNG, maximo 2 MB. Se convierte a `^GFA` en blanco y negro
                    (umbral 128) al ancho actual del logo, manteniendo la
                    proporcion.
                    {sel !== logoSerieIdx
                      ? " Este es un duplicado: se puede borrar."
                      : " Este es el logo de serie: no se puede borrar, pero si cambiar."}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    El logo es un bitmap dentro del <code>^GFA</code>, no una imagen con tamano
                    aparte: el ancho se ajusta al multiplo de 8 mas cercano porque cada byte son 8
                    dots. Al cambiarlo se reescala manteniendo la proporcion, con vecino mas
                    proximo y sin suavizado, que es lo unico que una impresora termica de 203 dpi
                    sabe hacer.
                  </p>
                </>
              )}

              {zona.kind === "barcode" ? (
                <>
                  {/* Fuente del codigo (F9): producto o fijo, con el mismo mando.
                      El resto de la geometria no se toca: el toggle es de fuente. */}
                  <div className="mt-3">
                    <span className="mb-1 block text-xs text-muted">Fuente del codigo</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => cambiarFuenteBarcode(sel, "barcode")}
                        disabled={String(zona.source ?? "barcode") !== "fixed"}
                        className={buttonClearSecondary}
                        title={
                          String(zona.source ?? "barcode") !== "fixed"
                            ? "Ya es de producto"
                            : "Volver al codigo del producto"
                        }
                      >
                        De producto
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarFuenteBarcode(sel, "fixed")}
                        disabled={String(zona.source ?? "barcode") === "fixed"}
                        className={buttonClearSecondary}
                        title={
                          String(zona.source ?? "barcode") === "fixed"
                            ? "Ya es fijo"
                            : "Fijar un contenido propio (siempre Code128)"
                        }
                      >
                        Fijo
                      </button>
                    </div>
                    {String(zona.source ?? "barcode") === "fixed" ? (
                      <>
                        <label
                          htmlFor="editor-barcode-fijo"
                          className="mb-1 mt-2 block text-xs text-muted"
                        >
                          Contenido fijo
                        </label>
                        <input
                          id="editor-barcode-fijo"
                          value={String(zona.text ?? "")}
                          maxLength={48}
                          onChange={(e) => editar(sel, { text: e.target.value })}
                          className={`${input} font-mono`}
                        />
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                          Sale SIEMPRE en Code128 (^BCN), sin auto-EAN. Maximo 48
                          ASCII. Vacio no se guarda (400 honesto).
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        Del catalogo por codigo: la symbologia la decide el plan
                        (EAN-13 o Code 128).
                      </p>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Num
                      label="alto barra (mm)"
                      step={0.5}
                      value={MM(Number(zona.heightDots))}
                      onChange={(v) => editar(sel, { heightDots: DOTS(v) })}
                    />
                    <Num
                      label="linea bajo (mm)"
                      step={0.25}
                      value={MM(Number(zona.hriHeightDots ?? 14))}
                      onChange={(v) => editar(sel, { hriHeightDots: DOTS(v) })}
                    />
                  </div>
                  <Num
                    label="ancho de modulo (dots)"
                    step={1}
                    value={Number(zona.moduleWidth)}
                    onChange={(v) => editar(sel, { moduleWidth: v })}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    El minimo de ISO/IEC 15420 son 0,264 mm: 3 dots son 0,375 mm y 2 dots son
                    0,250 mm, por debajo. Con 2 hay que leer en fisico antes de dejarlo.
                  </p>
                </>
              ) : zona.kind === "text" ? (
                <>
                  {zona.source === "fixed" && (
                    <div className="mt-3">
                      <label
                        htmlFor="editor-texto-fijo"
                        className="mb-1 block text-xs text-muted"
                      >
                        Contenido
                      </label>
                      <input
                        id="editor-texto-fijo"
                        value={String(zona.text ?? "")}
                        maxLength={60}
                        onChange={(e) => editar(sel, { text: e.target.value })}
                        className={input}
                      />
                      <p className="mt-1 text-[11px] leading-relaxed text-muted">
                        Texto fijo: sale tal cual (plegado a ASCII, sin mayusculas forzadas).
                        Maximo 60 caracteres.
                      </p>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Num
                      label="alto letra (mm)"
                      step={0.25}
                      value={altoDeFuente(zona)}
                      onChange={(v) => editarFuente(sel, v)}
                    />
                    <Num
                      label="ancho letra (mm)"
                      step={0.25}
                      value={anchoDeFuente(zona)}
                      onChange={(v) => editarFuenteAncho(sel, v)}
                    />
                  </div>
                  {zona.autoFit ? (
                    <>
                      {resuelto && resuelto.texto !== null && (
                        <div className="mt-3 rounded-md border border-success bg-success-soft px-3 py-2">
                          <p className="text-xs font-semibold text-success">
                            Con este nombre sale asi
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-success">
                            {resuelto.texto}
                          </p>
                          <p className="mt-1 text-xs text-success">
                            alto {MM(resuelto.alto).toFixed(2)} mm ({resuelto.alto} dots), ancho
                            de letra {MM(resuelto.ancho).toFixed(2)} mm ({resuelto.ancho} dots)
                          </p>
                          {porQueSeBajo && (
                            <p className="mt-1 text-xs text-success">{porQueSeBajo}</p>
                          )}
                        </div>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Num
                          label="alto maximo (mm)"
                          step={0.25}
                          value={MM((zona.autoFit as Record<string, number>).maxHeight)}
                          onChange={(v) => editarAutoFit(sel, { maxHeight: DOTS(v) })}
                        />
                      <Num
                          label="alto minimo (mm)"
                          step={0.25}
                          value={MM((zona.autoFit as Record<string, number>).minHeight)}
                          onChange={(v) => editarAutoFit(sel, { minHeight: DOTS(v) })}
                        />
                      <Num
                          label="condensado (widthRatio)"
                          step={0.01}
                          value={(zona.autoFit as Record<string, number>).widthRatio}
                          onChange={(v) => editarAutoFit(sel, { widthRatio: v })}
                        />
                      </div>
                      {(zona.autoFit as Record<string, number>).maxBlockDots !== undefined && (
                        <Num
                          label="alto del bloque (mm)"
                          step={0.25}
                          value={MM((zona.autoFit as Record<string, number>).maxBlockDots!)}
                          onChange={(v) => editarAutoFit(sel, { maxBlockDots: DOTS(v) })}
                        />
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-warn">
                      Esta zona no tiene autoFit: el alto de letra es el que pongas, fijo.
                    </p>
                  )}
                  <Num
                    label="ancho de caja (mm)"
                    step={0.5}
                    value={zona.maxWidthDots === undefined ? 0 : MM(Number(zona.maxWidthDots))}
                    onChange={(v) =>
                      editar(sel, { maxWidthDots: v > 0 ? DOTS(v) : undefined })
                    }
                  />
                </>
              ) : zona.kind === "rect" ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Num
                      label="ancho (mm)"
                      step={0.5}
                      value={MM(Number(zona.widthDots))}
                      onChange={(v) => editar(sel, { widthDots: Math.max(1, DOTS(v)) })}
                    />
                    <Num
                      label="alto (mm)"
                      step={0.5}
                      value={MM(Number(zona.heightDots))}
                      onChange={(v) => editar(sel, { heightDots: Math.max(1, DOTS(v)) })}
                    />
                  </div>
                  <Num
                    label="grosor (mm)"
                    step={0.125}
                    value={MM(Number(zona.thicknessDots))}
                    onChange={(v) =>
                      editar(sel, { thicknessDots: Math.min(5, Math.max(1, DOTS(v))) })
                    }
                  />
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Rectangulo hueco con `^GB`, como el marco pero libre: se arrastra y se
                    estira por los bordes. El grosor va de 1 a 5 dots (0,125 a 0,625 mm).
                  </p>
                </>
              ) : zona.kind === "line" ? (
                <>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Num
                      label="largo (mm)"
                      step={0.5}
                      value={MM(Number(zona.largoDots))}
                      onChange={(v) => editar(sel, { largoDots: Math.max(1, DOTS(v)) })}
                    />
                    <Num
                      label="grosor (mm)"
                      step={0.125}
                      value={MM(Number(zona.thicknessDots))}
                      onChange={(v) =>
                        editar(sel, { thicknessDots: Math.min(5, Math.max(1, DOTS(v))) })
                      }
                    />
                  </div>
                  <div className="mt-2">
                    <label htmlFor="editor-orientacion" className="mb-1 block text-xs text-ink-soft">
                      Orientacion
                    </label>
                    <select
                      id="editor-orientacion"
                      value={String(zona.orientacion)}
                      onChange={(e) => editar(sel, { orientacion: e.target.value })}
                      className={input}
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical">Vertical</option>
                    </select>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Linea con `^GB` colapsado: solo horizontal o vertical, sin diagonales (el
                    preview no las dibuja). El largo va en el eje de la orientacion y el
                    grosor (1 a 5 dots) en el otro.
                  </p>
                </>
              ) : null}

              {/* Solo lo libre se puede borrar: textos fijos (F8a), figuras libres
                  (F8b), codigos fijos y logos duplicados (F9). Las zonas de serie
                  (marco, logo de serie, nombre, barras de producto, digitos, REF y
                  precio) no: son la estructura de la etiqueta. */}
              {esBorrable(zona, sel) && (
                <>
                  <button
                    type="button"
                    onClick={() => eliminarZonaLibre(sel)}
                    className={`${buttonClearSecondary} mt-3 w-full`}
                  >
                    Eliminar esta zona
                  </button>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Las zonas de serie (marco, logo de serie, nombre, barras de
                    producto, digitos, REF y precio) no se pueden borrar: son la
                    estructura de la etiqueta.
                  </p>
                </>
              )}

              {/* Lo que las asas hacen de verdad en ESTA zona. Sin esto, tirar de un tirador y
                  que no pase nada parece un fallo del editor, y en el codigo de barras y en el
                  logo es justo lo que pasa a proposito. */}
              {zonaEjes?.nota && (
                <p className="mt-3 rounded-md border border-warn-line bg-warn-soft px-2 py-1.5 text-[11px] text-warn">
                  {zonaEjes.nota}
                </p>
              )}
            </div>
          )}

          {/* ------------------------------------------------------ datos de prueba */}
          <div className={cardClear + " p-4"}>
            <h3 className="mb-3 text-sm font-semibold tracking-tight text-strong">
              Datos de prueba
            </h3>
            <label className="mb-1 block text-xs text-muted">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={input}
            />
            <label className="mb-1 mt-2 block text-xs text-muted">Codigo de barras</label>
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className={input}
            />
            <label className="mb-1 mt-2 block text-xs text-muted">Precio</label>
            <input
              type="number"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(Number(e.target.value))}
              className={input}
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Prueba con un nombre corto y con uno de 50 caracteres. El alto de letra sale
              distinto en cada caso: esa es la gracia del autoFit. La pestana ZPL usa esta misma
              muestra.
            </p>
          </div>

          {/* ------------------------------------------------------------ aplicar */}
          <div className={cardClear + " border-2 border-primary p-4"}>
            <h3 className="mb-2 text-sm font-semibold tracking-tight text-strong">Aplicar</h3>
            <p className="mb-3 text-xs leading-relaxed text-muted">
              Guarda estos valores y a partir de ya imprimen. No toca{" "}
              <code>label.template.ts</code>: se guardan en{" "}
              <code>data/plantilla-override.json</code>, que se aplica encima de la plantilla del
              codigo. Borrar ese archivo, o el boton de abajo, vuelve a como estaba.
            </p>

            {aplicadoTexto && (
              <div className="mb-3 rounded-md border border-success bg-success-soft px-3 py-2">
                <p className="text-xs font-semibold text-success">{aplicadoTexto}</p>
                {guardado && (
                  <p className="mt-0.5 font-mono text-[11px] text-success">
                    data/plantilla-override.json · {guardado.savedAt}
                  </p>
                )}
              </div>
            )}
            {rechazo && (
              <div className="mb-3 rounded-md border border-error bg-error-soft px-3 py-2">
                <p className="text-xs font-semibold text-error">{rechazo}</p>
                {rechazoDetalle.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-[11px] text-error">
                    {rechazoDetalle.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando}
              className={`${buttonClear} w-full`}
            >
              {aplicando ? "guardando..." : "Aplicar cambios"}
            </button>

            {hayOverride && (
              <button
                type="button"
                onClick={descartar}
                disabled={aplicando}
                className={`${buttonClearSecondary} mt-2 w-full`}
              >
                Descartar y volver al codigo
              </button>
            )}

            {hayOverride && !aplicadoTexto && (
              <p className="mt-2 text-[11px] text-warn">
                Hay cambios guardados que todavia no has aplicado en pantalla. Si aplicas ahora,
                se reemplazan.
              </p>
            )}
          </div>

          {/* --------------------------------------- biblioteca e impresion real */}
          <PruebaImpresionPanel
            productos={productos}
            muestra={muestra}
            onMuestra={setMuestra}
            plantillaNombre={activa?.name ?? ""}
            ocupado={imprimiendo}
            puede={muestra.trim() !== "" && productos.length > 0}
            avisoSinAplicar={avisoPruebaSinAplicar}
            resultado={pruebaOk}
            error={pruebaError}
            onImprimir={() => void imprimirPrueba()}
          />
          <GuardarPlantillaPanel
            nombre={nombrePlantilla}
            onNombre={(v) => {
              setNombrePlantilla(v);
              setPlantillaCreada(null);
              setPlantillaError(null);
            }}
            ocupado={guardandoPlantilla}
            puede={nombrePlantilla.trim() !== "" && motivoBloqueoGuardar === null}
            motivoBloqueo={motivoBloqueoGuardar}
            resultado={plantillaCreada}
            error={plantillaError}
            onGuardar={() => void guardarComoPlantilla()}
          />
        </section>

        {/* Columna 2: lienzo (F9). En movil va primero. */}
        <section className="order-first flex min-w-0 flex-col gap-3 bg-slate-200/70 p-4 xl:order-none xl:col-start-2 xl:row-start-1">
          {/* Barra meta REAL (F9): 203 DPI, mm y dots desde las constantes. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-panel px-4 py-1.5 font-mono text-[11px] text-muted">
            <span>
              Resolución: <strong className="text-strong">203 DPI ({MM_TO_DOTS} dots/mm)</strong>
            </span>
            <span>·</span>
            <span>
              Tamaño físico:{" "}
              <strong className="text-strong">
                {DEFAULT_TEMPLATE.widthMm.toFixed(1)} × {DEFAULT_TEMPLATE.heightMm.toFixed(1)} mm
              </strong>
            </span>
            <span>·</span>
            <span>
              Matriz dots:{" "}
              <strong className="text-strong">
                {DEFAULT_TEMPLATE.widthDots} × {DEFAULT_TEMPLATE.heightDots} px
              </strong>
            </span>
            <span className="ml-auto font-sans">
              Clic para arrastrar elemento · Flechas = 1 dot (Shift = 1 mm)
            </span>
            {busy && <span className="text-primary">calculando…</span>}
          </div>

          {error && (
            <p className="rounded-card border border-error bg-error-soft px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          {preview && (
            <div
              ref={lienzoRef}
              className="relative touch-none select-none overflow-auto rounded-lg border border-edge bg-white p-2 shadow-card"
              onPointerDown={empezarGesto}
              onPointerMove={moverPuntero}
              onPointerUp={terminarGesto}
              onPointerCancel={terminarGesto}
              onLostPointerCapture={terminarGesto}
            >
              {/* Regla superior en mm (F9): pura presentacion sobre la grilla. Cada
                  mm son 8 dots a 203 dpi, por el zoom actual. */}
              <div className={`flex ${rulerClear}`} aria-hidden="true">
                <div style={{ width: 28, height: 14 }} />
                <div className="relative flex" style={{ height: 14 }}>
                  {Array.from({ length: Math.round(DEFAULT_TEMPLATE.widthMm) + 1 }, (_, mm) => (
                    <div
                      key={mm}
                      className="relative border-l border-edge"
                      style={{ width: MM_TO_DOTS * zoom, height: 14 }}
                    >
                      {mm % 5 === 0 && (
                        <span className="absolute left-0.5 top-0.5">{mm}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex">
                {/* Regla izquierda en mm (F9): igual que la superior, en vertical. */}
                <div className={rulerClear} aria-hidden="true" style={{ width: 28 }}>
                  {Array.from({ length: Math.round(DEFAULT_TEMPLATE.heightMm) + 1 }, (_, mm) => (
                    <div
                      key={mm}
                      className="relative border-t border-edge text-right"
                      style={{ height: MM_TO_DOTS * zoom }}
                    >
                      {mm % 5 === 0 && (
                        <span className="absolute right-1 top-0.5">{mm}</span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Todo lo absoluto de aca dentro se posiciona contra ESTE wrapper, que empieza
                    en el mismo punto que la imagen: cero offsets magicos. */}
                <div
                  className="relative"
                  onMouseMove={(e) => {
                    const el = imgRef.current;
                    if (!el) {
                      setCursor(null);
                      return;
                    }
                    const r = el.getBoundingClientRect();
                    setCursor({
                      xMm: (e.clientX - r.left) / zoom / MM_TO_DOTS,
                      yMm: (e.clientY - r.top) / zoom / MM_TO_DOTS,
                    });
                  }}
                  onMouseLeave={() => setCursor(null)}
                >
                <img
                  ref={imgRef}
                  src={`data:image/png;base64,${preview.png}`}
                  width={DEFAULT_TEMPLATE.widthDots * zoom}
                  height={DEFAULT_TEMPLATE.heightDots * zoom}
                  alt="Previsualizacion de la etiqueta"
                  draggable={false}
                  className="block"
                />

                {/* Cajas del render: SOLO referencia visual de lo ultimo impreso. Sin eventos
                    y sin chip: el que manda sobre el puntero es el marco de abajo. */}
                {mostrarCajas &&
                  preview.cajas.map((c, i) => (
                    <div
                      key={i}
                      data-caja={i}
                      className="pointer-events-none absolute border border-dashed border-primary/55"
                      style={{
                        left: `${c.x0 * zoom}px`,
                        top: `${c.y0 * zoom}px`,
                        width: `${(c.x1 - c.x0) * zoom}px`,
                        height: `${(c.y1 - c.y0) * zoom}px`,
                      }}
                    />
                  ))}

                {/* Area de clic de cada zona editable, derivada de `zones` y no del render:
                    una zona plegada o sin caja dibujada sigue siendo arrastrable. Invisible
                    hasta que el puntero se acerca, que es cuando importa. */}
                {marcos.map((m, i) =>
                  m ? (
                    <div
                      key={`zona-${i}`}
                      data-zona={i}
                      className="absolute cursor-move border border-transparent hover:border-primary"
                      style={{
                        left: `${m.x0 * zoom}px`,
                        top: `${m.y0 * zoom}px`,
                        width: `${(m.x1 - m.x0) * zoom}px`,
                        height: `${(m.y1 - m.y0) * zoom}px`,
                      }}
                    />
                  ) : null,
                )}

                {/* Guias de alineacion (F9): centro de la seleccion, a lo ancho y
                    alto del lienzo. Geometria real del marco, presentacion pura. */}
                {marcoSel && (
                  <>
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-primary/70"
                      style={{ left: `${((marcoSel.x0 + marcoSel.x1) / 2) * zoom}px` }}
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-primary/70"
                      style={{ top: `${((marcoSel.y0 + marcoSel.y1) / 2) * zoom}px` }}
                    />
                  </>
                )}

                {/* Marco de la zona seleccionada: unico, con asas, y POR ENCIMA de todo. */}
                {marcoSel && (
                  <div
                    data-marco
                    className="absolute cursor-move border-2 border-primary"
                    style={{
                      left: `${marcoSel.x0 * zoom}px`,
                      top: `${marcoSel.y0 * zoom}px`,
                      width: `${(marcoSel.x1 - marcoSel.x0) * zoom}px`,
                      height: `${(marcoSel.y1 - marcoSel.y0) * zoom}px`,
                    }}
                  >
                    <span className="absolute -top-4 left-0 whitespace-nowrap bg-primary px-1 text-[10px] text-white">
                      {zona ? etiquetaDe(zona, sel) : ""} · x{Math.round(marcoSel.x0)}-
                      {Math.round(marcoSel.x1)} y{Math.round(marcoSel.y0)}-{Math.round(marcoSel.y1)}
                      {asasMarco.length > 0 ? " · arrastra o estira" : " · arrastra"}
                    </span>
                    {asasMarco.map((a) => (
                      <div
                        key={a}
                        data-asa={a}
                        title={TITULO_ASIDERA[a]}
                        className={`absolute h-3 w-3 rounded-sm border border-primary bg-white ${
                          CURSA_ASIDERA[a]
                        }`}
                        style={{
                          left: `${POS_ASIDERA[a].x * 100}%`,
                          top: `${POS_ASIDERA[a].y * 100}%`,
                          // El asa va ENCIMA del borde, no pegada dentro: tiene que caer justo
                          // sobre la linea que estira, que es donde el puntero ya esta.
                          marginLeft: -6,
                          marginTop: -6,
                        }}
                      />
                    ))}
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {/* Panel validador (F9, piel del mockup): colisiones REALES de
              `buscarProblemas` + desbordes REALES del informe + symbologia,
              modulo y quiet REALES del plan del preview. Sin hallazgos, verde
              honesto con la muestra actual. El informe completo sigue debajo. */}
          {preview && (
            <div className="border-t border-edge bg-panel px-4 py-2.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wide text-strong">
                  Informe del validador ZPL
                </h3>
                {solapes.length + avisos.length > 0 ? (
                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-semibold text-warn">
                    Colisiones y desbordes detectados
                  </span>
                ) : (
                  <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
                    Sin colisiones con esta muestra
                  </span>
                )}
                <span className="ml-auto font-mono text-[11px] text-muted">
                  sym: {preview.symPlan ?? preview.symbology ?? "-"} · simbolo:{" "}
                  {preview.anchoSimbolo} dots ({MM(preview.anchoSimbolo).toFixed(1)} mm) ·
                  modulo: {preview.modulo} dots · modulos: {preview.modulos} · quiet:{" "}
                  {preview.zonaQuieta} dots
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 text-[11px] md:grid-cols-2">
                {solapes.length > 0 && (
                  <div className="rounded border border-warn-line bg-warn-soft p-2 text-warn">
                    <strong className="block font-semibold">
                      Con estos valores algo se pisa o se sale:
                    </strong>
                    <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[10px]">
                      {solapes.map((s, i) => (
                        <li key={i}>{s.mensaje}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {avisos.length > 0 && (
                  <div className="rounded border border-error bg-error-soft p-2 text-error">
                    <strong className="block font-semibold">
                      Texto no sale entero (Desborde):
                    </strong>
                    <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[10px]">
                      {avisos.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {solapes.length + avisos.length === 0 && (
                  <p className="rounded border border-success bg-success-soft p-2 text-success md:col-span-2">
                    Nada se pisa ni se sale con «{nombre}» · {barcode} · {precio}. Con
                    otro producto puede cambiar: el validador mira la muestra actual.
                  </p>
                )}
              </div>
              <details className="mt-2 text-[11px] text-muted">
                <summary className="cursor-pointer font-medium">Ver informe completo</summary>
                <pre className={`${monoClear} mt-1 whitespace-pre-wrap`}>
                  {[
                    `symbologia: ${preview.symbology ?? "-"}`,
                    `datos impresos: ${preview.datosImpresos ?? "-"}`,
                    `ancho del simbolo: ${preview.anchoSimbolo} dots (${MM(preview.anchoSimbolo).toFixed(1)} mm)`,
                    `zona quieta: ${preview.zonaQuieta} dots`,
                    "",
                    ...preview.informe,
                  ].join("\n")}
                </pre>
              </details>
            </div>
          )}

          <EditorTabs
            tab={tab}
            onTab={setTab}
            zpl={
              <ZplTab
                texto={zpl}
                cargando={zplCargando}
                error={zplError}
                captions={zplCaptions}
                avisoSinAplicar={avisoZplSinAplicar}
                onActualizar={() => setZplTick((t) => t + 1)}
              />
            }
            origen={<OrigenTab zones={zones} etiquetaDe={etiquetaDe} logoSerieIdx={logoSerieIdx} />}
          />
        </section>
      </div>
      )}

      {/* Barra de estado (F9): todo real. Motor estatico y honesto ("local (en
          proceso)", sin "Online" fingido); impresora objetivo de settings/cola;
          origen override-vs-codigo; cursor real del raton; version REAL del
          package (prohibido inventar la del mockup). */}
      <footer className={studioFooterClear}>
        <span>
          <span className="inline-block size-1.5 rounded-full bg-slate-500" /> Motor ZPL: local
          (en proceso)
        </span>
        <span>
          Impresora objetivo:{" "}
          <span className="text-slate-300">
            {imp?.queue !== "" && imp?.queue ? imp.queue : "sin datos"}
            {imp?.port ? ` (${imp.port})` : ""}
          </span>
        </span>
        <span>
          Origen:{" "}
          <span className="text-slate-300">
            {hayOverride ? "data/plantilla-override.json" : "codigo"}
          </span>
        </span>
        <span className="ml-auto">
          Coordenadas cursor:{" "}
          {cursor
            ? `X: ${cursor.xMm.toFixed(1)}mm | Y: ${cursor.yMm.toFixed(1)}mm`
            : "—"}
        </span>
        <span className="text-slate-300">v{version ?? "…"}</span>
      </footer>
    </main>
  );
}

function altoDeFuente(z: AnyZone): number {
  if (z.autoFit) return MM((z.autoFit as Record<string, number>).maxHeight);
  const m = String(z.format ?? "").match(/\^A0N,(\d+),/);
  return m ? MM(Number(m[1])) : 0;
}

function anchoDeFuente(z: AnyZone): number {
  if (z.autoFit) return MM(Math.round(altoDeFuente(z) * MM_TO_DOTS * Number((z.autoFit as Record<string, number>).widthRatio)));
  const m = String(z.format ?? "").match(/\^A0N,(\d+),(\d+)/);
  return m ? MM(Number(m[2])) : 0;
}

/** Cambia el alto de fuente. Con `autoFit` manda sobre `format`; sin el, cambia `format`. */
function conAltoDeFuente(z: AnyZone, mm: number): AnyZone {
  const alto = DOTS(mm);
  if (z.autoFit) {
    const af = z.autoFit as Record<string, number>;
    const ancho = Math.max(1, Math.round(alto * af.widthRatio));
    return { ...z, autoFit: { ...af, maxHeight: alto }, format: `^A0N,${alto},${ancho}` };
  }
  const actualAncho = Number(String(z.format ?? "").match(/\^A0N,(\d+),(\d+)/)?.[2] ?? 1);
  const actualAlto = Number(String(z.format ?? "").match(/\^A0N,(\d+),/)?.[1] ?? 1);
  // El ancho de caracter sigue la misma proporcion que el alto, para no deformar la letra.
  const ancho = Math.max(1, Math.round((actualAncho * alto) / Math.max(1, actualAlto)));
  return { ...z, format: `^A0N,${alto},${ancho}` };
}

/** Cambia solo el ancho de caracter, dejando el alto como estaba. */
function conAnchoDeFuente(z: AnyZone, mm: number): AnyZone {
  const ancho = DOTS(mm);
  const alto = Number(String(z.format ?? "").match(/\^A0N,(\d+),/)?.[1] ?? 14);
  return { ...z, format: `^A0N,${alto},${ancho}` };
}

function conAutoFit(z: AnyZone, cambio: Record<string, number>): AnyZone {
  const af = (z.autoFit ?? { maxHeight: 32, minHeight: 13, widthRatio: 0.5 }) as Record<
    string,
    number
  >;
  return { ...z, autoFit: { ...af, ...cambio } };
}

/**
 * Figuras libres (F8b): marco de seleccion, redimensionado y ejes, en la pagina.
 *
 * Viven aqui y no en `label.resize.ts` / `label.marco.ts` porque esos modulos no estan
 * en la superficie de F8b y no se tocan. La geometria es la misma que la del `shape`:
 * el rectangulo ES la zona y la linea es la barra que emite el builder (largo en el
 * eje de la orientacion, grosor en el otro), asi que el marco es el rectangulo que se
 * imprime y los lados izquierdo/superior mueven la posicion. En la linea, el eje que
 * no manda el largo manda el grosor (1..5 dots, como el esquema): estirar en vertical
 * una linea horizontal la engorda, no la desplaza.
 */
function esFiguraLibre(z: AnyZone): boolean {
  return z.kind === "rect" || z.kind === "line";
}

function marcoFiguraLibre(z: AnyZone): { x0: number; y0: number; x1: number; y1: number } | null {
  const x = Number(z.x);
  const y = Number(z.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
  if (z.kind === "rect") {
    const w = Number(z.widthDots);
    const h = Number(z.heightDots);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { x0: x, y0: y, x1: x + w, y1: y + h };
  }
  if (z.kind === "line") {
    const t = Math.min(5, Math.max(1, Math.round(Number(z.thicknessDots))));
    const l = Number(z.largoDots);
    if (!Number.isFinite(l) || l <= 0 || !Number.isFinite(t)) return null;
    const w = z.orientacion === "vertical" ? t : l;
    const h = z.orientacion === "vertical" ? l : t;
    return { x0: x, y0: y, x1: x + w, y1: y + h };
  }
  return null;
}

function redimensionarFiguraLibre(z: AnyZone, asa: Asider, dx: number, dy: number): AnyZone {
  const l = lados(asa);
  const dL = l.izq ? dx : 0;
  const dR = l.der ? dx : 0;
  const dT = l.arr ? dy : 0;
  const dB = l.aba ? dy : 0;
  const x = Math.max(0, Math.round(Number(z.x) + dL));
  const y = Math.max(0, Math.round(Number(z.y) + dT));
  if (z.kind === "rect") {
    return {
      ...z,
      x,
      y,
      widthDots: Math.max(MIN_DOTS.ancho, Math.round(Number(z.widthDots) + dR - dL)),
      heightDots: Math.max(MIN_DOTS.alto, Math.round(Number(z.heightDots) + dB - dT)),
    };
  }
  const vertical = z.orientacion === "vertical";
  const dLargo = vertical ? dB - dT : dR - dL;
  const dGrosor = vertical ? dR - dL : dB - dT;
  return {
    ...z,
    x,
    y,
    largoDots: Math.max(MIN_DOTS.ancho, Math.round(Number(z.largoDots) + dLargo)),
    thicknessDots: Math.min(5, Math.max(1, Math.round(Number(z.thicknessDots) + dGrosor))),
  };
}

function ejesFiguraLibre(z: AnyZone): { x: boolean; y: boolean; nota: string } | null {
  if (z.kind === "rect") return { x: true, y: true, nota: "" };
  if (z.kind === "line") {
    return {
      x: true,
      y: true,
      nota:
        z.orientacion === "vertical"
          ? "Vertical cambia el largo; horizontal, el grosor (1..5 dots)."
          : "Horizontal cambia el largo; vertical, el grosor (1..5 dots).",
    };
  }
  return null;
}

function Num({
  label,
  value,
  onChange,
  step = 0.25,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="mt-2">
      <label className="mb-1 block text-xs text-ink-soft">{label}</label>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className={input}
      />
    </div>
  );
}