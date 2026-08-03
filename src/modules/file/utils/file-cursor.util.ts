import { plainToInstance } from 'class-transformer';
import { validateSync, IsISO8601, IsUUID } from 'class-validator';

export class FileUpdatedAtIdCursorDto {
  @IsISO8601()
  updatedAt: string;

  @IsUUID()
  uuid: string;
}

export function encodeCursor<T>(cursor: T): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function validateCursor(decoded: unknown): FileUpdatedAtIdCursorDto | null {
  const instance = plainToInstance(FileUpdatedAtIdCursorDto, decoded);
  const errors = validateSync(instance);

  return errors.length === 0 ? instance : null;
}

export function decodeCursor<T extends FileUpdatedAtIdCursorDto>(
  token: string,
): T | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    return validateCursor(decoded) as T | null;
  } catch {
    return null;
  }
}
