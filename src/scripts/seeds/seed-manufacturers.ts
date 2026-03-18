import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

import { slugify, executeMutation, logError, logSuccess } from '../../seeders/utils.js';
import { initAuth } from '../../apollo/apollo-client.js';
import { fetchAttributeIdsBySlug } from '../../queries/attributes.js';
import { fetchPagesBySlug } from '../../queries/pages.js';
import { fetchPageTypeIdsBySlug } from '../../queries/pageTypes.js';
import {
  PAGE_CREATE,
  PAGE_UPDATE,
  type PageCreateResult,
  type PageUpdateResult,
} from '../../mutations/page.js';
import { apollo } from '../../apollo/apollo-client.js';
import { manufacturerPages as existingManufacturerPages } from '../../config/manufacturers.js';
import { gql } from '@apollo/client/core';

function toTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const withoutLogo = base.endsWith('-logo') ? base.slice(0, -'-logo'.length) : base;
  const parts = withoutLogo.split(/[-_]+/g).filter((p) => p.length > 0);

  if (parts.length === 0) {
    return withoutLogo || base;
  }

  return parts
    .map((part) => {
      if (part.length === 1) return part.toUpperCase();
      return part[0].toUpperCase() + part.slice(1);
    })
    .join(' ');
}

async function loadManufacturerFiles(): Promise<string[]> {
  const dir = path.resolve(process.cwd(), 'public', 'manufacturers');
  const entries = await fs.readdir(dir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(png|jpg|jpeg|webp|gif)$/i.test(name));
}

async function buildManufacturerPagesSource(): Promise<string> {
  const files = await loadManufacturerFiles();

  if (files.length === 0) {
    console.log('  ⚠ No se encontraron ficheros en public/manufacturers.');
  }

  const items = files.map((file) => {
    const title = toTitleFromFilename(file);
    const slug = slugify(title);
    return { title, slug };
  });

  const itemsSource = items
    .map(
      (item) =>
        `  {\n` +
        `    title: '${item.title}',\n` +
        `    slug: '${item.slug}',\n` +
        `    pageTypeSlug: 'fabricantes',\n` +
        `    isPublished: true,\n` +
        `  },`,
    )
    .join('\n');

  return `import type { PageConfig } from './pages.js';

/**
 * Manufacturer pages to seed.
 * Auto-generated from files in public/manufacturers by
 * src/scripts/seeds/seed-manufacturers.ts
 */
export const manufacturerPages: PageConfig[] = [
${itemsSource}
];
`;
}

async function main(): Promise<void> {
  if (!process.env.SALEOR_API_URL) {
    console.error(
      'Error: SALEOR_API_URL no está definida. Copia .env.example a .env y rellena los valores.',
    );
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Seed de páginas y atributos de fabricantes       ║');
  console.log('╚════════════════════════════════════════════════════╝');

  console.log('\n[Construir manufacturerPages a partir de imágenes]');
  const source = await buildManufacturerPagesSource();

  const targetPath = path.resolve(
    process.cwd(),
    'src',
    'config',
    'manufacturers.ts',
  );

  await fs.writeFile(targetPath, source, 'utf8');

  console.log(`  ✔ Archivo src/config/manufacturers.ts actualizado.`);

  console.log('\n[Autenticación]');
  await initAuth();

  console.log('\n[Cargar atributos existentes]');
  const attributeIds = await fetchAttributeIdsBySlug();

  const marcaId = attributeIds['marca'];
  const activoId = attributeIds['activo'];
  const mostrarId =
    attributeIds['mostrar-en-la-home-y-pagina-de-fabricantes'];
  const logoId = attributeIds['logo'];

  if (!marcaId || !activoId || !mostrarId) {
    console.error(
      'Error: faltan atributos requeridos (marca, activo, mostrar-en-la-home-y-pagina-de-fabricantes) en la API.',
    );
    process.exit(1);
  }

  console.log('\n[Cargar páginas existentes]');
  const pagesBySlug = await fetchPagesBySlug();

  console.log('\n[Cargar tipos de página existentes]');
  const pageTypeIds = await fetchPageTypeIdsBySlug();
  const fabricantesPageTypeId = pageTypeIds['fabricantes'];

  if (!fabricantesPageTypeId) {
    console.error(
      'Error: no se encontró el tipo de página con slug "fabricantes" en la API.',
    );
    process.exit(1);
  }

  const PAGE_TYPE_ATTRIBUTES = gql`
    query FabricantesPageTypeAttributes($id: ID!) {
      pageType(id: $id) {
        attributes {
          attribute {
            slug
            inputType
            valueRequired
          }
        }
      }
    }
  `;

  type PageTypeAttributeInputType =
    | 'DROPDOWN'
    | 'MULTISELECT'
    | 'FILE'
    | 'REFERENCE'
    | 'NUMERIC'
    | 'RICH_TEXT'
    | 'PLAIN_TEXT'
    | 'SWATCH'
    | 'BOOLEAN'
    | 'DATE'
    | 'DATE_TIME';

  interface FabricantesPageTypeAttributesPayload {
    pageType: {
      attributes: {
        attribute: {
          slug: string;
          inputType: PageTypeAttributeInputType;
          valueRequired: boolean;
        };
      }[];
    } | null;
  }

  const requiredPageAttributesBySlug = new Map<
    string,
    { slug: string; inputType: PageTypeAttributeInputType }
  >();

  try {
    const fabricantesPageTypeResult = await apollo.query<FabricantesPageTypeAttributesPayload>({
      query: PAGE_TYPE_ATTRIBUTES,
      variables: { id: fabricantesPageTypeId },
    });

    fabricantesPageTypeResult.data.pageType?.attributes.forEach(({ attribute }) => {
      if (attribute.valueRequired) {
        requiredPageAttributesBySlug.set(attribute.slug, {
          slug: attribute.slug,
          inputType: attribute.inputType,
        });
      }
    });
  } catch (err) {
    console.warn(
      '  ⚠ No se han podido cargar los atributos REQUIRED del tipo de página "fabricantes". ' +
        'Se continuará usando solo los atributos configurados en el script (marca, activo, mostrar, logo).',
    );
  }

  console.log('\n[Crear/actualizar páginas de fabricantes]');
  for (const pageConfig of existingManufacturerPages) {
    const slug = pageConfig.slug;
    const existingPage = pagesBySlug[slug];

    const attributes: {
      id: string;
      values?: string[];
      richText?: string;
      boolean?: boolean;
    }[] = [];

    attributes.push({
      id: marcaId,
      values: [pageConfig.title],
    });

    attributes.push({
      id: activoId,
      values: ['true'],
    });

    attributes.push({
      id: mostrarId,
      values: ['true'],
    });

    if (logoId) {
      const logoRelative = `manufacturers/${slug}-logo.png`;
      const absLogo = path.resolve(process.cwd(), 'public', logoRelative);
      try {
        await fs.access(absLogo);
        attributes.push({
          id: logoId,
          values: [`/${logoRelative}`],
        });
      } catch {
        console.log(
          `  ⚠ Logo: no se encontró fichero para "${pageConfig.title}" en public/${logoRelative}`,
        );
      }
    }

    // Asegurar que todos los atributos REQUIRED del page type "fabricantes" tienen algún valor.
    for (const [slug, meta] of requiredPageAttributesBySlug.entries()) {
      const attributeId = attributeIds[slug];
      if (!attributeId) continue;
      const alreadyProvided = attributes.some((attr) => attr.id === attributeId);
      if (alreadyProvided) continue;

      if (meta.inputType === 'BOOLEAN') {
        attributes.push({
          id: attributeId,
          boolean: true,
        });
      } else if (meta.inputType === 'RICH_TEXT') {
        attributes.push({
          id: attributeId,
          richText: JSON.stringify({
            time: Date.now(),
            blocks: [
              {
                type: 'paragraph',
                data: {
                  text: pageConfig.title,
                },
              },
            ],
            version: '2.30.7',
          }),
        });
      } else if (meta.inputType === 'PLAIN_TEXT' || meta.inputType === 'NUMERIC') {
        attributes.push({
          id: attributeId,
          values: [pageConfig.title],
        });
      } else if (meta.inputType === 'FILE') {
        attributes.push({
          id: attributeId,
          values: [`/manufacturers/${slug}-logo.png`],
        });
      }
    }

    if (existingPage) {
      const { data, hasError } = await executeMutation<PageUpdateResult>(
        () =>
          apollo.mutate({
            mutation: PAGE_UPDATE,
            variables: {
              id: existingPage.id,
              input: {
                attributes,
              },
            },
            errorPolicy: 'all',
          }),
        'PageUpdate',
        pageConfig.title,
      );

      if (hasError) continue;

      const result = data?.pageUpdate;
      const errors = result?.errors ?? [];

      if (errors.length > 0) {
        logError('PageUpdate', pageConfig.title, errors);
        continue;
      }

      if (result?.page) {
        logSuccess('PageUpdate', result.page.title, result.page.id);
      }
    } else {
      const createResult = await executeMutation<PageCreateResult>(
        () =>
          apollo.mutate({
            mutation: PAGE_CREATE,
            variables: {
              input: {
                title: pageConfig.title,
                slug,
                pageType: fabricantesPageTypeId,
                isPublished: true,
              },
            },
            errorPolicy: 'all',
          }),
        'PageCreate',
        pageConfig.title,
      );

      if (createResult.hasError) continue;

      const created = createResult.data?.pageCreate;
      const createErrors = created?.errors ?? [];

      if (createErrors.length > 0 || !created?.page) {
        logError('PageCreate', pageConfig.title, createErrors);
        continue;
      }

      logSuccess('PageCreate', created.page.title, created.page.id);

      const { data, hasError } = await executeMutation<PageUpdateResult>(
        () =>
          apollo.mutate({
            mutation: PAGE_UPDATE,
            variables: {
              id: created.page.id,
              input: {
                attributes,
              },
            },
            errorPolicy: 'all',
          }),
        'PageUpdate',
        pageConfig.title,
      );

      if (hasError) continue;

      const result = data?.pageUpdate;
      const errors = result?.errors ?? [];

      if (errors.length > 0) {
        logError('PageUpdate', pageConfig.title, errors);
        continue;
      }

      if (result?.page) {
        logSuccess('PageUpdate', result.page.title, result.page.id);
      }
    }
  }

  console.log('\n✔ Seed de fabricantes completado.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\nError fatal: ${message}`);
  process.exit(1);
});

