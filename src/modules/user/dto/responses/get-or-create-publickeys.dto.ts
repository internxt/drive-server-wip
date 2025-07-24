import { ApiProperty } from '@nestjs/swagger';

export class GetOrCreatePublicKeysDto {
  @ApiProperty({
    description: 'Public ecc key',
    example: '',
  })
  publicKey: string;

  @ApiProperty({
    description: 'Public kyber key',
    example: '',
  })
  publicKyberKey: string;
}
