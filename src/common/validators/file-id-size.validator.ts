import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function ValidateFileIdWithSize(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'validateFileIdWithSize',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const sizeNum = Number(obj.size);
          const fileId = value;
          const isProvided = fileId !== undefined && fileId !== null;
          const hasValue = isProvided && fileId !== '';

          if (sizeNum > 0 && !hasValue) {
            return false;
          }

          if (sizeNum === 0 && hasValue) {
            return false;
          }

          if (hasValue && fileId.length > 24) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          const sizeNum = Number(obj.size);
          const fileId = args.value;
          const isProvided = fileId !== undefined && fileId !== null;
          const hasValue = isProvided && fileId !== '';

          if (sizeNum > 0 && !hasValue) {
            return 'fileId is required when size is greater than 0';
          }

          if (sizeNum === 0 && hasValue) {
            return 'fileId must not be provided when size is 0';
          }

          if (hasValue && fileId.length > 24) {
            return 'fileId must not exceed 24 characters';
          }

          return 'Invalid fileId';
        },
      },
    });
  };
}
