import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

// AES-256-GCM header: salt(64) + iv(16) + tag(16), see src/externals/crypto/aes.ts
const AES_GCM_HEADER_BYTES = 64 + 16 + 16;

/**
 * Validates a key encrypted with AesService.encrypt() (src/externals/crypto/aes.ts).
 * @param exactPayloadBytes if given, decoded blob must be exactly header + this many bytes
 *   (AES-GCM has no padding, so encrypting a known-size plaintext yields a known-size blob)
 */
export function IsEncryptedKeyOfSize(
  exactPayloadBytes?: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEncryptedKeyOfSize',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string' || value.length === 0) {
            return false;
          }

          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
            return false;
          }

          const decoded = Buffer.from(value, 'base64');

          if (exactPayloadBytes !== undefined) {
            return decoded.length === AES_GCM_HEADER_BYTES + exactPayloadBytes;
          }

          return decoded.length > AES_GCM_HEADER_BYTES;
        },
        defaultMessage(args: ValidationArguments) {
          const expected =
            exactPayloadBytes !== undefined
              ? `exactly ${AES_GCM_HEADER_BYTES + exactPayloadBytes} bytes`
              : `more than ${AES_GCM_HEADER_BYTES} bytes`;
          return `${args.property} must be a valid AES-256-GCM encrypted key (base64, salt+iv+tag+payload, ${expected} decoded)`;
        },
      },
    });
  };
}
