import { ApiProperty } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

const areUuidAndIdDefined = (input: CreateThumbnailDto) =>
  (!input.fileId && !input.fileUuid) || (!!input.fileId && !!input.fileUuid);

export class CreateThumbnailDto {
  @ApiProperty({
    description: 'The ID of the file. Deprecated in favor of fileUuid',
    example: 12345,
    deprecated: true,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  fileId: number;

  @ApiProperty({
    description: 'The UUID of the file',
    example: 'ebe586db-eb56-429f-a037-6ba712b40c3c',
    required: true,
  })
  @IsOptional()
  @IsUUID()
  fileUuid: string;

  @ValidateIf(areUuidAndIdDefined)
  @IsDefined({ message: 'Provide either item id or uuid, and not both' })
  private readonly _areUuidAndIdDefined?: boolean;

  @ApiProperty({
    description: 'The type of the file',
    example: 'text',
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({
    description: 'The size of the file in bytes',
    example: 123456789,
  })
  @IsNotEmpty()
  @IsNumber()
  size: number;

  @ApiProperty({
    description: 'The max width of the file',
    type: 'number',
    example: 123456789,
  })
  @IsNotEmpty()
  @IsNumber()
  maxWidth: number;

  @ApiProperty({
    description: 'The max height of the file',
    type: 'number',
    example: 123456789,
  })
  @IsNotEmpty()
  @IsNumber()
  maxHeight: number;

  @ApiProperty({
    description: 'The bucket id where the file is stored',
    example: 'my-bucket',
    deprecated: true,
    required: false,
  })
  @IsOptional()
  @IsString()
  bucketId?: string;

  @ApiProperty({
    description: 'The id of file in the bucket',
    example: 'my-bucket',
  })
  @IsNotEmpty()
  @IsString()
  bucketFile: string;

  @ApiProperty({
    description: 'The encryption version used for the file',
    example: '03-aes',
  })
  @IsNotEmpty()
  @IsString()
  encryptVersion: string;
}
