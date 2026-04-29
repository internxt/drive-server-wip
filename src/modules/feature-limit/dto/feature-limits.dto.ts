import { ApiProperty } from '@nestjs/swagger';

export class FeatureLimitsDto {
  @ApiProperty({ nullable: true, type: Number })
  maxUploadFileSize: number | null;
}
