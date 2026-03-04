import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { type WorkspaceInviteAttributes } from '../attributes/workspace-invite.attribute';

export class AcceptWorkspaceInviteDto {
  @ApiProperty({
    example: '0f8fad5b-d9cb-469f-a165-70867728950e',
    description: 'id of the invitation',
  })
  @IsUUID()
  @IsNotEmpty()
  inviteId: WorkspaceInviteAttributes['id'];
}
