import { BackupModel } from '../modules/backups/models/backup.model';
import { DeviceModel } from '../modules/backups/models/device.model';
import { FavoriteModel } from '../modules/favorite/favorite.model';
import { FileModel } from '../modules/file/file.model';
import { FolderModel } from '../modules/folder/folder.model';
import { RoleModel, SharingModel } from '../modules/sharing/models';
import { SharingRolesModel } from '../modules/sharing/models/sharing-roles.model';
import { ThumbnailModel } from '../modules/thumbnail/thumbnail.model';
import { PreCreatedUserModel } from '../modules/user/pre-created-users.model';
import { UserNotificationTokensModel } from '../modules/user/user-notification-tokens.model';
import { UserModel } from '../modules/user/user.model';
import { WorkspaceItemUserModel } from '../modules/workspaces/models/workspace-items-users.model';
import { WorkspaceTeamUserModel } from '../modules/workspaces/models/workspace-team-users.model';
import { WorkspaceTeamModel } from '../modules/workspaces/models/workspace-team.model';
import { WorkspaceUserModel } from '../modules/workspaces/models/workspace-users.model';
import { WorkspaceModel } from '../modules/workspaces/models/workspace.model';

export const HEAVY_READ_POOL_CONNECTION = 'heavy-read-pool';

// FileModel/FolderModel and their associations, required to initialize them in this connection
export const heavyReadPoolModels = [
  FileModel,
  FolderModel,
  UserModel,
  FavoriteModel,
  SharingModel,
  SharingRolesModel,
  RoleModel,
  PreCreatedUserModel,
  ThumbnailModel,
  WorkspaceItemUserModel,
  WorkspaceModel,
  WorkspaceTeamModel,
  WorkspaceTeamUserModel,
  WorkspaceUserModel,
  DeviceModel,
  BackupModel,
  UserNotificationTokensModel,
];
