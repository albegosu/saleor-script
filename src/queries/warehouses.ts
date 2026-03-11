import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const WAREHOUSES_LIST = gql`
  query WarehousesList($first: Int!, $after: String) {
    warehouses(first: $first, after: $after) {
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

interface WarehousesListResult {
  warehouses: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: { id: string; slug: string; name: string } }[];
  };
}

/**
 * Fetches all warehouses and returns a map slug → id.
 */
export async function fetchWarehouseIdsBySlug(): Promise<Record<string, string>> {
  const slugToId: Record<string, string> = {};
  let after: string | null = null;
  const first = 100;

  for (;;) {
    const result: { data?: { warehouses: WarehousesListResult['warehouses'] } } =
      await apollo.query<{ warehouses: WarehousesListResult['warehouses'] }>({
      query: WAREHOUSES_LIST,
      variables: { first, after },
    });

    const connection: WarehousesListResult['warehouses'] | undefined = result.data?.warehouses;
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

