import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class ItemToTrash {
  @IsNotEmpty()
  @ApiProperty({
    example: '4 (folder) or 64e56bfe9b1124001fd745c1 (file)',
    description: 'Id of file or folder',
  })
  id: string;

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
