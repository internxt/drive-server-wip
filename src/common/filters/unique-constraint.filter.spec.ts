import { ConflictException, type ArgumentsHost } from '@nestjs/common';
import { FILTER_CATCH_EXCEPTIONS } from '@nestjs/common/constants';
import { UniqueConstraintError } from 'sequelize';
import { createMock } from '@golevelup/ts-jest';
import { UniqueConstraintFilter } from './unique-constraint.filter';

const makeError = (constraint?: string) => {
  const parent = Object.assign(new Error('unique violation'), {
    constraint,
    sql: '',
  });
  return new UniqueConstraintError({ parent, errors: [], fields: {} });
};

describe('UniqueConstraintFilter', () => {
  let filter: UniqueConstraintFilter;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new UniqueConstraintFilter();
    mockHost = createMock<ArgumentsHost>();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When a file unique constraint is violated, it should throw 409 with the file message', () => {
    const error = makeError('files_plainname_type_folderid_exists_unique');

    expect(() => filter.catch(error, mockHost)).toThrow(
      new ConflictException(
        'A file with this name already exists in this location',
      ),
    );
  });

  it('When a folder unique constraint is violated, it should throw 409 with the folder message', () => {
    const error = makeError('folders_plainname_parentid_key');

    expect(() => filter.catch(error, mockHost)).toThrow(
      new ConflictException(
        'A folder with this name already exists in this location',
      ),
    );
  });

  it('When the constraint is not mapped, it should re-throw the original error', () => {
    const error = makeError('some_unknown_constraint');

    expect(() => filter.catch(error, mockHost)).toThrow(error);
  });

  it('When the parent has no constraint, it should re-throw the original error', () => {
    const error = makeError(undefined);

    expect(() => filter.catch(error, mockHost)).toThrow(error);
  });

  it('When the error has no parent, it should re-throw the original error', () => {
    const error = new UniqueConstraintError({ errors: [], fields: {} });

    expect(() => filter.catch(error, mockHost)).toThrow(error);
  });

  it('When the error is not a Sequelize UniqueConstraintError, it should re-throw it as-is', () => {
    const nonSequelizeError = new Error('some generic error');

    expect(() =>
      filter.catch(
        nonSequelizeError as unknown as UniqueConstraintError,
        mockHost,
      ),
    ).toThrow(nonSequelizeError);
  });

  it('should only catch Sequelize UniqueConstraintError', () => {
    const catchTargets = Reflect.getMetadata(
      FILTER_CATCH_EXCEPTIONS,
      UniqueConstraintFilter,
    );

    expect(catchTargets).toEqual([UniqueConstraintError]);
  });
});
