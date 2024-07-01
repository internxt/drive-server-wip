import { ValidateUUIDPipe } from './validate-uuid.pipe';
import { BadRequestException, ArgumentMetadata } from '@nestjs/common';

describe('ValidateUUIDPipe', () => {
  let pipe: ValidateUUIDPipe;

  beforeEach(() => {
    pipe = new ValidateUUIDPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('When uuid given is valid, then it should return the same value', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: null,
      data: 'testUUID',
    };
    expect(pipe.transform(validUUID, metadata)).toEqual(validUUID);
  });

  it('When UUID is invalid, then it should throw', () => {
    const invalidUUID = 'invalid-uuid';
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: null,
      data: 'testUUID',
    };
    expect(() => pipe.transform(invalidUUID, metadata)).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform(invalidUUID, metadata)).toThrow(
      `Value of 'testUUID' is not a valid UUID.`,
    );
  });

  it('When UUID is null, then it should throw', () => {
    const nullUUID = null;
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: null,
      data: 'testUUID',
    };
    expect(() => pipe.transform(nullUUID, metadata)).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform(nullUUID, metadata)).toThrow(
      `Value of 'testUUID' is not a valid UUID.`,
    );
  });

  it('When UUID is undefined, then it should throw', () => {
    const undefinedUUID = undefined;
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: null,
      data: 'testUUID',
    };
    expect(() => pipe.transform(undefinedUUID, metadata)).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform(undefinedUUID, metadata)).toThrow(
      `Value of 'testUUID' is not a valid UUID.`,
    );
  });
});
