import type { CategoryInput } from '../mutations/category.js';
import type { SeederSection } from './types.js';

export interface CategoryConfig extends CategoryInput {
  children?: CategoryConfig[];
}

export const categories: SeederSection<CategoryConfig> = {
  enabled: false,
  data: [
    {
      name: 'Clothing',
      slug: 'clothing',
      children: [
        { name: 'Men', slug: 'men' },
        { name: 'Women', slug: 'women' },
        { name: 'Kids', slug: 'kids' },
      ],
    },
    {
      name: 'Accessories',
      slug: 'accessories',
      children: [
        { name: 'Bags', slug: 'bags' },
        { name: 'Jewelry', slug: 'jewelry' },
      ],
    },
    {
      name: 'Digital',
      slug: 'digital',
    },
  ],
};
