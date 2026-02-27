import { gql } from '@apollo/client/core';

export const ATTRIBUTE_CREATE = gql`
  mutation AttributeCreate($input: AttributeCreateInput!) {
    attributeCreate(input: $input) {
      attribute {
        id
        name
        slug
        inputType
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export type AttributeInputType =
  | 'DROPDOWN'
  | 'MULTISELECT'
  | 'FILE'
  | 'REFERENCE'
  | 'NUMERIC'
  | 'RICH_TEXT'
  | 'PLAIN_TEXT'
  | 'SWATCH'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATE_TIME';

export type AttributeEntityType = 'PAGE' | 'PRODUCT' | 'PRODUCT_VARIANT';

/** Required: tells Saleor whether the attribute belongs to products or pages */
export type AttributeType = 'PRODUCT_TYPE' | 'PAGE_TYPE';

export interface AttributeValueCreateInput {
  name: string;
  value?: string;
  externalReference?: string;
}

export interface AttributeCreateInput {
  name: string;
  /** Required by Saleor — PRODUCT_TYPE for product attributes, PAGE_TYPE for page attributes */
  type: AttributeType;
  slug?: string;
  inputType?: AttributeInputType;
  entityType?: AttributeEntityType;
  /** Pre-populate allowed values (for DROPDOWN / MULTISELECT / SWATCH) */
  values?: AttributeValueCreateInput[];
  valueRequired?: boolean;
  visibleInStorefront?: boolean;
  filterableInStorefront?: boolean;
  filterableInDashboard?: boolean;
  availableInGrid?: boolean;
  storefrontSearchPosition?: number;
}

export interface AttributeCreateResult {
  attributeCreate: {
    attribute: { id: string; name: string; slug: string; inputType: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
