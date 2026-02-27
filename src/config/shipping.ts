import type { ShippingZoneCreateInput } from '../mutations/shipping.js';
import type { SeederSection } from './types.js';

export interface ShippingMethodConfig {
  name: string;
  type: 'PRICE' | 'WEIGHT';
  /** Per-channel pricing: channelSlug → price amount */
  channelPrices?: Record<string, number>;
}

export interface ShippingZoneConfig extends ShippingZoneCreateInput {
  methods?: ShippingMethodConfig[];
}

export const shipping: SeederSection<ShippingZoneConfig> = {
  enabled: false,
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
  ],
};
