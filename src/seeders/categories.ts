import { apollo } from '../apollo/apollo-client.js';
import { CATEGORY_CREATE } from '../mutations/category.js';
import type { CategoryCreateResult, CategoryInput } from '../mutations/category.js';
import type { SeederSection, CategoryConfig } from '../config/index.js';
import { logSuccess, logError, executeMutation, slugify, type SeedContext } from './utils.js';

async function createCategory(
  input: CategoryInput,
  ctx: SeedContext,
  parentId?: string,
): Promise<string | null> {
  const slug = input.slug ?? slugify(input.name);

  const { data, hasError } = await executeMutation<CategoryCreateResult>(
    () =>
      apollo.mutate({
        mutation: CATEGORY_CREATE,
        variables: { input: { ...input, slug }, parent: parentId ?? null },
        errorPolicy: 'all',
      }),
    'Category',
    input.name,
  );

  if (hasError) return null;

  const result = data?.categoryCreate;
  const errors = result?.errors ?? [];

  if (errors.length > 0) {
    logError('Category', input.name, errors);
    return null;
  }

  const category = result?.category;
  if (!category) return null;

  ctx.categoryIds[category.slug] = category.id;
  const indent = parentId ? '    ↳' : '  ✔';
  console.log(`${indent} Category: "${category.name}" (${category.id})`);
  return category.id;
}

async function seedCategoryTree(
  nodes: CategoryConfig[],
  ctx: SeedContext,
  parentId?: string,
): Promise<void> {
  for (const node of nodes) {
    const { children, ...input } = node;
    const id = await createCategory(input, ctx, parentId);
    if (id && children && children.length > 0) {
      await seedCategoryTree(children, ctx, id);
    }
  }
}

export async function seedCategories(
  section: SeederSection<CategoryConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Categories]');
  await seedCategoryTree(section.data, ctx);
}
