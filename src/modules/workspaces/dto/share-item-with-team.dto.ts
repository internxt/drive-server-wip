import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { type WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { type WorkspaceTeam } from '../domains/workspace-team.domain';

export class ShareItemWithTeamDto {
  @ApiProperty({
    example: 'uuid',
    description: 'The uuid of the item to share',
  })
  @IsNotEmpty()
  itemId: WorkspaceItemUser['itemId'];

  @ApiProperty({
    example: 'file | folder',
    description: 'The type of the resource to share',
  })
  @IsNotEmpty()
  itemType: WorkspaceItemUser['itemType'];

  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description: "Workspace's team id you want to share this file with",
  })
  @IsNotEmpty()
  sharedWith: WorkspaceTeam['id'];

  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description: 'Role of the team regarding the item.',
  })
  @IsNotEmpty()
  roleId: string;
}
