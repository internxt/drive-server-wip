import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';

// Confirmed via kem.publicKeyBytes from @dashlane/pqc-kem-kyber512-node, the lib used in
// src/externals/asymmetric-encryption/providers/kyber.provider.ts.
const KYBER512_PUBLIC_KEY_BYTES = 800;

export function IsKyberPublicKey(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isKyberPublicKey',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string' || value.length === 0) {
            return false;
          }

          try {
            const decoded = Buffer.from(value, 'base64');
            return decoded.length === KYBER512_PUBLIC_KEY_BYTES;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Kyber512 public key (${KYBER512_PUBLIC_KEY_BYTES} bytes base64-encoded)`;
        },
      },
    });
  };
}
