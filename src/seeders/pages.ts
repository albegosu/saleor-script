import { apollo } from '../apollo/apollo-client.js';
import { PAGE_CREATE } from '../mutations/page.js';
import type { PageCreateResult } from '../mutations/page.js';
import type { SeederSection, PageConfig } from '../config/index.js';
import { logSuccess, logError, logSkip, executeMutation, slugify, type SeedContext } from './utils.js';

export async function seedPages(
  section: SeederSection<PageConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Pages]');

  for (const pageConfig of section.data) {
    const { pageTypeSlug, ...input } = pageConfig;
    const slug = input.slug ?? slugify(input.title);

    const pageTypeId = ctx.pageTypeIds[pageTypeSlug];
    if (!pageTypeId) {
      logSkip('Page', input.title, `page type slug "${pageTypeSlug}" not found in context`);
      continue;
    }

    const { data, hasError } = await executeMutation<PageCreateResult>(
      () =>
        apollo.mutate({
          mutation: PAGE_CREATE,
          variables: { input: { ...input, slug, pageType: pageTypeId } },
          errorPolicy: 'all',
        }),
      'Page',
      input.title,
    );

    if (hasError) continue;

    const result = data?.pageCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('Page', input.title, errors);
      continue;
    }

    if (result?.page) {
      ctx.pageIds[result.page.slug] = result.page.id;
      logSuccess('Page', result.page.title, result.page.id);
    }
  }
}
