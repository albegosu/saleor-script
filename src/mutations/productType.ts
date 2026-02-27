import { gql } from '@apollo/client/core';

export const PRODUCT_TYPE_CREATE = gql`
  mutation ProductTypeCreate($input: ProductTypeInput!) {
    productTypeCreate(input: $input) {
      productType {
        id
        name
        slug
        hasVariants
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const PRODUCT_TYPE_ATTRIBUTE_ASSIGN = gql`
  mutation ProductTypeAttributeAssign($productTypeId: ID!, $operations: [ProductAttributeAssignInput!]!) {
    productAttributeAssign(productTypeId: $productTypeId, operations: $operations) {
      productType {
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

export type ProductTypeKind = 'NORMAL' | 'GIFT_CARD';
export type AttributeType = 'PRODUCT' | 'VARIANT';

export interface ProductTypeInput {
  name: string;
  slug?: string;
  kind?: ProductTypeKind;
  hasVariants?: boolean;
  isShippingRequired?: boolean;
  isDigital?: boolean;
  weight?: { value: number; unit: string };
  taxClass?: string;
}

export interface ProductAttributeAssignInput {
  id: string;
  type: AttributeType;
}

export interface ProductTypeCreateResult {
  productTypeCreate: {
    productType: { id: string; name: string; slug: string; hasVariants: boolean } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface ProductTypeAttributeAssignResult {
  productAttributeAssign: {
    productType: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
