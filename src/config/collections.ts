import type { CollectionCreateInput } from '../mutations/collection.js';
import type { SeederSection } from './types.js';

export interface CollectionConfig extends CollectionCreateInput {
  /** Channel slugs that this collection should be listed on */
  channelSlugs?: string[];
}

export const collections: SeederSection<CollectionConfig> = {
  enabled: false,
  data: [
    {
      name: 'New Arrivals',
      slug: 'new-arrivals',
      isPublished: true,
      channelSlugs: ['web-store'],
    },
    {
      name: 'Sale',
      slug: 'sale',
      isPublished: true,
      channelSlugs: ['web-store'],
    },
    {
      name: 'Featured',
      slug: 'featured',
      isPublished: true,
      channelSlugs: ['web-store'],
    },
  ],
};
