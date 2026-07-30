export interface FileCursor {
  updatedAt: string;
  uuid: string;
}

export function encodeCursor(cursor: FileCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64');
}

export function decodeCursor(token: string): FileCursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    if (!decoded?.updatedAt || !decoded?.uuid) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
