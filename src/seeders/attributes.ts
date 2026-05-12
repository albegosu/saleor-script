import { apollo } from '../apollo/apollo-client.js';
import { ATTRIBUTE_CREATE } from '../mutations/attribute.js';
import type { AttributeCreateInput, AttributeCreateResult } from '../mutations/attribute.js';
import type { SeederSection } from '../config/index.js';
import { fetchAttributeIdsBySlug } from '../queries/attributes.js';
import { logSuccess, logError, executeMutation, type SeedContext } from './utils.js';

/**
 * Loads all attribute IDs from the API into {@link SeedContext.attributeIds}
 * without running ATTRIBUTE_CREATE (for dependency-only runs when attributes
 * were already created, e.g. from an export script).
 *
 * @param ctx - Seed context to populate
 */
export async function hydrateAttributeIdsFromApi(ctx: SeedContext): Promise<void> {
  console.log('\n[Atributos]');
  console.log(
    '  Dependencia automática: IDs cargados desde la API (sin crear desde config; ' +
      'p. ej. ya existen tras seed:attributes desde export).',
  );
  const fromApi = await fetchAttributeIdsBySlug();
  for (const [slug, id] of Object.entries(fromApi)) {
    ctx.attributeIds[slug] = id;
  }
  console.log(`  ✔ ${Object.keys(fromApi).length} atributo(s) referenciados por slug.`);
}

/**
 * Creates attributes from `section.data` when their slug is required but missing from the API
 * (e.g. page type config references `codigo-empresa` while the export JSON only has catalog attributes).
 *
 * @param section - Attribute definitions from config (`config.attributes`)
 * @param slugs - Slugs referenced by page types (or other seeders)
 * @param ctx - Context updated with new IDs and refreshed from the API
 */
export async function ensureMissingAttributesForSlugs(
  section: SeederSection<AttributeCreateInput>,
  slugs: string[],
  ctx: SeedContext,
): Promise<void> {
  if (!section.enabled || slugs.length === 0) return;

  let api = await fetchAttributeIdsBySlug();
  for (const [slug, id] of Object.entries(api)) {
    ctx.attributeIds[slug] = id;
  }

  const needed = new Set(slugs);
  const toCreate = [...needed]
    .filter((slug) => !api[slug])
    .map((slug) => section.data.find((a) => a.slug === slug))
    .filter((input): input is AttributeCreateInput => Boolean(input));

  if (toCreate.length === 0) return;

  console.log(
    `\n[Atributos faltantes para tipos de página] ${toCreate.length} slug(s) en config no estaban en la API; intentando ATTRIBUTE_CREATE…`,
  );

  for (const input of toCreate) {
    const { data, hasError } = await executeMutation<AttributeCreateResult>(
      () =>
        apollo.mutate({
          mutation: ATTRIBUTE_CREATE,
          variables: { input },
          errorPolicy: 'all',
        }),
      'Attribute',
      input.name,
    );

    if (hasError) continue;

    const result = data?.attributeCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      const isUnique = errors.some((e) => e.code === 'UNIQUE');
      if (isUnique) {
        const slug = input.slug;
        if (!slug) continue;
        api = await fetchAttributeIdsBySlug();
        const id = api[slug];
        if (id) ctx.attributeIds[slug] = id;
        continue;
      }
      logError('Attribute', input.name, errors);
      continue;
    }

    if (result?.attribute) {
      ctx.attributeIds[result.attribute.slug] = result.attribute.id;
      api[result.attribute.slug] = result.attribute.id;
      logSuccess('Attribute', result.attribute.name, result.attribute.id);
    }
  }

  api = await fetchAttributeIdsBySlug();
  for (const [slug, id] of Object.entries(api)) {
    ctx.attributeIds[slug] = id;
  }
}

export async function seedAttributes(
  section: SeederSection<AttributeCreateInput>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Atributos]');

  for (const input of section.data) {
    const { data, hasError } = await executeMutation<AttributeCreateResult>(
      () =>
        apollo.mutate({
          mutation: ATTRIBUTE_CREATE,
          variables: { input },
          errorPolicy: 'all',
        }),
      'Attribute',
      input.name,
    );

    if (hasError) continue;

    const result = data?.attributeCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('Attribute', input.name, errors);
      continue;
    }

    if (result?.attribute) {
      ctx.attributeIds[result.attribute.slug] = result.attribute.id;
      logSuccess('Attribute', result.attribute.name, result.attribute.id);
    }
  }
}
