import { gql } from '@apollo/client/core';
import { apollo } from '../apollo/apollo-client.js';

const CHANNELS_LIST = gql`
  query ChannelsList {
    channels {
      id
      slug
      name
    }
  }
`;

interface ChannelsListResult {
  channels: { id: string; slug: string; name: string }[];
}

/**
 * Fetches all channels and returns a map slug → id.
 */
export async function fetchChannelIdsBySlug(): Promise<Record<string, string>> {
  const slugToId: Record<string, string> = {};
  let result: { data?: { channels: ChannelsListResult['channels'] } };

  try {
    result = await apollo.query<{ channels: ChannelsListResult['channels'] }>({
      query: CHANNELS_LIST,
    });
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyErr = err as any;
    const payload = anyErr?.networkError?.result ?? anyErr;
    console.error(
      'La consulta ChannelsList ha fallado con el siguiente payload:',
      JSON.stringify(payload, null, 2),
    );
    throw err;
  }

  const channels = result.data?.channels ?? [];
  for (const ch of channels) {
    slugToId[ch.slug] = ch.id;
  }

  return slugToId;
}

