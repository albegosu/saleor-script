import { apollo } from '../apollo/apollo-client.js';
import { PERMISSION_GROUP_CREATE, type PermissionGroupCreateInput, type PermissionGroupCreateResult } from '../mutations/permissionGroup.js';
import type { PermissionGroupConfig } from '../config/permissionGroups.js';
import { fetchPermissionGroupsBySearch } from '../queries/permissionGroups.js';
import type { SeederSection } from '../config/types.js';
import { executeMutation, logError, logSkip, logSuccess } from './utils.js';

export async function seedPermissionGroups(
  section: SeederSection<PermissionGroupConfig>,
): Promise<void> {
  console.log('\n[Grupos de permisos]');

  for (const groupConfig of section.data) {
    const existing = await fetchPermissionGroupsBySearch(groupConfig.name);
    const existingId = existing[groupConfig.name];

    if (existingId) {
      logSkip('PermissionGroup', groupConfig.name, `ya existe (${existingId})`);
      continue;
    }

    const input: PermissionGroupCreateInput = {
      name: groupConfig.name,
      addPermissions: groupConfig.permissionCodes,
      restrictedAccessToChannels: false,
    };

    const { data, hasError } = await executeMutation<PermissionGroupCreateResult>(
      () =>
        apollo.mutate({
          mutation: PERMISSION_GROUP_CREATE,
          variables: { input },
          errorPolicy: 'all',
        }),
      'PermissionGroup',
      groupConfig.name,
    );

    if (hasError) continue;

    const result = data?.permissionGroupCreate;
    const errors = result?.errors ?? [];
    if (errors.length > 0) {
      logError('PermissionGroup', groupConfig.name, errors);
      continue;
    }

    if (!result?.group) continue;
    logSuccess('PermissionGroup', result.group.name, result.group.id);
  }
}

