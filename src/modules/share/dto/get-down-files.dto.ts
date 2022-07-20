import { IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetDownFilesDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'token',
    description: 'Token of share',
  })
  token: string;

  @IsOptional()
  @ApiProperty({
    example: 'code',
    description: 'Code of share',
  })
  code: string;

  @IsNotEmpty()
  @ApiProperty({
    example: 'folderId1',
    description: 'Folder Id',
  })
  folderId: number;

  @ApiProperty({
    example: '1',
    description: 'Page of pagination',
  })
  page: string;

  @ApiProperty({
    example: '50',
    description: 'Number of items per page',
  })
  perPage: string;
}
