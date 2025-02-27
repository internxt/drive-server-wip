import { ApiProperty } from '@nestjs/swagger';
import { UserToJsonDto } from 'src/modules/user/dto/user-to-json.dto';
import { WorkspaceAttributes } from '../../attributes/workspace.attributes';
import { Workspace } from '../../domains/workspaces.domain';

export class WorkspaceUserToJSONDTO {
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
  workspace: WorkspaceAttributes;
}

export class GetAvailableWorkspacesResponseDto {
  @ApiProperty({ type: [WorkspaceDto] })
  availableWorkspaces: WorkspaceDto[];

  @ApiProperty({ type: [Workspace] })
  pendingWorkspaces: WorkspaceAttributes[];
}
