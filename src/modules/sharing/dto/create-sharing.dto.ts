import { ApiProperty } from '@nestjs/swagger';
import { Sharing } from '../sharing.domain';
import { IsNotEmpty } from 'class-validator';

export class CreateSharingDto {
  @ApiProperty({
    example: 'uuid',
    description: 'The uuid of the item to share',
  })
  @IsNotEmpty()
  itemId: Sharing['itemId'];

  @ApiProperty({
    example: 'file | folder',
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
    example: false,
    description: 'Maintain previous sharings',
  })
  persistPreviousSharing: boolean;
}
