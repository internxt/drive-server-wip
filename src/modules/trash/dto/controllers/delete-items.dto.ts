import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum DeleteItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class DeleteItem {
  @IsNotEmpty()
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder',
  })
  id: string;

  @IsEnum(DeleteItemType)
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  type: DeleteItemType;
}

export class DeleteItemsDto {
  @IsNotEmpty()
  @ApiProperty({
    description: 'Array of items with files and folders ids',
  })
  @MaxLength(50)
  @Type(() => DeleteItem)
  items: DeleteItem[];
}
