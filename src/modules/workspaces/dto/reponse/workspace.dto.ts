import { ApiProperty } from '@nestjs/swagger';
import { UserToJsonDto } from '../../../user/dto/user-to-json.dto';
import { WorkspaceAttributes } from '../../attributes/workspace.attributes';
import { Workspace } from '../../domains/workspaces.domain';

export class WorkspaceAttributesDto implements WorkspaceAttributes {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;

  @ApiProperty()
  defaultTeamId: string;

  @ApiProperty()
  workspaceUserId: string;

  @ApiProperty()
  setupCompleted: boolean;

  @ApiProperty()
  numberOfSeats: number;

  @ApiProperty({ required: false })
  phoneNumber?: string;

  @ApiProperty({ required: false })
  rootFolderId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

class WorkspaceUserToJSONDTO {
  @ApiProperty()
  id: string;

  @ApiProperty()
  memberId: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  rootFolderId: string;

  @ApiProperty()
  spaceLimit: number;

  @ApiProperty()
  driveUsage: number;

  @ApiProperty()
  backupsUsage: number;

  @ApiProperty()
  deactivated: boolean;

  @ApiProperty()
  member: UserToJsonDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class WorkspaceDto {
  @ApiProperty()
  workspaceUser: WorkspaceUserToJSONDTO;

  @ApiProperty()
  workspace: WorkspaceAttributesDto;
}

export class GetAvailableWorkspacesResponseDto {
  @ApiProperty({ type: [WorkspaceDto] })
  availableWorkspaces: WorkspaceDto[];

  @ApiProperty({ type: [Workspace] })
  pendingWorkspaces: WorkspaceAttributesDto[];
}
