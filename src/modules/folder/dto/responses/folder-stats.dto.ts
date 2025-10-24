import { ApiProperty } from '@nestjs/swagger';

export class FolderStatsDto {
  @ApiProperty({
    description: 'Number of files in the folder and all subfolders',
    example: 523,
    minimum: 0,
  })
  fileCount: number;

  @ApiProperty({
    description:
      'Whether file count is exact or capped at the maximum file count limit',
    example: true,
  })
  isFileCountExact: boolean;

  @ApiProperty({
    description: 'Total size in bytes of all files in folder and subfolders',
    example: 5368709120,
    minimum: 0,
  })
  totalSize: number;

  @ApiProperty({
    description:
      'Whether total size is exact or approximate due to exceeding the maximum items limit',
    example: true,
  })
  isTotalSizeExact: boolean;
}
