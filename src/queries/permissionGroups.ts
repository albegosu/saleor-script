import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const PERMISSION_GROUPS_LIST = gql`
  query PermissionGroupsList($first: Int!, $after: String, $search: String!) {
    permissionGroups(first: $first, after: $after, filter: { search: $search }) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

interface PermissionGroupsListPayload {
  permissionGroups: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: { id: string; name: string } }[];
  };
}

export interface PermissionGroupListItem {
  id: string;
  name: string;
}

/**
 * Fetches permission groups by a Saleor `filter.search` string and returns matching
 * items as `{ name -> id }`.
 */
export async function fetchPermissionGroupsBySearch(
  search: string,
): Promise<Record<string, string>> {
  const nameToId: Record<string, string> = {};

  let after: string | null = null;
  const first = 100;

  for (;;) {
    const queryResult: { data?: PermissionGroupsListPayload } = await apollo.query<
      PermissionGroupsListPayload
    >({
      query: PERMISSION_GROUPS_LIST,
      variables: { first, after, search },
    });

    const groupsConn: PermissionGroupsListPayload['permissionGroups'] | undefined =
      queryResult.data?.permissionGroups;
    if (!groupsConn) break;

    for (const { node } of groupsConn.edges) {
      nameToId[node.name] = node.id;
    }

    if (!groupsConn.pageInfo.hasNextPage) break;
    after = groupsConn.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  return nameToId;
}

