import type { WarehouseCreateInput } from '../mutations/warehouse.js';
import type { SeederSection } from './types.js';

export const warehouses: SeederSection<WarehouseCreateInput> = {
  enabled: true,
  data: [
    {
      name: 'Main Warehouse',
      slug: 'default-warehouse',
      address: {
        streetAddress1: '125 Main Street',
        city: 'New York',
        country: 'US',
        countryArea: 'NY',
        postalCode: '10001',
      },
    },
  ],
};
