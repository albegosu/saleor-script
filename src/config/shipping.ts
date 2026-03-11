import type { ShippingZoneCreateInput } from '../mutations/shipping.js';
import type { SeederSection } from './types.js';

export interface ShippingMethodConfig {
  name: string;
  type: 'PRICE' | 'WEIGHT';
  /** Per-channel pricing: channelSlug → price amount */
  channelPrices?: Record<string, number>;
  /** Currency code (ISO 4217) used for prices and order value range */
  currencyCode?: string;
  /** Optional minimum order price (same currency as channel) */
  minimumOrderPrice?: number;
  /** Optional maximum order price (same currency as channel) */
  maximumOrderPrice?: number;
}

export interface ShippingZoneConfig extends ShippingZoneCreateInput {
  /** Optional list of channel slugs to assign this zone to */
  channelSlugs?: string[];
  /** Optional list of warehouse slugs to assign this zone to */
  warehouseSlugs?: string[];
  methods?: ShippingMethodConfig[];
}

export const shipping: SeederSection<ShippingZoneConfig> = {
  enabled: true,
  data: [
    {
      name: 'Domestic',
      countries: ['US'],
      default: false,
      methods: [
        {
          name: 'Standard Shipping',
          type: 'PRICE',
          channelPrices: { 'web-store': 5 },
        },
        {
          name: 'Express Shipping',
          type: 'PRICE',
          channelPrices: { 'web-store': 15 },
        },
      ],
    },
    {
      name: 'International',
      default: true,
      methods: [
        {
          name: 'International Standard',
          type: 'PRICE',
          channelPrices: { 'web-store': 20 },
        },
      ],
    },
    {
      name: 'Zona envío test',
      countries: ['ES'],
      default: false,
      channelSlugs: ['canal-test'],
      warehouseSlugs: ['default-warehouse'],
      methods: [
        {
          name: 'Tarifa envío test',
          type: 'PRICE',
          currencyCode: 'EUR',
          channelPrices: {
            'canal-test': 15.99,
          },
          minimumOrderPrice: 0,
          maximumOrderPrice: 10000,
        },
      ],
    },
  ],
};
