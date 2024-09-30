import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class ItemToTrash {
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder',
  })
  id?: string;

  @ApiProperty({
    example: '4',
    description: 'Uuid of file or folder',
  })
  uuid?: string;

  @ValidateIf((item) => (!item.id && !item.uuid) || (item.id && item.uuid))
  @IsDefined({ message: 'Provide either item id or uuid, and not both' })
  readonly AreUuidAndIdDefined?: boolean;

  @IsEnum(ItemType)
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  type: ItemType;
}

export class MoveItemsToTrashDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Array of items with files and folders ids',
  })
  @ArrayMaxSize(50)
  @ValidateNested()
  @Type(() => ItemToTrash)
  items: ItemToTrash[];
}
