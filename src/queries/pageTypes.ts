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

/** Some Saleor / proxy setups return HTTP 400 for `pageType { attributes }`; `node` often works. */
const PAGE_TYPE_ASSIGNED_VIA_NODE = gql`
  query PageTypeAssignedViaNode($id: ID!) {
    node(id: $id) {
      __typename
      ... on PageType {
        attributes {
          attribute {
            slug
          }
        }
      }
    }
  }
`;

const PAGE_TYPE_ASSIGNED_ATTRIBUTE_SLUGS = gql`
  query PageTypeAssignedAttributeSlugs($id: ID!) {
    pageType(id: $id) {
      attributes {
        attribute {
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

interface PageTypeAssignedSlugsPayload {
  pageType: {
    attributes: { attribute: { slug: string } }[];
  } | null;
}

interface PageTypeNodeAssignedPayload {
  node:
    | {
        __typename: string;
        attributes?: { attribute: { slug: string } }[];
      }
    | null;
}

function slugsFromPageTypeAttributes(
  rows: { attribute: { slug: string } }[] | undefined,
): Set<string> {
  const slugs = new Set<string>();
  rows?.forEach(({ attribute }) => {
    slugs.add(attribute.slug);
  });
  return slugs;
}

/**
 * Returns attribute slugs already linked to the given page type (for idempotent assign).
 * On failure returns an empty set so callers still attempt per-attribute assign (idempotent).
 *
 * @param pageTypeId - Global ID of the page type
 */
export async function fetchAssignedAttributeSlugsForPageType(pageTypeId: string): Promise<Set<string>> {
  try {
    const viaNode = await apollo.query<PageTypeNodeAssignedPayload>({
      query: PAGE_TYPE_ASSIGNED_VIA_NODE,
      variables: { id: pageTypeId },
      errorPolicy: 'all',
    });

    if (!viaNode.errors?.length && viaNode.data?.node?.__typename === 'PageType') {
      const attrs = viaNode.data.node.attributes;
      if (attrs) {
        return slugsFromPageTypeAttributes(attrs);
      }
    }
  } catch {
    // fall through to pageType(id)
  }

  try {
    const result = await apollo.query<PageTypeAssignedSlugsPayload>({
      query: PAGE_TYPE_ASSIGNED_ATTRIBUTE_SLUGS,
      variables: { id: pageTypeId },
      errorPolicy: 'all',
    });

    if (result.errors?.length) {
      return new Set();
    }

    return slugsFromPageTypeAttributes(result.data?.pageType?.attributes);
  } catch {
    return new Set();
  }
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
    let queryResult: { data?: PageTypesListPayload; errors?: readonly { message: string }[] };
    try {
      queryResult = await apollo.query<PageTypesListPayload>({
        query: PAGE_TYPES_LIST,
        variables: { first, after },
        errorPolicy: 'all',
      });
    } catch (err) {
      if (after === null) {
        throw err;
      }
      console.warn(
        `  ⚠ pageTypes: fallo al paginar (cursor tras la primera página). ` +
          `Se usan ${Object.keys(slugToId).length} tipo(s). ${err instanceof Error ? err.message : String(err)}`,
      );
      break;
    }

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

