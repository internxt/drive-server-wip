import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ItemToTrashType } from './move-items-to-trash.dto';

export class ItemToRestoreDto {
  @ApiProperty({
    example: '4e9a9c38-5b49-4a3f-9a3b-6f0b8a2f2a51',
    description: 'Uuid of the trashed file or folder',
  })
  @IsUUID()
  uuid: string;

  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
    enum: ItemToTrashType,
  })
  @IsEnum(ItemToTrashType)
  type: ItemToTrashType;
}

export class RestoreItemsFromTrashDto {
  @ApiProperty({
    description:
      'Trashed files and folders to put back in the folders they were trashed from',
    type: ItemToRestoreDto,
    isArray: true,
    maxItems: 50,
  })
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ArrayUnique((item: ItemToRestoreDto) => item.uuid)
  @ValidateNested({ each: true })
  @Type(() => ItemToRestoreDto)
  items: ItemToRestoreDto[];
}

export enum RestoreFailureReason {
  ParentNotAvailable = 'parent_not_available',
  NameConflict = 'name_conflict',
  NotRestorable = 'not_restorable',
}

export class FailedRestoreItemDto extends ItemToRestoreDto {
  @ApiProperty({
    enum: RestoreFailureReason,
    description:
      'parent_not_available: the folder it was trashed from is in the trash or deleted. name_conflict: an item with the same name is already there. not_restorable: the item is not in the trash, does not exist or could not be moved.',
  })
  reason: RestoreFailureReason;
}

export class RestoreItemsFromTrashResponseDto {
  @ApiProperty({ type: ItemToRestoreDto, isArray: true })
  restored: ItemToRestoreDto[];

  @ApiProperty({ type: FailedRestoreItemDto, isArray: true })
  failed: FailedRestoreItemDto[];
}
