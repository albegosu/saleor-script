import { gql } from '@apollo/client/core';

export const SHIPPING_ZONE_CREATE = gql`
  mutation ShippingZoneCreate($input: ShippingZoneCreateInput!) {
    shippingZoneCreate(input: $input) {
      shippingZone {
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

export const SHIPPING_PRICE_CREATE = gql`
  mutation ShippingPriceCreate($input: ShippingPriceInput!) {
    shippingPriceCreate(input: $input) {
      shippingMethod {
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

export const SHIPPING_METHOD_CHANNEL_LISTING_UPDATE = gql`
  mutation ShippingMethodChannelListingUpdate(
    $id: ID!
    $input: ShippingMethodChannelListingInput!
  ) {
    shippingMethodChannelListingUpdate(id: $id, input: $input) {
      shippingMethod {
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

export type ShippingMethodType = 'PRICE' | 'WEIGHT';

export interface ShippingZoneCreateInput {
  name: string;
  /** ISO 3166-1 alpha-2 country codes */
  countries?: string[];
  /** Channel IDs to assign */
  addChannels?: string[];
  /** Warehouse IDs to assign */
  addWarehouses?: string[];
  default?: boolean;
  description?: string;
}

export interface ShippingPriceInput {
  name: string;
  shippingZone: string;
  type: ShippingMethodType;
  minimumOrderWeight?: { value: number; unit: string };
  maximumOrderWeight?: { value: number; unit: string };
}

export interface ShippingMethodChannelListingInput {
  addChannels?: {
    channelId: string;
    price: { amount: number; currency: string };
    minimumOrderPrice?: { amount: number; currency: string };
    maximumOrderPrice?: { amount: number; currency: string };
  }[];
}

export interface ShippingZoneCreateResult {
  shippingZoneCreate: {
    shippingZone: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface ShippingPriceCreateResult {
  shippingPriceCreate: {
    shippingMethod: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface ShippingMethodChannelListingUpdateResult {
  shippingMethodChannelListingUpdate: {
    shippingMethod: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
