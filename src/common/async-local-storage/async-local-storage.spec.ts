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

  it('When the version has 4 segments, then it is coerced to semver', () => {
    const headers = { 'internxt-version': '2.7.0.89' };

    const result = runWithHeaders(headers, getAsyncLocalStorage);

    expect(result.version).toBe('2.7.0');
  });

  it('When the user agent is from rclone, then the client is rclone with the user agent version', () => {
    const headers = { 'user-agent': 'rclone/v1.73.0' };

    const result = runWithHeaders(headers, getAsyncLocalStorage);

    expect(result).toEqual({ client: 'rclone-adapter', version: '1.73.0' });
  });

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
