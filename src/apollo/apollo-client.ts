import { ApolloClient, ApolloError, InMemoryCache, createHttpLink, from, gql } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import fetch from 'cross-fetch';

let authToken: string | null = null;

export function setAuthToken(token: string): void {
  authToken = token;
}

const httpLink = createHttpLink({
  uri: process.env.SALEOR_API_URL,
  fetch,
});

const authLink = setContext((_, { headers }: { headers?: Record<string, string> }) => ({
  headers: {
    ...headers,
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
  },
}));

export const apollo = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});

const TOKEN_CREATE = gql`
  mutation TokenCreate($email: String!, $password: String!) {
    tokenCreate(email: $email, password: $password) {
      token
      errors {
        field
        message
        code
      }
    }
  }
`;

interface TokenCreateResult {
  tokenCreate: {
    token: string | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

/**
 * Initialises the Apollo client auth token.
 * Priority: SALEOR_APP_TOKEN env var → email/password tokenCreate mutation.
 */
export async function initAuth(): Promise<void> {
  const appToken = process.env.SALEOR_APP_TOKEN;
  if (appToken) {
    setAuthToken(appToken);
    console.log('  Auth: using SALEOR_APP_TOKEN');
    return;
  }

  const email = process.env.SALEOR_EMAIL;
  const password = process.env.SALEOR_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'No auth configured. Set SALEOR_APP_TOKEN or both SALEOR_EMAIL and SALEOR_PASSWORD in .env',
    );
  }

  let result: { data?: TokenCreateResult | null; errors?: readonly { message: string }[] };

  try {
    result = await apollo.mutate<TokenCreateResult>({
      mutation: TOKEN_CREATE,
      variables: { email, password },
      errorPolicy: 'all',
    });
  } catch (err) {
    if (err instanceof ApolloError && err.networkError) {
      const status =
        'statusCode' in err.networkError ? ` (HTTP ${err.networkError.statusCode})` : '';
      const hint =
        'statusCode' in err.networkError && err.networkError.statusCode === 405
          ? '\n  Hint: check SALEOR_API_URL — it must end with /graphql/'
          : '';
      throw new Error(`Network error connecting to Saleor${status}: ${err.networkError.message}${hint}`);
    }
    throw err;
  }

  // GraphQL-level transport errors (e.g. invalid token, permission denied)
  if (result.errors && result.errors.length > 0) {
    throw new Error(`Auth failed: ${result.errors.map((e) => e.message).join(', ')}`);
  }

  const token = result.data?.tokenCreate?.token;
  const errors = result.data?.tokenCreate?.errors ?? [];

  if (errors.length > 0) {
    throw new Error(`tokenCreate failed: ${errors.map((e) => e.message).join(', ')}`);
  }
  if (!token) {
    throw new Error('tokenCreate returned no token');
  }

  setAuthToken(token);
  console.log('  Auth: JWT obtained via tokenCreate');
}
