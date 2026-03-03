import {
  Catch,
  type ExceptionFilter,
  type ArgumentsHost,
  ConflictException,
} from '@nestjs/common';
import { UniqueConstraintError } from 'sequelize';

interface DatabaseErrorWithConstraint extends Error {
  constraint?: string;
}

@Catch(UniqueConstraintError)
export class UniqueConstraintFilter implements ExceptionFilter {
  private readonly constraintMessages: Record<string, string> = {
    files_plainname_type_folderid_exists_unique:
      'A file with this name already exists in this location',
    folders_plainname_parentid_key:
      'A folder with this name already exists in this location',
  };

  catch(exception: UniqueConstraintError, _host: ArgumentsHost) {
    if (!(exception instanceof UniqueConstraintError)) {
      throw exception;
    }

    const parent = exception.parent as DatabaseErrorWithConstraint | undefined;
    const message = parent?.constraint
      ? this.constraintMessages[parent.constraint]
      : undefined;

    if (message) {
      throw new ConflictException(message);
    }

    throw exception;
  }
}
