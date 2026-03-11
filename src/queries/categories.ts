import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const CATEGORIES_LIST = gql`
  query CategoriesList($first: Int!, $after: String) {
    categories(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          slug
          name
        }
      }
    }
  }
`;

interface CategoriesListResult {
  categories: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: { id: string; slug: string; name: string } }[];
  };
}

/**
 * Fetches all categories and returns a map slug → id.
 */
export async function fetchCategoryIdsBySlug(): Promise<Record<string, string>> {
  const slugToId: Record<string, string> = {};
  let after: string | null = null;
  const first = 100;

  for (;;) {
    const result: { data?: { categories: CategoriesListResult['categories'] } } =
      await apollo.query<{ categories: CategoriesListResult['categories'] }>({
      query: CATEGORIES_LIST,
      variables: { first, after },
    });

    const connection: CategoriesListResult['categories'] | undefined = result.data?.categories;
    if (!connection) break;

    for (const { node } of connection.edges) {
      slugToId[node.slug] = node.id;
    }

    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  return slugToId;
}

