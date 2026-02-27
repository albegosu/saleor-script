import type { AttributeCreateInput } from '../mutations/attribute.js';
import type { SeederSection } from './types.js';

export const attributes: SeederSection<AttributeCreateInput> = {
  enabled: true,
  data: [
    // Manufacturers attributes
    {
      name: 'Marca',
      slug: 'marca',
      type: 'PAGE_TYPE',
      inputType: 'PLAIN_TEXT',
      valueRequired: true,
      visibleInStorefront: true,
    },
    {
      name: 'Activo',
      slug: 'activo',
      type: 'PAGE_TYPE',
      inputType: 'BOOLEAN',
      valueRequired: true,
      visibleInStorefront: true,
    },
    {
      name: 'Mostrar en la home y pagina de fabricantes',
      slug: 'mostrar-en-la-home-y-pagina-de-fabricantes',
      type: 'PAGE_TYPE',
      inputType: 'BOOLEAN',
      valueRequired: true,
      visibleInStorefront: true,
    },
    {
      name: 'Logo',
      slug: 'logo',
      type: 'PAGE_TYPE',
      inputType: 'FILE',
      valueRequired: false,
      visibleInStorefront: true,
    },
    {
      name: 'Imagen',
      slug: 'imagen',
      type: 'PAGE_TYPE',
      inputType: 'FILE',
      valueRequired: false,
      visibleInStorefront: true,
    },
    // Blog attributes
    {
      name: 'Title - Post',
      slug: 'title-post',
      type: 'PAGE_TYPE',
      inputType: 'PLAIN_TEXT',
      valueRequired: true,
      visibleInStorefront: true,
    },
    {
      name: 'Content - Post',
      slug: 'content-post',
      type: 'PAGE_TYPE',
      inputType: 'PLAIN_TEXT',
      valueRequired: true,
      visibleInStorefront: true,
    },
    {
      name: 'Imagen - Post',
      slug: 'imagen-post',
      type: 'PAGE_TYPE',
      inputType: 'FILE',
      valueRequired: true,
      visibleInStorefront: true,
    },
  ],
};
