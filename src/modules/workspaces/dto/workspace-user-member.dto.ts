import { UserToJsonDto } from '../../user/dto/user-to-json.dto';

export interface WorkspaceUserMemberDto {
  [key: string]: unknown;
  isOwner: boolean;
  isManager: boolean;
  id: string;
  memberId: string;
  member: UserToJsonDto;
  key: string;
  workspaceId: string;
  spaceLimit: string;
  driveUsage: string;
  backupsUsage: string;
  usedSpace: string;
  freeSpace: string;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
