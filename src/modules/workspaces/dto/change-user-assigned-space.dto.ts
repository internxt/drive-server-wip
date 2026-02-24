import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsPositive } from 'class-validator';
import { type WorkspaceInvite } from '../domains/workspace-invite.domain';

export class ChangeUserAssignedSpaceDto {
  @ApiProperty({
    example: '1073741824',
    description: 'New Space assigned to user in bytes',
  })
  @IsNotEmpty()
  @IsPositive()
  spaceLimit: WorkspaceInvite['spaceLimit'];
}
