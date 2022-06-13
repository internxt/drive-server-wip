import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateShareDto {
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder',
  })
  timesValid: number;

  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  encryptionKey = '';

  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  mnemonic = '';

  @IsNotEmpty()
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  itemToken: string;

  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  bucket: string;
}
