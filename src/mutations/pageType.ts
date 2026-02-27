import { gql } from '@apollo/client/core';

export const PAGE_TYPE_CREATE = gql`
  mutation PageTypeCreate($input: PageTypeCreateInput!) {
    pageTypeCreate(input: $input) {
      pageType {
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

export const PAGE_TYPE_ATTRIBUTE_ASSIGN = gql`
  mutation PageTypeAttributeAssign($pageTypeId: ID!, $attributeIds: [ID!]!) {
    pageAttributeAssign(pageTypeId: $pageTypeId, attributeIds: $attributeIds) {
      pageType {
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

export interface PageTypeCreateInput {
  name: string;
  slug?: string;
  /** Attribute IDs to assign immediately */
  addAttributes?: string[];
}

export interface PageTypeCreateResult {
  pageTypeCreate: {
    pageType: { id: string; name: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface PageTypeAttributeAssignResult {
  pageAttributeAssign: {
    pageType: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
