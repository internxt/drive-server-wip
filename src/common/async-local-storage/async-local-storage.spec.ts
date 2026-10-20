import { ClsServiceManager } from 'nestjs-cls';
import {
  getAsyncLocalStorage,
  type AsyncLocalStorageData,
  initAsyncLocalStorage,
} from './async-local-storage';

const cls = ClsServiceManager.getClsService<AsyncLocalStorageData>();

const runWithHeaders = <T>(headers: Record<string, string>, fn: () => T): T =>
  cls.run(() => {
    initAsyncLocalStorage(cls, { headers } as unknown as Request);
    return fn();
  });

describe('Async local storage', () => {
  it('When there is no active context, then it returns null', () => {
    const result = getAsyncLocalStorage();

    expect(result).toBeNull();
  });

  it('When the client is sent in internxt-client, then it is stored', () => {
    const headers = {
      'internxt-client': 'drive-web',
      'internxt-version': '1.2.3',
    };

    const result = runWithHeaders(headers, getAsyncLocalStorage);

    expect(result).toEqual({ client: 'drive-web', version: '1.2.3' });
  });

  it('When the client is sent in internxt-client-id, then it is stored', () => {
    const headers = { 'internxt-client-id': 'drive-web' };

    const result = runWithHeaders(headers, getAsyncLocalStorage);

    expect(result.client).toBe('drive-web');
  });

  it.each([
    ['missing', {}],
    ['invalid', { 'internxt-version': 'not-a-version' }],
  ])(
    'When the version is %s, then it is stored as null',
    (_label, headers: Record<string, string>) => {
      const result = runWithHeaders(headers, getAsyncLocalStorage);

      expect(result.version).toBeNull();
    },
  );

  it.each([
    ['2.7.0.89', '2.7.0'],
    ['2.6.8.87', '2.6.8'],
    ['2.7.1', '2.7.1'],
    ['v2.7.1', '2.7.1'],
    ['2.7', '2.7.0'],
  ])(
    'When the version is %s, then it is coerced to %s',
    (rawVersion, expected) => {
      const headers = {
        'internxt-client': 'drive-desktop-macos',
        'internxt-version': rawVersion,
      };

      const result = runWithHeaders(headers, getAsyncLocalStorage);

      expect(result.version).toBe(expected);
    },
  );

  it.each(['unknown-client', 'constructor', '__proto__'])(
    'When the client is %s, then it is stored as null',
    (client) => {
      const headers = { 'internxt-client': client };

      const result = runWithHeaders(headers, getAsyncLocalStorage);

      expect(result.client).toBeNull();
    },
  );

  it('When the context is read after an async boundary, then it is kept', async () => {
    const headers = {
      'internxt-client': 'drive-web',
      'internxt-version': '1.2.3',
    };

    const result = await runWithHeaders(headers, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return getAsyncLocalStorage();
    });

    expect(result).toEqual({ client: 'drive-web', version: '1.2.3' });
  });
});
