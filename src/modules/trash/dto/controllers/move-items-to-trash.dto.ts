import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
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
    description:
      'Id of folder (deprecated in favor of uuid). Files only accept uuid',
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
  @IsOptional()
  @IsString()
  uuid?: string;

  @ValidateIf((item) => (!item.id && !item.uuid) || (item.id && item.uuid))
  @IsDefined({ message: 'Provide either item id or uuid, and not both' })
  readonly AreUuidAndIdDefined?: boolean;

  @ValidateIf((item) => item.type === ItemToTrashType.FILE && !item.uuid)
  @IsDefined({ message: 'Files must be provided by uuid' })
  readonly IsFileUuidDefined?: boolean;

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
