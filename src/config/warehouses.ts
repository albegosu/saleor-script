import type { WarehouseCreateInput } from '../mutations/warehouse.js';
import type { SeederSection } from './types.js';

export const warehouses: SeederSection<WarehouseCreateInput> = {
  enabled: false,
  data: [
    {
      name: 'Main Warehouse',
      slug: 'main-warehouse',
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
