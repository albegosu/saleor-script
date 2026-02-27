import { apollo } from '../apollo/apollo-client.js';
import { ATTRIBUTE_CREATE } from '../mutations/attribute.js';
import type { AttributeCreateInput, AttributeCreateResult } from '../mutations/attribute.js';
import type { SeederSection } from '../config/defaults.js';
import { logSuccess, logError, executeMutation, type SeedContext } from './utils.js';

export async function seedAttributes(
  section: SeederSection<AttributeCreateInput>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Attributes]');

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
