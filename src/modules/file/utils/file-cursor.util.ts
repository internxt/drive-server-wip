import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { IsInt, IsISO8601 } from 'class-validator';

export class FileUpdatedAtIdCursorDto {
  @IsISO8601()
  updatedAfter: string;

  @IsISO8601()
  updatedAt: string;

  @IsInt()
  id: number;
}

export function encodeCursor<T>(cursor: T): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function validateCursor(decoded: unknown): FileUpdatedAtIdCursorDto | null {
  const instance = plainToInstance(FileUpdatedAtIdCursorDto, decoded);
  const errors = validateSync(instance);

  return errors.length === 0 ? instance : null;
}

export function decodeCursor<T extends FileUpdatedAtIdCursorDto>(token: string): T | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    return validateCursor(decoded) as T | null;
  } catch {
    return null;
  }
}
