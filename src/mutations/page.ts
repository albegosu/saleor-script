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

export interface PageCreateInput {
  title: string;
  slug?: string;
  /** Page type ID (required) */
  pageType: string;
  content?: unknown;
  isPublished?: boolean;
  publishedAt?: string;
  seo?: { title?: string; description?: string };
  attributes?: { id: string; values?: string[]; richText?: string; boolean?: boolean }[];
}

export interface PageCreateResult {
  pageCreate: {
    page: { id: string; title: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
