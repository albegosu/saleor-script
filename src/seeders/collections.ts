import { apollo } from '../apollo/apollo-client.js';
import {
  COLLECTION_CREATE,
  COLLECTION_CHANNEL_LISTING_UPDATE,
} from '../mutations/collection.js';
import type {
  CollectionCreateResult,
  CollectionChannelListingUpdateResult,
} from '../mutations/collection.js';
import type { SeederSection, CollectionConfig } from '../config/index.js';
import { logSuccess, logError, logSkip, executeMutation, slugify, type SeedContext } from './utils.js';

export async function seedCollections(
  section: SeederSection<CollectionConfig>,
  ctx: SeedContext,
): Promise<void> {
  console.log('\n[Collections]');

  for (const collectionConfig of section.data) {
    const { channelSlugs, ...input } = collectionConfig;
    const slug = input.slug ?? slugify(input.name);

    const { data, hasError } = await executeMutation<CollectionCreateResult>(
      () =>
        apollo.mutate({
          mutation: COLLECTION_CREATE,
          variables: { input: { ...input, slug } },
          errorPolicy: 'all',
        }),
      'Collection',
      input.name,
    );

    if (hasError) continue;

    const result = data?.collectionCreate;
    const errors = result?.errors ?? [];

    if (errors.length > 0) {
      logError('Collection', input.name, errors);
      continue;
    }

    const collection = result?.collection;
    if (!collection) continue;

    ctx.collectionIds[collection.slug] = collection.id;
    logSuccess('Collection', collection.name, collection.id);

    if (channelSlugs && channelSlugs.length > 0) {
      const addChannels = channelSlugs
        .map((slug) => {
          const channelId = ctx.channelIds[slug];
          if (!channelId) {
            logSkip(
              'CollectionChannel',
              `${collection.name}→${slug}`,
              'channel not in context',
            );
            return null;
          }
          return { channelId, isPublished: input.isPublished ?? false };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);

      if (addChannels.length > 0) {
        const { data: listingData, hasError: listingHasError } =
          await executeMutation<CollectionChannelListingUpdateResult>(
            () =>
              apollo.mutate({
                mutation: COLLECTION_CHANNEL_LISTING_UPDATE,
                variables: { id: collection.id, input: { addChannels } },
                errorPolicy: 'all',
              }),
            'CollectionChannelListing',
            collection.name,
          );

        if (!listingHasError) {
          const listingErrors = listingData?.collectionChannelListingUpdate?.errors ?? [];
          if (listingErrors.length > 0) {
            logError('CollectionChannelListing', collection.name, listingErrors);
          } else {
            console.log(`    ↳ listed on ${addChannels.length} channel(s)`);
          }
        }
      }
    }
  }
}
