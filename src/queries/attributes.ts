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

interface AttributesListPayload {
  attributes: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: { id: string; slug: string } }[];
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
    const queryResult: { data?: AttributesListPayload } = await apollo.query<AttributesListPayload>({
      query: ATTRIBUTES_LIST,
      variables: { first, after },
    });

    const attributesPage: AttributesListPayload['attributes'] | undefined =
      queryResult.data?.attributes;
    if (!attributesPage) break;

    for (const { node } of attributesPage.edges) {
      slugToId[node.slug] = node.id;
    }

    if (!attributesPage.pageInfo.hasNextPage) break;
    after = attributesPage.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  return slugToId;
}
