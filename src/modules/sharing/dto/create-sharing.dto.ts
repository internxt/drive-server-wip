import { ApiProperty } from '@nestjs/swagger';
import { type Sharing } from '../sharing.domain';
import { IsBase64, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSharingDto {
  @ApiProperty({
    example: 'uuid',
    description: 'The uuid of the item to share',
  })
  @IsNotEmpty()
  itemId: Sharing['itemId'];

  @ApiProperty({
    example: 'file | folder',
    description: 'The type of the resource to share',
  })
  @IsNotEmpty()
  itemType: Sharing['itemType'];

  @ApiProperty({
    example: 'encryption_key',
    description: 'Encryption key',
  })
  @IsNotEmpty()
  encryptionKey: Sharing['encryptionKey'];

  @ApiProperty({
    example: 'encryption_algorithm',
    description: 'Encryption algorithm',
  })
  @IsNotEmpty()
  encryptionAlgorithm: Sharing['encryptionAlgorithm'];

  @ApiProperty({
    example: 'encrypted_code',
    description: 'Encrypted code',
  })
  encryptedCode: Sharing['encryptedCode'];

  @ApiProperty({
    example: 'encrypted_password',
    description: 'Encrypted password',
  })
  @IsOptional()
  @IsBase64()
  encryptedPassword: Sharing['encryptedPassword'];

  @ApiProperty({
    example: false,
    description: 'Maintain previous sharings',
  })
  persistPreviousSharing: boolean;
}
