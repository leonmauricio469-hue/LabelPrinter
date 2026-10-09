import { listTemplates } from "@/lib/labels/templates.store";
import { readSettings } from "@/lib/settings/settings.store";
import { getProductRepository } from "@/lib/products/product.catalog.repository";
import { TemplateLibrary } from "@/components/template-detail";

/**
 * `/plantillas` (F4): biblioteca multi-plantilla real.
 *
 * Server component: lee la biblioteca, la activa de settings y un codigo real del
 * catalogo para los thumbnails, y se los pasa a la biblioteca cliente. Sin "use client"
 * aqui: esta pagina no imprime ni toca la impresora.
 */
export const dynamic = "force-dynamic";

export default async function PlantillasPage() {
  const templates = await listTemplates({ incluirArchivadas: true });
  const settings = await readSettings();

  // Un codigo real cualquiera para `GET /api/labels/preview?code=...&template=...`, que
  // exige producto existente. Si el catalogo no carga, las tarjetas estructuradas lo
  // dicen en vez de inventar un codigo.
  let sampleCode: string | null = null;
  try {
    const all = await getProductRepository().list();
    sampleCode = all[0]?.code ?? null;
  } catch {
    sampleCode = null;
  }

  return (
    <TemplateLibrary
      initial={templates}
      activeId={settings.label.templateId}
      sampleCode={sampleCode}
    />
  );
}
