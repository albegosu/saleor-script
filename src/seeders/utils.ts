import { ApolloError } from '@apollo/client/core';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Saleor business-level error (inside mutation result data) */
export interface SaleorError {
  field?: string | null;
  message: string;
  code?: string;
}

/** Apollo/GraphQL transport-level error (permission denied, bad token, etc.) */
interface TransportError {
  message: string;
  extensions?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Logging helpers
// ---------------------------------------------------------------------------

export function logSuccess(type: string, name: string, id: string): void {
  console.log(`  ✔ ${type}: "${name}" (${id})`);
}

export function logSkip(type: string, name: string, reason: string): void {
  console.log(`  ⚠ ${type}: "${name}" skipped — ${reason}`);
}

export function logError(type: string, name: string, errors: SaleorError[]): void {
  for (const e of errors) {
    const field = e.field ? ` [field: ${e.field}]` : '';
    const code = e.code ? ` (${e.code})` : '';
    console.error(`  ✖ ${type}: "${name}" failed —${field} ${e.message}${code}`);
  }
}

function logTransportErrors(type: string, name: string, errors: TransportError[]): void {
  for (const e of errors) {
    const code = e.extensions?.['code'] ? ` (${e.extensions['code']})` : '';
    console.error(`  ✖ ${type}: "${name}" — GraphQL error: ${e.message}${code}`);
  }
}

function logNetworkError(type: string, name: string, err: ApolloError): void {
  if (err.networkError) {
    const status =
      'statusCode' in err.networkError ? ` [HTTP ${err.networkError.statusCode}]` : '';
    console.error(`  ✖ ${type}: "${name}" — Network error${status}: ${err.networkError.message}`);
  } else {
    console.error(`  ✖ ${type}: "${name}" — ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Central mutation executor
// Handles all three error layers:
//   1. Network / connection errors  (ApolloError thrown)
//   2. GraphQL transport errors     (permission denied, bad token — in result.errors)
//   3. Saleor business errors       (validation, slug conflict — in data.xxx.errors)
// ---------------------------------------------------------------------------

interface MutationResult<T> {
  data: T | null | undefined;
  /** True if any error was detected (already logged). Caller should `continue`. */
  hasError: boolean;
}

export async function executeMutation<T>(
  fn: () => Promise<{ data?: T | null; errors?: readonly TransportError[] }>,
  type: string,
  name: string,
): Promise<MutationResult<T>> {
  try {
    const result = await fn();

    // Layer 2: GraphQL transport errors (errorPolicy: 'all' returns these instead of throwing)
    if (result.errors && result.errors.length > 0) {
      logTransportErrors(type, name, [...result.errors]);
      return { data: result.data, hasError: true };
    }

    return { data: result.data, hasError: false };
  } catch (err) {
    if (err instanceof ApolloError) {
      // Layer 1a: network error (unreachable server, timeout, HTTP 5xx)
      if (err.networkError) {
        logNetworkError(type, name, err);
        return { data: null, hasError: true };
      }
      // Layer 1b: graphQL errors thrown (happens when errorPolicy is not 'all')
      if (err.graphQLErrors.length > 0) {
        logTransportErrors(type, name, [...err.graphQLErrors]);
        return { data: null, hasError: true };
      }
      // Fallback ApolloError
      console.error(`  ✖ ${type}: "${name}" — ${err.message}`);
      return { data: null, hasError: true };
    }

    // Unknown error: re-throw so the section-level catch in index.ts picks it up
    throw err;
  }
}

/** Slugify a name: lowercase, replace non-alphanum with dash, collapse dashes */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Shared context passed between seeders so later ones can reference earlier IDs */
export interface SeedContext {
  /** taxClass name → id */
  taxClassIds: Record<string, string>;
  /** warehouse slug → id */
  warehouseIds: Record<string, string>;
  /** channel slug → id */
  channelIds: Record<string, string>;
  /** shippingZone name → id */
  shippingZoneIds: Record<string, string>;
  /** attribute slug → id */
  attributeIds: Record<string, string>;
  /** productType slug → id */
  productTypeIds: Record<string, string>;
  /** category slug → id */
  categoryIds: Record<string, string>;
  /** collection slug → id */
  collectionIds: Record<string, string>;
  /** pageType slug → id */
  pageTypeIds: Record<string, string>;
  /** page slug → id */
  pageIds: Record<string, string>;
}

export function createEmptyContext(): SeedContext {
  return {
    taxClassIds: {},
    warehouseIds: {},
    channelIds: {},
    shippingZoneIds: {},
    attributeIds: {},
    productTypeIds: {},
    categoryIds: {},
    collectionIds: {},
    pageTypeIds: {},
    pageIds: {},
  };
}
