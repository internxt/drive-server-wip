import { ClsServiceManager } from 'nestjs-cls';
import {
  type AsyncLocalStorageData,
  initAsyncLocalStorage,
} from '../async-local-storage/async-local-storage';
import { ClientEnum } from '../enums/platform.enum';
import {
  DeprecatedField,
  DeprecationMode,
  getDeprecationMode,
} from './deprecated-fields';

const cls = ClsServiceManager.getClsService<AsyncLocalStorageData>();

const runWithClient = <T>(client: string, version: string, fn: () => T): T =>
  cls.run(() => {
    initAsyncLocalStorage(cls, {
      headers: { 'internxt-client': client, 'internxt-version': version },
    } as unknown as Request);
    return fn();
  });

describe('getDeprecationMode', () => {
  it('When there is no request context, then it returns null', () => {
    const result = getDeprecationMode(DeprecatedField.FILE_NAME);

    expect(result).toBeNull();
  });

  describe(DeprecatedField.FILE_NAME, () => {
    it.each([
      [ClientEnum.DesktopWindows, '2.6.0', DeprecationMode.PLAIN],
      [ClientEnum.DesktopWindows, '2.7.1', DeprecationMode.PLAIN],
      [ClientEnum.DesktopWindows, '2.5.9', null],
      [ClientEnum.DesktopMacos, '2.6.0', DeprecationMode.PLAIN],
      [ClientEnum.DesktopMacos, '2.5.9', null],
      [ClientEnum.Cli, '1.5.0', DeprecationMode.PLAIN],
      [ClientEnum.Cli, '1.6.10', DeprecationMode.PLAIN],
      [ClientEnum.Cli, '1.4.9', null],
      [ClientEnum.CliLegacy, '1.5.3', DeprecationMode.PLAIN],
      [ClientEnum.Cli, 'undefined', null],
      [ClientEnum.Rclone, 'undefined', DeprecationMode.PLAIN],
      [ClientEnum.Web, '99.0.0', DeprecationMode.PLAIN],
      [ClientEnum.Mobile, '1.12.1', DeprecationMode.PLAIN],
      [ClientEnum.DesktopLegacy, '2.5.2', DeprecationMode.PLAIN],
      [ClientEnum.DesktopLinux, '2.6.2', null],
      [ClientEnum.DesktopLinux, 'undefined', null],
      [ClientEnum.DesktopWindows, 'undefined', null],
      ['constructor', '2.6.0', DeprecationMode.PLAIN],
      ['__proto__', '2.6.0', DeprecationMode.PLAIN],
      ['unknown-client', '2.6.0', DeprecationMode.PLAIN],
      ['internxt-cli-rust', 'undefined', DeprecationMode.PLAIN],
      ['', 'undefined', DeprecationMode.PLAIN],
    ])(
      'When the client is %s with version %s, then it returns %s',
      (client, version, expected) => {
        const result = runWithClient(client, version, () =>
          getDeprecationMode(DeprecatedField.FILE_NAME),
        );

        expect(result).toBe(expected);
      },
    );
  });

  describe(DeprecatedField.FILE_ID, () => {
    it.each([
      [ClientEnum.Mobile, '1.12.2', DeprecationMode.OMIT],
      [ClientEnum.Mobile, '1.13.0', DeprecationMode.OMIT],
      [ClientEnum.Mobile, '1.12.1', null],
      [ClientEnum.Mobile, 'undefined', null],
      [ClientEnum.DesktopWindows, '2.7.3', DeprecationMode.OMIT],
      [ClientEnum.DesktopWindows, '2.8.0', DeprecationMode.OMIT],
      [ClientEnum.DesktopWindows, '2.7.2', null],
      [ClientEnum.DesktopMacos, '2.7.3', null],
      [ClientEnum.Web, '99.0.0', null],
      ['unknown-client', 'undefined', null],
    ])(
      'When the client is %s with version %s, then it returns %s',
      (client, version, expected) => {
        const result = runWithClient(client, version, () =>
          getDeprecationMode(DeprecatedField.FILE_ID),
        );

        expect(result).toBe(expected);
      },
    );
  });
});
