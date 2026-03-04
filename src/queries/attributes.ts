import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const ATTRIBUTES_LIST = gql`
  query AttributesList($first: Int!, $after: String) {
    attributes(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          slug
        }
      }
    }
  }
`;

interface AttributesListResult {
  data?: {
    attributes: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { node: { id: string; slug: string } }[];
    };
  };
}

/**
 * Fetches all attributes from the API and returns a map slug → id.
 * Used when propagating product types so attribute assignments can resolve slugs to IDs.
 */
export async function fetchAttributeIdsBySlug(): Promise<Record<string, string>> {
  const slugToId: Record<string, string> = {};
  let after: string | null = null;
  const first = 100;

  for (;;) {
    const result = await apollo.query<AttributesListResult>({
      query: ATTRIBUTES_LIST,
      variables: { first, after },
    });

    const attributes = result.data?.attributes;
    if (!attributes) break;

    for (const { node } of attributes.edges) {
      slugToId[node.slug] = node.id;
    }

    if (!attributes.pageInfo.hasNextPage) break;
    after = attributes.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  return slugToId;
}
