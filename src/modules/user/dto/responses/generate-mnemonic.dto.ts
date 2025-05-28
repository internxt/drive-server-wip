import { ApiProperty } from '@nestjs/swagger';

export class GenerateMnemonicResponseDto {
  @ApiProperty({
    description: 'A plain mnemonic',
    example:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    type: String,
  })
  mnemonic: string;
}
