import { ApiProperty } from '@nestjs/swagger';

export class SendNetworkTokenResponseDto {
  @ApiProperty({ description: 'Basic auth username for the network' })
  user: string;

  @ApiProperty({
    description:
      'Temporary basic auth password for the network to upload and download files',
  })
  token: string;

  @ApiProperty({ description: 'Bucket the token gives access to' })
  bucketId: string;

  @ApiProperty({ description: 'Seconds until the token expires' })
  expiresIn: number;
}
