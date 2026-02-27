import type { PageTypeCreateInput } from '../mutations/pageType.js';
import type { SeederSection } from './types.js';

export interface PageTypeConfig extends PageTypeCreateInput {
  /** Slugs of attributes (from seeded attributes) to assign */
  attributeSlugs?: string[];
}

export const pageTypes: SeederSection<PageTypeConfig> = {
  enabled: true,
  data: [
    {
      name: 'Fabricantes',
      slug: 'fabricantes',
      attributeSlugs: [
        'marca',
        'activo',
        'mostrar-en-la-home-y-pagina-de-fabricantes',
        'logo',
        'imagen',
      ],
    },
    {
      name: 'Post',
      slug: 'post',
      attributeSlugs: ['title-post', 'content-post', 'imagen-post'],
    },
  ],
};
