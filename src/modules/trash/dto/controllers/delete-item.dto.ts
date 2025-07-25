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

export enum DeleteItemType {
  FILE = 'file',
  FOLDER = 'folder',
}

export class DeleteItemDto {
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder (deprecated in favor of uuid)',
    deprecated: true,
    nullable: true,
  })
  id?: string;

  @ApiProperty({
    example: '79a88429-b45a-4ae7-90f1-c351b6882670',
    description: 'Uuid of file or folder',
  })
  uuid?: string;

  @ValidateIf((item) => (!item.id && !item.uuid) || (item.id && item.uuid))
  @IsDefined({ message: 'Provide either item id or uuid, and not both' })
  readonly AreUuidAndIdDefined?: boolean;

  @IsEnum(DeleteItemType)
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
    enum: DeleteItemType,
  })
  type: DeleteItemType;
}

export class DeleteItemsDto {
  @ApiProperty({
    description: 'Array of items with files and folders ids',
    type: DeleteItemDto,
    isArray: true,
    maximum: 50,
    minimum: 1,
  })
  @IsNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested()
  @Type(() => DeleteItemDto)
  items: DeleteItemDto[];
}
