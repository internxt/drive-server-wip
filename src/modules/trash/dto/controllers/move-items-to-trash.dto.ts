import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ItemToTrashType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class ItemToTrashDto {
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder (deprecated in favor of uuid)',
    required: false,
    deprecated: true,
  })
  @IsOptional()
  id?: string;

  @ApiProperty({
    example: '4',
    description: 'Uuid of file or folder',
    required: true,
  })
  uuid?: string;

  @ValidateIf((item) => (!item.id && !item.uuid) || (item.id && item.uuid))
  @IsDefined({ message: 'Provide either item id or uuid, and not both' })
  readonly AreUuidAndIdDefined?: boolean;

  @IsEnum(ItemToTrashType)
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
    enum: ItemToTrashType,
  })
  type: ItemToTrashType;
}

export class MoveItemsToTrashDto {
  @ApiProperty({
    description: 'Array of items with files and folders ids',
    type: ItemToTrashDto,
    isArray: true,
    maxItems: 50,
  })
  @IsNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested()
  @Type(() => ItemToTrashDto)
  items: ItemToTrashDto[];
}
