import { gql } from '@apollo/client/core';

export const TAX_CLASS_CREATE = gql`
  mutation TaxClassCreate($input: TaxClassCreateInput!) {
    taxClassCreate(input: $input) {
      taxClass {
        id
        name
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export interface TaxClassCreateInput {
  name: string;
  /** Country-specific tax rates e.g. [{ countryCode: "US", rate: 7 }] */
  createCountryRates?: { countryCode: string; rate: number }[];
}

export interface TaxClassCreateResult {
  taxClassCreate: {
    taxClass: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
