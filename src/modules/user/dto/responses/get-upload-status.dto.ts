import { ApiProperty } from '@nestjs/swagger';

export class GetUploadStatusDto {
  @ApiProperty({
    description: 'Indicates whether the user has uploaded any files',
    example: true,
  })
  hasUploadedFiles: boolean;
}
