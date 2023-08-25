import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
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
    example: '4',
    description: 'Id of file or folder',
  })
  @IsInt()
  @IsPositive()
  id: string;

  @IsEnum(ItemType)
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  type: ItemType;
}

export class MoveItemsToTrashDto {
  @ApiProperty({
    description: 'Array of items with files and folders ids',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => ItemToTrash)
  @ValidateNested()
  items: ItemToTrash[];
}
