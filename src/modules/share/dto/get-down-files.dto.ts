import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetDownFilesDto {
  @IsNotEmpty()
  @ApiProperty({
    example: '4',
    description: 'Id of file or folder',
  })
  token: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  code: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  folderId: number;

  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  page: string;

  @ApiProperty({
    example: 'file',
    description: 'Type of item: file or folder',
  })
  perPage: string;
}
