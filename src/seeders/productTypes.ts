import { apollo } from '../apollo/apollo-client.js';
import {
  PRODUCT_TYPE_CREATE,
  PRODUCT_TYPE_ATTRIBUTE_ASSIGN,
} from '../mutations/productType.js';
import type {
  ProductTypeCreateResult,
  ProductTypeAttributeAssignResult,
} from '../mutations/productType.js';
import type { SeederSection, ProductTypeConfig } from '../config/defaults.js';
import { logSuccess, logError, logSkip, executeMutation, slugify, type SeedContext } from './utils.js';

export async function seedProductTypes(
  section: SeederSection<ProductTypeConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Product Types]');

  for (const typeConfig of section.data) {
    const { productAttributeSlugs, variantAttributeSlugs, ...input } = typeConfig;
    const slug = input.slug ?? slugify(input.name);

    const { data, hasError } = await executeMutation<ProductTypeCreateResult>(
      () =>
        apollo.mutate({
          mutation: PRODUCT_TYPE_CREATE,
          variables: { input: { ...input, slug } },
          errorPolicy: 'all',
        }),
      'ProductType',
      input.name,
    );

    if (hasError) continue;

    const result = data?.productTypeCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('ProductType', input.name, errors);
      continue;
    }

    const productType = result?.productType;
    if (!productType) continue;

    ctx.productTypeIds[productType.slug] = productType.id;
    logSuccess('ProductType', productType.name, productType.id);

    const operations: { id: string; type: 'PRODUCT' | 'VARIANT' }[] = [];

    for (const attrSlug of productAttributeSlugs ?? []) {
      const attrId = ctx.attributeIds[attrSlug];
      if (!attrId) {
        logSkip('AttributeAssign', attrSlug, 'attribute slug not found in context');
        continue;
      }
      operations.push({ id: attrId, type: 'PRODUCT' });
    }

    for (const attrSlug of variantAttributeSlugs ?? []) {
      const attrId = ctx.attributeIds[attrSlug];
      if (!attrId) {
        logSkip('AttributeAssign', attrSlug, 'attribute slug not found in context');
        continue;
      }
      operations.push({ id: attrId, type: 'VARIANT' });
    }

    if (operations.length > 0) {
      const { data: assignData, hasError: assignHasError } =
        await executeMutation<ProductTypeAttributeAssignResult>(
          () =>
            apollo.mutate({
              mutation: PRODUCT_TYPE_ATTRIBUTE_ASSIGN,
              variables: { productTypeId: productType.id, operations },
              errorPolicy: 'all',
            }),
          'AttributeAssign',
          productType.name,
        );

      if (!assignHasError) {
        const assignErrors = assignData?.productAttributeAssign?.errors ?? [];
        if (assignErrors.length > 0) {
          logError('AttributeAssign', productType.name, assignErrors);
        } else {
          console.log(`    ↳ assigned ${operations.length} attribute(s)`);
        }
      }
    }
  }
}
