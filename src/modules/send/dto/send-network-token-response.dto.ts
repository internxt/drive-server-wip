import { ApiProperty } from '@nestjs/swagger';

export class SendNetworkTokenResponseDto {
  @ApiProperty({
    description:
      'Temporary token to upload and download files. Send it to the network as basic auth password with username "network-token"',
  })
  token: string;

  @ApiProperty({ description: 'Bucket the token gives access to' })
  bucketId: string;

  @ApiProperty()
  expiresAt: Date;
}
