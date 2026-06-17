import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

// AES-256-GCM header: salt(64) + iv(16) + tag(16), see src/externals/crypto/aes.ts
const AES_GCM_HEADER_BYTES = 64 + 16 + 16;

/**
 * Validates a key encrypted with AES-256-GCM (base64-encoded, salt+iv+tag+payload).
 * @param exactPayloadBytes if given, decoded blob must be exactly header + this many bytes
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
          return `${args.property} is not a valid encrypted key`;
        },
      },
    });
  };
}
