import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export function encodeCursor<T>(cursor: T): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

function validateCursor<T extends object>(
  cursorClass: new () => T,
  decodedPayload: unknown,
): T | null {
  const instance = plainToInstance(cursorClass, decodedPayload);
  const errors = validateSync(instance as object);

  return errors.length === 0 ? instance : null;
}

export function decodeCursor<T extends object>(
  cursorClass: new () => T,
  token: string,
): T | null {
  try {
    const decodedPayload = JSON.parse(
      Buffer.from(token, 'base64').toString('utf-8'),
    );

    return validateCursor(cursorClass, decodedPayload);
  } catch {
    return null;
  }
}
