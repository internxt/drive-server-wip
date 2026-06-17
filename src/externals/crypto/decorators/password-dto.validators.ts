import {
  isHexadecimal,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

/**
 * Client sends: AES.encrypt(PBKDF2(password, { keySize: 8 words = 32 bytes })) → hex
 * PBKDF2 → 32 bytes → 64 hex chars plaintext
 * AES-CBC PKCS7 adds padding: 64→80 bytes, prepends 16-byte OpenSSL header → 96 bytes → 192 hex chars
 */

export const ENCRYPTED_PASSWORD_HEX_LENGTH = 192;

export function IsEncryptedPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEncryptedPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'string' &&
            value.length === ENCRYPTED_PASSWORD_HEX_LENGTH &&
            isHexadecimal(value)
          );
        },
        defaultMessage() {
          return `${propertyName} must be a valid encrypted password`;
        },
      },
    });
  };
}

/**
 * Client sends: AES.encrypt(PBKDF2 salt) → hex
 * Salt = random(128/8) = 16 bytes = 32 hex chars plaintext
 * AES-CBC PKCS7 pads 32→48 bytes, prepends 16-byte OpenSSL header → 64 bytes → 128 hex chars
 */

export const ENCRYPTED_SALT_HEX_LENGTH = 128;

export function IsEncryptedSalt(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEncryptedSalt',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return (
            typeof value === 'string' &&
            value.length === ENCRYPTED_SALT_HEX_LENGTH &&
            isHexadecimal(value)
          );
        },
        defaultMessage() {
          return `${propertyName} must be a valid encrypted salt`;
        },
      },
    });
  };
}
