import { ApiProperty } from '@nestjs/swagger';

export class GetUserUploadLimitsDto {
  @ApiProperty({
    description: 'Maximum file size in bytes',
    type: Number,
    example: 104857600,
    nullable: true,
  })
  maxFileSize: number | null;

  @ApiProperty({
    description: 'User tier ID',
    type: String,
    example: 'pro_000000',
    nullable: true,
  })
  tierId: string | null;
}
