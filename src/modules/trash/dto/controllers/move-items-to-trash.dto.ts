import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
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
  @MaxLength(50)
  @Type(() => ItemToTrash)
  items: ItemToTrash[];
}
