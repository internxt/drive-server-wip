import { ApiProperty } from '@nestjs/swagger';

class FileSizeDTO {
  @ApiProperty({
    description: 'Size of the file in bytes',
    example: 3123312,
    type: 'integer',
  })
  size: number;
}

export class FileCheckSizeLimitDTO {
  @ApiProperty({
    description: 'File details',
    type: FileSizeDTO,
  })
  file: FileSizeDTO;
}
