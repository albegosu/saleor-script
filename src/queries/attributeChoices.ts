import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const ATTRIBUTE_CHOICES_BY_SLUG = gql`
  query AttributeChoicesBySlug($slugs: [String!], $first: Int!) {
    attributes(first: $first, filter: { slugs: $slugs }) {
      edges {
        node {
          slug
          choices(first: 100) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    }
  }
`;

interface AttributeChoicesBySlugPayload {
  attributes: {
    edges: {
      node: {
        slug: string;
        choices: { edges: { node: { id: string } }[] };
      };
    }[];
  };
}

/**
 * Fetches attribute value IDs (choices) for a set of attribute slugs.
 * Returns a map: attributeSlug → [valueId1, valueId2, ...].
 */
export async function fetchAttributeChoiceIdsBySlug(
  slugs: string[],
): Promise<Record<string, string[]>> {
  if (slugs.length === 0) return {};

  const result: { data?: AttributeChoicesBySlugPayload } =
    await apollo.query<AttributeChoicesBySlugPayload>({
      query: ATTRIBUTE_CHOICES_BY_SLUG,
      variables: { slugs, first: slugs.length },
    });

  const map: Record<string, string[]> = {};
  const connection = result.data?.attributes;
  if (!connection) return map;

  for (const edge of connection.edges) {
    const node = edge.node;
    const valueIds = node.choices.edges.map((e) => e.node.id);
    map[node.slug] = valueIds;
  }

  return map;
}

