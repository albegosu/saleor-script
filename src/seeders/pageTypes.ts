import { apollo } from '../apollo/apollo-client.js';
import { PAGE_TYPE_CREATE, PAGE_TYPE_ATTRIBUTE_ASSIGN } from '../mutations/pageType.js';
import type {
  PageTypeCreateResult,
  PageTypeAttributeAssignResult,
} from '../mutations/pageType.js';
import type { SeederSection, PageTypeConfig } from '../config/index.js';
import { config } from '../config/index.js';
import { fetchAttributeIdsBySlug } from '../queries/attributes.js';
import { ensureMissingAttributesForSlugs } from './attributes.js';
import {
  fetchAssignedAttributeSlugsForPageType,
  fetchPageTypeIdsBySlug,
} from '../queries/pageTypes.js';
import {
  logSuccess,
  logError,
  logSkip,
  executeMutation,
  slugify,
  type SeedContext,
} from './utils.js';

function isOnlyAttributeAlreadyAssigned(
  errors: { code?: string | null; message: string }[],
): boolean {
  return (
    errors.length > 0 &&
    errors.every((e) => e.code === 'ATTRIBUTE_ALREADY_ASSIGNED')
  );
}

/**
 * Assigns configured attributes to a page type, skipping slugs already linked
 * and treating "already assigned" API errors as a no-op.
 */
async function assignPageTypeAttributesIfNeeded(
  pageTypeId: string,
  displayName: string,
  attributeSlugs: string[],
  ctx: SeedContext,
): Promise<void> {
  if (attributeSlugs.length === 0) return;

  const assignedSlugs = await fetchAssignedAttributeSlugsForPageType(pageTypeId);
  const slugsToLink = attributeSlugs.filter((slug) => !assignedSlugs.has(slug));

  if (slugsToLink.length === 0) {
    if (assignedSlugs.size > 0) {
      console.log(
        `    ↳ "${displayName}": atributos ya asignados al tipo de página; omitiendo.`,
      );
    }
    return;
  }

  const attributeIds = slugsToLink
    .map((attrSlug) => {
      const id = ctx.attributeIds[attrSlug];
      if (!id) {
        logSkip(
          'PageTypeAttrAssign',
          attrSlug,
          'no existe en la API (ejecuta el seed de atributos antes o crea el atributo en el dashboard)',
        );
        return null;
      }
      return id;
    })
    .filter((id): id is string => id !== null);

  if (attributeIds.length === 0) return;

  // Assign one attribute per mutation: some Saleor versions reject or partially apply
  // batched assigns when mixing types; per-ID calls are idempotent and easier to debug.
  let assignedCount = 0;
  for (const attributeId of attributeIds) {
    const { data: assignData, hasError: assignHasError } =
      await executeMutation<PageTypeAttributeAssignResult>(
        () =>
          apollo.mutate({
            mutation: PAGE_TYPE_ATTRIBUTE_ASSIGN,
            variables: { pageTypeId, attributeIds: [attributeId] },
            errorPolicy: 'all',
          }),
        'PageTypeAttrAssign',
        displayName,
      );

    if (assignHasError) continue;

    const assignErrors = assignData?.pageAttributeAssign?.errors ?? [];
    if (assignErrors.length > 0) {
      if (!isOnlyAttributeAlreadyAssigned(assignErrors)) {
        logError('PageTypeAttrAssign', displayName, assignErrors);
      }
    } else {
      assignedCount += 1;
    }
  }

  if (assignedCount > 0) {
    console.log(`    ↳ enlazados ${assignedCount}/${attributeIds.length} atributo(s) (${displayName})`);
  }
}

export async function seedPageTypes(
  section: SeederSection<PageTypeConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Tipos de página]');

  // Resolve attribute IDs from the API when the context is empty (e.g. after
  // standalone `seed:attributes` from an export, before `seed -- --only=pageTypes`).
  const attributeIdsFromApi = await fetchAttributeIdsBySlug();
  for (const [slug, id] of Object.entries(attributeIdsFromApi)) {
    if (!ctx.attributeIds[slug]) {
      ctx.attributeIds[slug] = id;
    }
  }

  const allPageTypeAttributeSlugs = new Set<string>();
  for (const typeConfig of section.data) {
    typeConfig.attributeSlugs?.forEach((slug) => allPageTypeAttributeSlugs.add(slug));
  }
  await ensureMissingAttributesForSlugs(
    config.attributes,
    [...allPageTypeAttributeSlugs],
    ctx,
  );

  const attributeIdsRefreshed = await fetchAttributeIdsBySlug();
  for (const [slug, id] of Object.entries(attributeIdsRefreshed)) {
    ctx.attributeIds[slug] = id;
  }

  // Pre-load existing page types so we can reuse them instead of failing on UNIQUE
  // and still populate ctx.pageTypeIds for later seeders (pages).
  if (Object.keys(ctx.pageTypeIds).length === 0) {
    ctx.pageTypeIds = await fetchPageTypeIdsBySlug();
  }

  for (const typeConfig of section.data) {
    const { attributeSlugs, ...input } = typeConfig;
    const slug = input.slug ?? slugify(input.name);

    // If a page type with this slug already exists, reuse it and only try attribute assignment.
    const existingId = ctx.pageTypeIds[slug];
    if (existingId) {
      const pageTypeId = existingId;

      if (attributeSlugs && attributeSlugs.length > 0) {
        await assignPageTypeAttributesIfNeeded(pageTypeId, input.name, attributeSlugs, ctx);
      }

      continue;
    }

    const { data, hasError } = await executeMutation<PageTypeCreateResult>(
      () =>
        apollo.mutate({
          mutation: PAGE_TYPE_CREATE,
          variables: { input: { ...input, slug } },
          errorPolicy: 'all',
        }),
      'PageType',
      input.name,
    );

    if (hasError) continue;

    const result = data?.pageTypeCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('PageType', input.name, errors);
      continue;
    }

    const pageType = result?.pageType;
    if (!pageType) continue;

    ctx.pageTypeIds[pageType.slug] = pageType.id;
    logSuccess('PageType', pageType.name, pageType.id);

    if (attributeSlugs && attributeSlugs.length > 0) {
      await assignPageTypeAttributesIfNeeded(pageType.id, pageType.name, attributeSlugs, ctx);
    }
  }
}
