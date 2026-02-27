import { gql } from '@apollo/client/core';

export const CHANNEL_CREATE = gql`
  mutation ChannelCreate($input: ChannelCreateInput!) {
    channelCreate(input: $input) {
      channel {
        id
        name
        slug
        currencyCode
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export interface ChannelCreateInput {
  name: string;
  slug: string;
  currencyCode: string;
  /** Default country for the channel e.g. "US" */
  defaultCountry: string;
  /** Warehouse IDs to assign to this channel */
  addWarehouses?: string[];
  /** Shipping zone IDs to assign */
  addShippingZones?: string[];
  isActive?: boolean;
}

export interface ChannelCreateResult {
  channelCreate: {
    channel: { id: string; name: string; slug: string; currencyCode: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
