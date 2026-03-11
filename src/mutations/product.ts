import { gql } from '@apollo/client/core';

// ---------------------------------------------------------------------------
// GraphQL documents
// ---------------------------------------------------------------------------

export const PRODUCT_CREATE = gql`
  mutation ProductCreate($input: ProductCreateInput!) {
    productCreate(input: $input) {
      product {
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

export const PRODUCT_CHANNEL_LISTING_UPDATE = gql`
  mutation ProductChannelListingUpdate($id: ID!, $input: ProductChannelListingUpdateInput!) {
    productChannelListingUpdate(id: $id, input: $input) {
      product {
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

export const PRODUCT_VARIANT_CREATE = gql`
  mutation ProductVariantCreate($input: ProductVariantCreateInput!) {
    productVariantCreate(input: $input) {
      productVariant {
        id
        name
        sku
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const PRODUCT_VARIANT_CHANNEL_LISTING_UPDATE = gql`
  mutation ProductVariantChannelListingUpdate(
    $id: ID
    $sku: String
    $input: [ProductVariantChannelListingAddInput!]!
  ) {
    productVariantChannelListingUpdate(id: $id, sku: $sku, input: $input) {
      variant {
        id
        sku
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

export const PRODUCT_MEDIA_CREATE = gql`
  mutation ProductMediaCreate($input: ProductMediaCreateInput!) {
    productMediaCreate(input: $input) {
      media {
        id
        alt
        url
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Types mirroring Saleor inputs/results (minimal subset we need)
// ---------------------------------------------------------------------------

export interface AttributeValueSelectableTypeInput {
  id?: string;
  externalReference?: string;
  value?: string;
}

export interface AttributeValueInput {
  id: string;
  plainText?: string;
  dropdown?: AttributeValueSelectableTypeInput;
}

export interface ProductCreateInput {
  name: string;
  slug: string;
  productType: string;
  category?: string;
  description?: string | null;
  attributes?: AttributeValueInput[];
}

export interface ProductCreateResult {
  productCreate: {
    product: { id: string; name: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface ProductChannelListingAddInput {
  channelId: string;
  isPublished?: boolean;
  visibleInListings?: boolean;
  isAvailableForPurchase?: boolean;
  addVariants?: string[];
}

export interface ProductChannelListingUpdateInput {
  updateChannels: ProductChannelListingAddInput[];
  removeChannels?: string[];
}

export interface ProductChannelListingUpdateResult {
  productChannelListingUpdate: {
    product: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface StockInput {
  warehouse: string;
  quantity: number;
}

export interface ProductVariantCreateInput {
  product: string;
  name?: string;
  sku?: string;
  attributes: AttributeValueInput[];
  stocks?: StockInput[];
}

export interface ProductVariantCreateResult {
  productVariantCreate: {
    productVariant: { id: string; name: string; sku: string | null } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface ProductVariantChannelListingAddInput {
  channelId: string;
  price: string;
  costPrice?: string;
  preorderThreshold?: number;
}

export interface ProductVariantChannelListingUpdateResult {
  productVariantChannelListingUpdate: {
    variant: { id: string; sku: string | null } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface ProductMediaCreateInput {
  alt?: string;
  product: string;
  mediaUrl?: string;
}

export interface ProductMediaCreateResult {
  productMediaCreate: {
    media: { id: string; alt: string | null; url: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

