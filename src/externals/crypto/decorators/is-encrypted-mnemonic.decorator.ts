import { applyDecorators } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';

// AES-256-CBC encrypted, hex-encoded BIP39 mnemonic. 24 words only.
// BIP39 word lengths: shortest = 3 chars, longest = 8 chars.
// Min: 3*24 + 23 spaces = 95 chars plaintext → 224 hex chars encrypted.
// Max: 8*24 + 23 spaces = 215 chars plaintext → 480 hex chars encrypted.
// AES-256-CBC: 16-byte blocks + 16-byte "Salted__"+salt header → lengths are multiples of 32 hex chars.
export const IsEncryptedMnemonic = () =>
  applyDecorators(
    IsString(),
    MinLength(224, { message: 'Invalid encrypted mnemonic.' }),
    MaxLength(480, { message: 'Invalid encrypted mnemonic.' }),
  );
