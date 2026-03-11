import { gql } from '@apollo/client/core';

export const PAGE_CREATE = gql`
  mutation PageCreate($input: PageCreateInput!) {
    pageCreate(input: $input) {
      page {
        id
        title
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

export const PAGE_UPDATE = gql`
  mutation PageUpdate($id: ID!, $input: PageInput!) {
    pageUpdate(id: $id, input: $input) {
      page {
        id
        title
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

export interface PageInput {
  title?: string;
  slug?: string;
  content?: unknown;
  isPublished?: boolean;
  publishedAt?: string;
  seo?: { title?: string; description?: string };
  attributes?: { id: string; values?: string[]; richText?: string; boolean?: boolean }[];
}

export interface PageCreateInput extends PageInput {
  /** Page type ID (required on create) */
  pageType: string;
}

export interface PageCreateResult {
  pageCreate: {
    page: { id: string; title: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface PageUpdateResult {
  pageUpdate: {
    page: { id: string; title: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
