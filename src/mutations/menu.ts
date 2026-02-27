import { gql } from '@apollo/client/core';

export const MENU_CREATE = gql`
  mutation MenuCreate($input: MenuCreateInput!) {
    menuCreate(input: $input) {
      menu {
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

export const MENU_ITEM_CREATE = gql`
  mutation MenuItemCreate($input: MenuItemCreateInput!) {
    menuItemCreate(input: $input) {
      menuItem {
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

export interface MenuCreateInput {
  name: string;
  slug?: string;
}

export interface MenuItemCreateInput {
  /** ID of the menu this item belongs to */
  menu: string;
  name: string;
  /** ID of the parent menu item (for nested items) */
  parent?: string;
  /** External or internal URL */
  url?: string;
  /** Link to a category by ID */
  category?: string;
  /** Link to a collection by ID */
  collection?: string;
  /** Link to a page by ID */
  page?: string;
}

export interface MenuCreateResult {
  menuCreate: {
    menu: { id: string; name: string; slug: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

export interface MenuItemCreateResult {
  menuItemCreate: {
    menuItem: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}
