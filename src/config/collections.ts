import type { CollectionCreateInput } from '../mutations/collection.js';
import type { SeederSection } from './types.js';

export interface CollectionConfig extends CollectionCreateInput {
  /** Channel slugs that this collection should be listed on */
  channelSlugs?: string[];
}

export const collections: SeederSection<CollectionConfig> = {
  enabled: true,
  data: [
    {
      name: 'New Arrivals',
      slug: 'new-arrivals',
      isPublished: true,
      channelSlugs: ['betsolar-test'],
    },
    {
      name: 'Sale',
      slug: 'sale',
      isPublished: true,
      channelSlugs: ['betsolar-test'],
    },
    {
      name: 'Featured',
      slug: 'featured',
      isPublished: true,
      channelSlugs: ['betsolar-test'],
    },
  ],
};
