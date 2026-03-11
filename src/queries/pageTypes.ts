import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const PAGE_TYPES_LIST = gql`
  query PageTypesList($first: Int!, $after: String) {
    pageTypes(first: $first, after: $after) {
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

interface PageTypesListPayload {
  pageTypes: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: { id: string; slug: string } }[];
  };
}

/**
 * Fetches all page types from the API and returns a map slug → id.
 * Used by the pageTypes seeder so it can reuse existing page types
 * and still populate the SeedContext with their IDs.
 */
export async function fetchPageTypeIdsBySlug(): Promise<Record<string, string>> {
  const slugToId: Record<string, string> = {};
  let after: string | null = null;
  const first = 100;

  for (;;) {
    const queryResult: { data?: PageTypesListPayload } =
      await apollo.query<PageTypesListPayload>({
        query: PAGE_TYPES_LIST,
        variables: { first, after },
      });

    const pageTypesPage: PageTypesListPayload['pageTypes'] | undefined =
      queryResult.data?.pageTypes;
    if (!pageTypesPage) break;

    for (const { node } of pageTypesPage.edges) {
      slugToId[node.slug] = node.id;
    }

    if (!pageTypesPage.pageInfo.hasNextPage) break;
    after = pageTypesPage.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  return slugToId;
}

