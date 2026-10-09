"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_TEMPLATE, MM_TO_DOTS } from "@/lib/labels/label.template";
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
  monoClear,
  pillClear,
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

  cajas.forEach((c, i) => {
    // El marco no tiene texto, asi que sin emparejarlo por tipo se quedaba sin caja
    // asociada: era la razon de que no se pudiera mover. Por tipo funciona porque solo hay
    // una zona de cada uno de estos tres tipos.
    if (c.etiqueta === "barras" || c.etiqueta === "logo" || c.etiqueta === "marco") {
      const kind =
        c.etiqueta === "barras" ? "barcode" : c.etiqueta === "logo" ? "graphic" : "shape";
      const j = zones.findIndex((z) => z.kind === kind);
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
        };
        if (!vivo || !Array.isArray(j?.productos)) return;
        setProductos(j.productos);
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
      setZones(structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[]);
      setSel(primeraEditable(structuredClone(DEFAULT_TEMPLATE.zones) as unknown as AnyZone[]));
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
    setZones((prev) => [...prev, nueva]);
    setSel(zones.length);
  }

  /**
   * Borra la zona seleccionada. Solo las libres se pueden borrar: los textos fijos (F8a)
   * y las figuras libres (F8b) los puso el operador y se quitan; las 7 de serie son la
   * estructura de la etiqueta (marco, logo, nombre, barras, digitos, REF y precio) y sin
   * ellas no hay etiqueta que imprimir. El boton solo se pinta para las libres, asi que
   * esto no necesita comprobar nada mas.
   */
  function eliminarZonaLibre(i: number) {
    const resto = zones.filter((_, j) => j !== i);
    setZones(resto);
    setSel(primeraEditable(resto));
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
    setZones((prev) => [...prev, nueva]);
    setSel(zones.length);
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
    setZones((prev) => [...prev, nueva]);
    setSel(zones.length);
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
                anchoSimbolo: preview.anchoSimbolo,
                texto: preview.resueltos[i]?.texto ?? null,
                altoLetra: preview.resueltos[i]?.alto,
                anchoCelda: preview.resueltos[i]?.ancho,
              })
          : null,
      ),
    [zones, preview],
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
        modulos: modulosActuales,
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
      setZones((prev) => prev.map((zz, i) => (i === sel ? { ...zz, x, y } : zz)));
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

  return (
    <main className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={`${displayTitle} text-2xl`}>Editor de plantilla</h1>
          <p className="mt-1 text-sm text-muted">
            El dibujo sale del mismo codigo que genera el ZPL, asi que lo que ves aqui es lo que
            se imprime. Haz clic en cualquier zona y arrastra: se selecciona y se mueve de una,
            como en Word o PowerPoint. Con el boton de <strong>Aplicar cambios</strong> el cambio
            vale para imprimir al instante.
          </p>
        </div>
        {activa && (
          <div className="flex flex-wrap gap-2">
            <span className={pillClear}>
              Activa: {activa.name} · {activa.widthMm} × {activa.heightMm} mm
            </span>
            {activa.kind === "raw" && <span className={badgeRawClear}>RAW</span>}
            {activa.archived && <span className={badgeArchivedClear}>Archivada</span>}
            {hayOverride && editable && (
              <span className={pillClear}>
                Override guardado{guardado ? ` · ${guardado.savedAt}` : ""}
              </span>
            )}
          </div>
        )}
      </header>

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
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
        {/* ------------------------------------------------------------- controles */}
        <section className="flex flex-col gap-4">
          <div className={cardClear + " p-4"}>
            <h3 className="mb-2 text-sm font-semibold tracking-tight text-strong">Zonas</h3>
            <button
              type="button"
              onClick={agregarTextoLibre}
              className={`${buttonClearSecondary} w-full`}
            >
              Texto libre
            </button>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={agregarRectanguloLibre}
                className={buttonClearSecondary}
              >
                Rectangulo
              </button>
              <button
                type="button"
                onClick={agregarLineaLibre}
                className={buttonClearSecondary}
              >
                Linea
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Agrega un texto fijo (&quot;TEXTO&quot;) arriba a la izquierda: sale tal cual se
              escribe y no varia por producto. El rectangulo (12 x 7 mm, a la izquierda del
              logo) y la linea (vertical de 10 mm, a la derecha) salen con `^GB`, como el
              marco, y se arrastran y estiran igual que lo demas. Solo lo libre se puede
              borrar: el marco fijo no se toca.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {zones.map((z, i) => {
                const activa = i === sel;
                const editable = EDITABLES.has(z.kind);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!editable}
                    onClick={() => setSel(i)}
                    className={`rounded px-2 py-1.5 text-left text-sm ${
                      activa
                        ? "bg-primary text-white"
                        : editable
                          ? "bg-canvas text-strong hover:bg-edge"
                          : "bg-panel text-muted"
                    }`}
                  >
                    {etiquetaDe(z, i)}
                  </button>
                );
              })}
            </div>
          </div>

          {zona && EDITABLES.has(zona.kind) && (
            <div className={cardClear + " p-4"}>
              <h3 className="mb-3 text-sm font-semibold tracking-tight text-strong">
                {etiquetaDe(zona, sel)}
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

              {/* Solo lo libre se puede borrar: textos fijos (F8a) y figuras libres (F8b).
                  Las 7 zonas de serie (marco, logo, nombre, barras, digitos, REF y precio)
                  no: son la estructura de la etiqueta. */}
              {(zona.kind === "rect" ||
                zona.kind === "line" ||
                (zona.kind === "text" && zona.source === "fixed")) && (
                <>
                  <button
                    type="button"
                    onClick={() => eliminarZonaLibre(sel)}
                    className={`${buttonClearSecondary} mt-3 w-full`}
                  >
                    Eliminar esta zona
                  </button>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">
                    Las 7 zonas de serie (marco, logo, nombre, barras, digitos, REF y
                    precio) no se pueden borrar: son la estructura de la etiqueta.
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
          <GuardarPlantillaPanel
            nombre={nombrePlantilla}
            onNombre={(v) => {
              setNombrePlantilla(v);
              setPlantillaCreada(null);
            }}
            ocupado={guardandoPlantilla}
            puede={nombrePlantilla.trim() !== "" && motivoBloqueoGuardar === null}
            motivoBloqueo={motivoBloqueoGuardar}
            resultado={plantillaCreada}
            error={plantillaError}
            onGuardar={() => void guardarComoPlantilla()}
          />
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
        </section>

        {/* --------------------------------------------------------------- dibujo */}
        <section className="flex flex-col gap-3">
          <div className={cardClear + " flex items-center gap-4 px-4 py-2"}>
            <label className="text-xs text-muted">
              Zoom
              <input
                type="range"
                min={1}
                max={6}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="ml-2"
              />
              <span className="ml-1">{zoom}x</span>
            </label>
            <label className="text-xs text-muted">
              <input
                type="checkbox"
                checked={mostrarCajas}
                onChange={(e) => setMostrarCajas(e.target.checked)}
                className="mr-1"
              />
              ver cajas
            </label>
            <span className="text-xs text-muted">
              Clic en cualquier zona para seleccionarla y arrastrarla en el mismo gesto; tira de
              los puntos blancos de las esquinas o los bordes para cambiarle el tamano. Flechas =
              mover 1 dot, con Mayus 1 mm; Escape = deshacer. Vale para el logo, los textos,
              las barras, los rectangulos y las lineas. <strong>El marco no</strong>: es el margen del papel y se calcula
              solo desde el ancho de la etiqueta.
            </span>
            <span className="text-xs text-muted">
              {DEFAULT_TEMPLATE.widthMm} x {DEFAULT_TEMPLATE.heightMm} mm ={" "}
              {DEFAULT_TEMPLATE.widthDots} x {DEFAULT_TEMPLATE.heightDots} dots
            </span>
            {busy && <span className="text-xs text-primary">calculando...</span>}
          </div>

          {error && (
            <p className="rounded-card border border-error bg-error-soft px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}

          {solapes.length > 0 && (
            <div className="rounded-md border border-warn-line bg-warn-soft px-3 py-2">
              <p className="text-sm font-semibold text-warn">
                Con estos valores algo se pisa o se sale de la etiqueta
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs text-warn">
                {solapes.map((s, i) => (
                  <li key={i}>{s.mensaje}</li>
                ))}
              </ul>
            </div>
          )}

          {preview && (
            <div
              ref={lienzoRef}
              className="relative inline-block touch-none select-none rounded-lg border border-edge bg-white p-2 shadow-card"
              onPointerDown={empezarGesto}
              onPointerMove={moverPuntero}
              onPointerUp={terminarGesto}
              onPointerCancel={terminarGesto}
              onLostPointerCapture={terminarGesto}
            >
              {/* Todo lo absoluto de aca dentro se posiciona contra ESTE wrapper, que empieza
                  en el mismo punto que la imagen: cero offsets magicos. */}
              <div className="relative">
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
          )}

          {preview && (
            <div className={cardClear + " p-4"}>
              <h3 className="mb-2 text-sm font-semibold tracking-tight text-strong">Informe</h3>

              {/* Fallos de dibujado, arriba y en grande.
                  Lo que dice "NO" o "EN BLANCO" es algo que falta: una zona que no se ha
                  pintado o un texto que la impresora corta. Abajo, en el `<pre>`, esa linea
                  se leeria como un dato mas entre otros, y justo estos son los que no se
                  pueden perder de vista. */}
              {avisos.length > 0 && (
                <ul className="mb-3 list-disc space-y-1 rounded-md border border-error bg-error-soft px-3 py-2 pl-6 text-xs text-error">
                  {avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              )}

              <pre className={`${monoClear} whitespace-pre-wrap`}>
                {[
                  `symbologia: ${preview.symbology ?? "-"}`,
                  `datos impresos: ${preview.datosImpresos ?? "-"}`,
                  `ancho del simbolo: ${preview.anchoSimbolo} dots (${MM(preview.anchoSimbolo).toFixed(1)} mm)`,
                  `zona quieta: ${preview.zonaQuieta} dots`,
                  "",
                  ...preview.informe,
                ].join("\n")}
              </pre>
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
            origen={<OrigenTab zones={zones} etiquetaDe={etiquetaDe} />}
          />
        </section>
      </div>
      )}
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