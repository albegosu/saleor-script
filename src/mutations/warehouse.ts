import { gql } from '@apollo/client/core';

export const WAREHOUSE_CREATE = gql`
  mutation WarehouseCreate($input: WarehouseCreateInput!) {
    createWarehouse(input: $input) {
      warehouse {
        id
        name
        slug
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export interface WarehouseAddressInput {
  streetAddress1: string;
  city: string;
  country: string;
  /** ISO 3166-2 subdivision code e.g. "NY" */
  countryArea?: string;
  postalCode?: string;
}

export interface WarehouseCreateInput {
  name: string;
  slug?: string;
  address: WarehouseAddressInput;
  /** List of shipping zone IDs to assign */
  shippingZones?: string[];
}

export interface WarehouseCreateResult {
  createWarehouse: {
    warehouse: { id: string; name: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
