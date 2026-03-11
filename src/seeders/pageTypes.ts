import { apollo } from '../apollo/apollo-client.js';
import { PAGE_TYPE_CREATE, PAGE_TYPE_ATTRIBUTE_ASSIGN } from '../mutations/pageType.js';
import type {
  PageTypeCreateResult,
  PageTypeAttributeAssignResult,
} from '../mutations/pageType.js';
import type { SeederSection, PageTypeConfig } from '../config/index.js';
import { fetchPageTypeIdsBySlug } from '../queries/pageTypes.js';
import {
  logSuccess,
  logError,
  logSkip,
  executeMutation,
  slugify,
  type SeedContext,
} from './utils.js';

export async function seedPageTypes(
  section: SeederSection<PageTypeConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Tipos de página]');

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
        const attributeIds = attributeSlugs
          .map((attrSlug) => {
            const id = ctx.attributeIds[attrSlug];
            if (!id) {
              logSkip('PageTypeAttrAssign', attrSlug, 'attribute not in context');
              return null;
            }
            return id;
          })
          .filter((id): id is string => id !== null);

        if (attributeIds.length > 0) {
          const { data: assignData, hasError: assignHasError } =
            await executeMutation<PageTypeAttributeAssignResult>(
              () =>
                apollo.mutate({
                  mutation: PAGE_TYPE_ATTRIBUTE_ASSIGN,
                  variables: { pageTypeId, attributeIds },
                  errorPolicy: 'all',
                }),
              'PageTypeAttrAssign',
              input.name,
            );

          if (!assignHasError) {
            const assignErrors = assignData?.pageAttributeAssign?.errors ?? [];
            if (assignErrors.length > 0) {
              logError('PageTypeAttrAssign', input.name, assignErrors);
            } else {
              console.log(
                `    ↳ asignados ${attributeIds.length} atributo(s) a tipo de página existente`,
              );
            }
          }
        }
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
      const attributeIds = attributeSlugs
        .map((slug) => {
          const id = ctx.attributeIds[slug];
          if (!id) {
            logSkip('PageTypeAttrAssign', slug, 'attribute not in context');
            return null;
          }
          return id;
        })
        .filter((id): id is string => id !== null);

      if (attributeIds.length > 0) {
        const { data: assignData, hasError: assignHasError } =
          await executeMutation<PageTypeAttributeAssignResult>(
            () =>
              apollo.mutate({
                mutation: PAGE_TYPE_ATTRIBUTE_ASSIGN,
                variables: { pageTypeId: pageType.id, attributeIds },
                errorPolicy: 'all',
              }),
            'PageTypeAttrAssign',
            pageType.name,
          );

        if (!assignHasError) {
          const assignErrors = assignData?.pageAttributeAssign?.errors ?? [];
          if (assignErrors.length > 0) {
            logError('PageTypeAttrAssign', pageType.name, assignErrors);
          } else {
            console.log(`    ↳ asignados ${attributeIds.length} atributo(s)`);
          }
        }
      }
    }
  }
}
