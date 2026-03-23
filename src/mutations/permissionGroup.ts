import { gql } from '@apollo/client/core';

export const PERMISSION_GROUP_CREATE = gql`
  mutation PermissionGroupCreate($input: PermissionGroupCreateInput!) {
    permissionGroupCreate(input: $input) {
      group {
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

export interface PermissionGroupCreateInput {
  name: string;
  addPermissions: string[];
  /** When false, Saleor ignores addChannels. */
  restrictedAccessToChannels: boolean;
}

export interface PermissionGroupCreateResult {
  permissionGroupCreate: {
    group: { id: string; name: string } | null;
    errors: { field: string | null; message: string; code: string }[];
  };
}

