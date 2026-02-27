import { apollo } from '../apollo/apollo-client.js';
import { TAX_CLASS_CREATE } from '../mutations/taxClass.js';
import type { TaxClassCreateInput, TaxClassCreateResult } from '../mutations/taxClass.js';
import type { SeederSection } from '../config/index.js';
import { logSuccess, logError, executeMutation, type SeedContext } from './utils.js';

export async function seedTaxClasses(
  section: SeederSection<TaxClassCreateInput>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Tax Classes]');

  for (const input of section.data) {
    const { data, hasError } = await executeMutation<TaxClassCreateResult>(
      () => apollo.mutate({ mutation: TAX_CLASS_CREATE, variables: { input }, errorPolicy: 'all' }),
      'TaxClass',
      input.name,
    );

    if (hasError) continue;

    const result = data?.taxClassCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('TaxClass', input.name, errors);
      continue;
    }

    if (result?.taxClass) {
      ctx.taxClassIds[input.name] = result.taxClass.id;
      logSuccess('TaxClass', result.taxClass.name, result.taxClass.id);
    }
  }
}
