import { ApiProperty } from '@nestjs/swagger';
import { ClientVersionStatus } from '../client-version-policy.domain';

export class ClientCompatibilityResponseDto {
  @ApiProperty({ enum: ClientVersionStatus })
  status: ClientVersionStatus;

  @ApiProperty({ type: String, nullable: true })
  message: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2.8.1' })
  recommendedVersion: string | null;

  @ApiProperty({ type: Date, nullable: true })
  sunsetAt: Date | null;
}
