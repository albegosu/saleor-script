import { apollo } from '../apollo/apollo-client.js';
import { WAREHOUSE_CREATE } from '../mutations/warehouse.js';
import type { WarehouseCreateInput, WarehouseCreateResult } from '../mutations/warehouse.js';
import type { SeederSection } from '../config/index.js';
import { logSuccess, logError, executeMutation, slugify, type SeedContext } from './utils.js';

export async function seedWarehouses(
  section: SeederSection<WarehouseCreateInput>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Warehouses]');

  for (const input of section.data) {
    const slug = input.slug ?? slugify(input.name);

    const { data, hasError } = await executeMutation<WarehouseCreateResult>(
      () =>
        apollo.mutate({
          mutation: WAREHOUSE_CREATE,
          variables: { input: { ...input, slug } },
          errorPolicy: 'all',
        }),
      'Warehouse',
      input.name,
    );

    if (hasError) continue;

    const result = data?.createWarehouse;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('Warehouse', input.name, errors);
      continue;
    }

    if (result?.warehouse) {
      ctx.warehouseIds[result.warehouse.slug] = result.warehouse.id;
      logSuccess('Warehouse', result.warehouse.name, result.warehouse.id);
    }
  }
}
