import { ApiProperty } from '@nestjs/swagger';

class VersioningLimitsDto {
  @ApiProperty({
    description: 'Whether file versioning is enabled for this tier',
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Maximum file size in bytes that can be versioned',
  })
  maxFileSize: number;

  @ApiProperty({ description: 'Number of days versions are retained' })
  retentionDays: number;

  @ApiProperty({ description: 'Maximum number of versions kept per file' })
  maxVersions: number;
}

export class GetFileLimitsDto {
  @ApiProperty({ type: VersioningLimitsDto })
  versioning: VersioningLimitsDto;
}
