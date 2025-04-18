import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateThumbnailDto {
  @ApiProperty({
    description: 'The ID of the file',
    example: 12345,
  })
  @IsNotEmpty()
  @IsNumber()
  fileId: number;

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
  })
  @IsNotEmpty()
  @IsString()
  bucketId: string;

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
