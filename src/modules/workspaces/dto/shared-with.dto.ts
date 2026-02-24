import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { type WorkspaceItemUser } from '../domains/workspace-item-user.domain';
import { WorkspaceItemType } from '../attributes/workspace-items-users.attributes';

export class GetSharedWithDto {
  @ApiProperty({
    example: 'uuid',
    description: 'The uuid of the item to share',
  })
  @IsNotEmpty()
  itemId: WorkspaceItemUser['itemId'];

  @ApiProperty({
    example: WorkspaceItemType,
    description: 'The type of the resource to share',
  })
  @IsNotEmpty()
  @IsEnum(WorkspaceItemType)
  itemType: WorkspaceItemUser['itemType'];
}
