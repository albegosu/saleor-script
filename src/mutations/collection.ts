import { gql } from '@apollo/client/core';

export const COLLECTION_CREATE = gql`
  mutation CollectionCreate($input: CollectionCreateInput!) {
    collectionCreate(input: $input) {
      collection {
        id
        name
        slug
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const COLLECTION_CHANNEL_LISTING_UPDATE = gql`
  mutation CollectionChannelListingUpdate(
    $id: ID!
    $input: CollectionChannelListingUpdateInput!
  ) {
    collectionChannelListingUpdate(id: $id, input: $input) {
      collection {
        id
        name
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export interface CollectionCreateInput {
  name: string;
  slug?: string;
  description?: unknown;
  isPublished?: boolean;
  seo?: { title?: string; description?: string };
  backgroundImage?: string;
  backgroundImageAlt?: string;
}

export interface CollectionChannelListingUpdateInput {
  addChannels?: { channelId: string; isPublished?: boolean; publishedAt?: string }[];
  removeChannels?: string[];
}

export interface CollectionCreateResult {
  collectionCreate: {
    collection: { id: string; name: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface CollectionChannelListingUpdateResult {
  collectionChannelListingUpdate: {
    collection: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
