import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShareDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder',
  })
  timesValid: number;

  @IsNotEmpty()
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder',
  })
  active: boolean;

  @IsNotEmpty()
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  encryptionKey: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  fileToken: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  bucket: string;
}
