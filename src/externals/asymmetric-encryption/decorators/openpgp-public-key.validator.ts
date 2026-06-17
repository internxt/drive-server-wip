import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';
import { readKey } from 'openpgp';

export function IsOpenPgpPublicKey(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isOpenPgpPublicKey',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        async validate(value: any) {
          if (typeof value !== 'string' || value.length === 0) {
            return false;
          }

          try {
            const armoredKey = Buffer.from(value, 'base64').toString();
            const key = await readKey({ armoredKey });
            return !key.isPrivate();
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid OpenPGP public key`;
        },
      },
    });
  };
}
