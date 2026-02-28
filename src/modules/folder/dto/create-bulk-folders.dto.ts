import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class BulkFolderItem {
  @ApiProperty({ example: 'Documents' })
  @IsNotEmpty()
  @IsString()
  plainName: string;

  @ApiProperty({ required: false, example: '2023-05-30T12:34:56.789Z' })
  @IsDateString()
  @IsOptional()
  modificationTime?: Date;

  @ApiProperty({ required: false, example: '2023-05-30T12:34:56.789Z' })
  @IsDateString()
  @IsOptional()
  creationTime?: Date;
}

export class CreateBulkFoldersDto {
  @ApiProperty({
    example: '79a88429-b45a-4ae7-90f1-c351b6882670',
    description: 'Uuid of the parent folder',
  })
  @IsNotEmpty()
  @IsUUID('4')
  parentFolderUuid: string;

  @ApiProperty({ type: [BulkFolderItem], minItems: 1, maxItems: 15 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => BulkFolderItem)
  folders: BulkFolderItem[];
}
