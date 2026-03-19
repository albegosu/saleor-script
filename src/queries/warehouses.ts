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

const DEFAULT_WAREHOUSE_NAME = 'Default Warehouse';
const PREFERRED_WAREHOUSE_SLUGS = ['default-warehouse', 'default'] as const;

/**
 * Resolves the warehouse ID to link to the test channel.
 * Prefers slugs from the current seed context, then API slugs default-warehouse / default,
 * then a warehouse whose name is exactly "Default Warehouse" (Saleor default).
 *
 * @param seededBySlug - warehouse slug → id from the warehouses seeder
 * @returns The warehouse global ID, or null if none match
 */
export async function resolveDefaultWarehouseId(
  seededBySlug: Record<string, string>,
): Promise<string | null> {
  for (const slug of PREFERRED_WAREHOUSE_SLUGS) {
    const id = seededBySlug[slug];
    if (id) return id;
  }

  let after: string | null = null;
  const first = 100;
  const slugToId: Record<string, string> = {};
  let idByDefaultName: string | null = null;

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
      if (node.name === DEFAULT_WAREHOUSE_NAME) {
        idByDefaultName = node.id;
      }
    }

    if (!connection.pageInfo.hasNextPage) break;
    after = connection.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  for (const slug of PREFERRED_WAREHOUSE_SLUGS) {
    const id = slugToId[slug];
    if (id) return id;
  }

  return idByDefaultName;
}

