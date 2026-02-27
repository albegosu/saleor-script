import { gql } from '@apollo/client/core';

export const CATEGORY_CREATE = gql`
  mutation CategoryCreate($input: CategoryInput!, $parent: ID) {
    categoryCreate(input: $input, parent: $parent) {
      category {
        id
        name
        slug
        level
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: unknown;
  seo?: { title?: string; description?: string };
  backgroundImage?: string;
  backgroundImageAlt?: string;
}

export interface CategoryCreateResult {
  categoryCreate: {
    category: { id: string; name: string; slug: string; level: number } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
