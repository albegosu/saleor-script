import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const PRODUCT_TYPES_LIST = gql`
  query ProductTypesList($first: Int!, $after: String) {
    productTypes(first: $first, after: $after) {
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

interface ProductTypesListResult {
  productTypes: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: { id: string; slug: string; name: string } }[];
  };
}

/**
 * Fetches all product types and returns a map slug → id.
 */
export async function fetchProductTypeIdsBySlug(): Promise<Record<string, string>> {
  const slugToId: Record<string, string> = {};
  let after: string | null = null;
  const first = 100;

  for (;;) {
    const result: { data?: { productTypes: ProductTypesListResult['productTypes'] } } =
      await apollo.query<{ productTypes: ProductTypesListResult['productTypes'] }>({
      query: PRODUCT_TYPES_LIST,
      variables: { first, after },
    });

    const connection: ProductTypesListResult['productTypes'] | undefined =
      result.data?.productTypes;
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

