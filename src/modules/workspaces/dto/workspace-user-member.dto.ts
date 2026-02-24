import { type UserToJsonDto } from '../../user/dto/user-to-json.dto';

export interface WorkspaceUserMemberDto {
  [key: string]: unknown;
  isOwner: boolean;
  isManager: boolean;
  id: string;
  memberId: string;
  member: UserToJsonDto;
  key: string;
  workspaceId: string;
  spaceLimit: number;
  driveUsage: number;
  backupsUsage: number;
  usedSpace: number;
  freeSpace: number;
  deactivated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
