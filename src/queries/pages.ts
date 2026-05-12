import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const PAGES_LIST = gql`
  query PagesList($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          slug
          title
          pageType {
            slug
          }
        }
      }
    }
  }
`;

/** Same as {@link PAGES_LIST} but without nested `pageType` (avoids some API / permission edge cases). */
const PAGES_LIST_MINIMAL = gql`
  query PagesListMinimal($first: Int!, $after: String) {
    pages(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          slug
          title
        }
      }
    }
  }
`;

interface PagesListPayload {
  pages: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: {
      node: {
        id: string;
        slug: string;
        title: string;
        pageType: { slug: string } | null;
      };
    }[];
  };
}

interface PagesListMinimalPayload {
  pages: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: {
      node: {
        id: string;
        slug: string;
        title: string;
      };
    }[];
  };
}

export interface FetchPagesBySlugOptions {
  /** When true, omits nested `pageType` from the query (slug map uses `pageTypeSlug: null`). */
  minimal?: boolean;
}

/**
 * Fetches all pages and returns a map slug → { id, title, pageTypeSlug }.
 *
 * @param options - Pass `minimal: true` when nested `pageType` is not needed (e.g. manufacturer seed)
 * @returns Map keyed by page slug
 */
export async function fetchPagesBySlug(
  options?: FetchPagesBySlugOptions,
): Promise<Record<string, { id: string; title: string; pageTypeSlug: string | null }>> {
  const slugToPage: Record<
    string,
    { id: string; title: string; pageTypeSlug: string | null }
  > = {};

  let after: string | null = null;
  const first = 100;
  const minimal = options?.minimal === true;

  for (;;) {
    let queryResult:
      | { data?: PagesListPayload; errors?: readonly { message: string }[] }
      | { data?: PagesListMinimalPayload; errors?: readonly { message: string }[] };

    try {
      if (minimal) {
        queryResult = await apollo.query<PagesListMinimalPayload>({
          query: PAGES_LIST_MINIMAL,
          variables: { first, after },
          errorPolicy: 'all',
        });
      } else {
        queryResult = await apollo.query<PagesListPayload>({
          query: PAGES_LIST,
          variables: { first, after },
          errorPolicy: 'all',
        });
      }
    } catch (err) {
      if (after === null) {
        throw err;
      }
      console.warn(
        `  ⚠ pages: fallo al paginar (después del primer lote). ` +
          `Se usan ${Object.keys(slugToPage).length} página(s). ${err instanceof Error ? err.message : String(err)}`,
      );
      break;
    }

    const pagesConn:
      | PagesListPayload['pages']
      | PagesListMinimalPayload['pages']
      | undefined = minimal
      ? (queryResult as { data?: PagesListMinimalPayload }).data?.pages
      : (queryResult as { data?: PagesListPayload }).data?.pages;
    if (!pagesConn) break;

    for (const { node } of pagesConn.edges) {
      slugToPage[node.slug] = {
        id: node.id,
        title: node.title,
        pageTypeSlug: minimal ? null : (node as { pageType?: { slug: string } | null }).pageType?.slug ?? null,
      };
    }

    if (!pagesConn.pageInfo.hasNextPage) break;
    after = pagesConn.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  return slugToPage;
}

