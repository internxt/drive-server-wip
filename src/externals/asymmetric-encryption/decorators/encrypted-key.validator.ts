import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

// AES-256-GCM header: salt(64) + iv(16) + tag(16), see src/externals/crypto/aes.ts
const AES_GCM_HEADER_BYTES = 64 + 16 + 16;

export interface EncryptedKeySizeOptions {
  /** decoded blob must be exactly header + this many payload bytes */
  exactPayloadBytes?: number;
  /** decoded blob's payload bytes must fall within [minPayloadBytes, maxPayloadBytes] */
  minPayloadBytes?: number;
  maxPayloadBytes?: number;
}

/**
 * Validates a key encrypted with AES-256-GCM (base64-encoded, salt+iv+tag+payload).
 * @param sizeOptions exact payload size, or a [min, max] payload size range
 */
export function IsEncryptedKeyOfSize(
  sizeOptions?: number | EncryptedKeySizeOptions,
  validationOptions?: ValidationOptions,
) {
  const options: EncryptedKeySizeOptions =
    typeof sizeOptions === 'number'
      ? { exactPayloadBytes: sizeOptions }
      : (sizeOptions ?? {});

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
          const payloadBytes = decoded.length - AES_GCM_HEADER_BYTES;

          if (options.exactPayloadBytes !== undefined) {
            return payloadBytes === options.exactPayloadBytes;
          }

          if (
            options.minPayloadBytes !== undefined &&
            options.maxPayloadBytes !== undefined
          ) {
            return (
              payloadBytes >= options.minPayloadBytes &&
              payloadBytes <= options.maxPayloadBytes
            );
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
