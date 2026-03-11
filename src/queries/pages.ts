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

/**
 * Fetches all pages and returns a map slug → { id, title, pageTypeSlug }.
 */
export async function fetchPagesBySlug(): Promise<
  Record<string, { id: string; title: string; pageTypeSlug: string | null }>
> {
  const slugToPage: Record<
    string,
    { id: string; title: string; pageTypeSlug: string | null }
  > = {};

  let after: string | null = null;
  const first = 100;

  for (;;) {
    const queryResult: { data?: PagesListPayload } =
      await apollo.query<PagesListPayload>({
        query: PAGES_LIST,
        variables: { first, after },
      });

    const pagesConn: PagesListPayload['pages'] | undefined =
      queryResult.data?.pages;
    if (!pagesConn) break;

    for (const { node } of pagesConn.edges) {
      slugToPage[node.slug] = {
        id: node.id,
        title: node.title,
        pageTypeSlug: node.pageType?.slug ?? null,
      };
    }

    if (!pagesConn.pageInfo.hasNextPage) break;
    after = pagesConn.pageInfo.endCursor ?? null;
    if (!after) break;
  }

  return slugToPage;
}

