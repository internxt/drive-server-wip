import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { User } from '../../user/user.domain';

export class ShareItemWithMemberDto {
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
    description:
      "Workspace's member id (user uuid) you want to share this file with",
  })
  @IsNotEmpty()
  sharedWith: User['uuid'];

  @ApiProperty({
    example: '84f47d08-dc7c-43dc-b27c-bec4edaa9598',
    description: 'Role of the team regarding the item.',
  })
  @IsNotEmpty()
  roleId: string;
}
