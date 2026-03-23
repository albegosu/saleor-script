import type { SeederSection } from './types.js';

export interface PermissionGroupConfig {
  name: string;
  /** Saleor PermissionEnum values (e.g. MANAGE_USERS). */
  permissionCodes: string[];
}

const ALL_SALEOR_PERMISSION_CODES: string[] = [
  'MANAGE_USERS',
  'MANAGE_STAFF',
  'IMPERSONATE_USER',
  'MANAGE_APPS',
  'MANAGE_OBSERVABILITY',
  'MANAGE_CHECKOUTS',
  'HANDLE_CHECKOUTS',
  'HANDLE_TAXES',
  'MANAGE_TAXES',
  'MANAGE_CHANNELS',
  'MANAGE_DISCOUNTS',
  'MANAGE_GIFT_CARD',
  'MANAGE_MENUS',
  'MANAGE_ORDERS',
  'MANAGE_ORDERS_IMPORT',
  'MANAGE_PAGES',
  'MANAGE_PAGE_TYPES_AND_ATTRIBUTES',
  'HANDLE_PAYMENTS',
  'MANAGE_PLUGINS',
  'MANAGE_PRODUCTS',
  'MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES',
  'MANAGE_SHIPPING',
  'MANAGE_SETTINGS',
  'MANAGE_TRANSLATIONS',
];

const ventas: PermissionGroupConfig = {
  name: 'Ventas',
  permissionCodes: ['MANAGE_USERS'],
};

const logistica: PermissionGroupConfig = {
  name: 'Logística',
  permissionCodes: [
    'MANAGE_ORDERS',
    'MANAGE_SHIPPING',
    'MANAGE_CHECKOUTS',
    'MANAGE_PRODUCTS',
    'MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES',
    'MANAGE_DISCOUNTS',
  ],
};

const marketing: PermissionGroupConfig = {
  name: 'Marketing',
  permissionCodes: [
    'MANAGE_USERS',
    'MANAGE_PRODUCTS',
    'MANAGE_DISCOUNTS',
    'MANAGE_PAGES',
    'MANAGE_PAGE_TYPES_AND_ATTRIBUTES',
    'MANAGE_MENUS',
  ],
};

const admin: PermissionGroupConfig = {
  name: 'Admin',
  permissionCodes: ALL_SALEOR_PERMISSION_CODES,
};

export const permissionGroups: SeederSection<PermissionGroupConfig> = {
  enabled: false,
  data: [ventas, logistica, marketing, admin],
};

