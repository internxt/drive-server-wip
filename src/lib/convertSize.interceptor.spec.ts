import { ConvertSizeInterceptor } from './convertSize.interceptor';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { File } from 'src/modules/file/file.domain';
import { newFile } from '../../test/fixtures';

describe('ConvertSizeInterceptor', () => {
  let interceptor: ConvertSizeInterceptor;
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          'internxt-client': 'drive-desktop',
          'internxt-version': '2.2.0.50',
          'user-agent': 'mac',
        },
      }),
    }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    interceptor = new ConvertSizeInterceptor();
  });

  describe('when client is drive-desktop, user-agent is mac and client version is less than 2.2.0.50', () => {
    it('should convert size to string when respose is a file object', () => {
      const file = newFile();
      const next: CallHandler = {
        handle: () => of(file),
      };

      interceptor.intercept(context, next).subscribe((data) => {
        expect(data).toEqual({ ...file, size: file.size.toString() });
      });
    });

    it('should convert size to string when respose is an array of file objects', () => {
      const files: File[] = [];
      for (let i = 0; i < 5; i++) {
        files.push(newFile());
      }
      const next: CallHandler = {
        handle: () => of(files),
      };

      interceptor.intercept(context, next).subscribe((data) => {
        expect(data).toEqual(
          files.map((file) => ({ ...file, size: file.size.toString() })),
        );
      });
    });

    it('should convert size to string when response is in the form { result: files[] }', () => {
      const files: File[] = [];
      for (let i = 0; i < 5; i++) {
        files.push(newFile());
      }
      const next: CallHandler = {
        handle: () => of({ result: files }),
      };

      interceptor.intercept(context, next).subscribe((data) => {
        expect(data).toEqual({
          result: files.map((file) => ({
            ...file,
            size: file.size.toString(),
          })),
        });
      });
    });
  });

  describe('when client is not drive-desktop', () => {
    it('should not convert size to string', () => {
      const badContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'internxt-client': 'drive-web',
              'internxt-version': 'v1.2.3.4',
              'user-agent': 'Safari Mac',
            },
          }),
        }),
      };

      const file = newFile();
      const next: CallHandler = {
        handle: () => of(file),
      };

      interceptor
        .intercept(badContext as ExecutionContext, next)
        .subscribe((data) => {
          expect(data).toEqual(file);
        });
    });
  });

  describe('when user-agent is not mac', () => {
    it('should not convert size to string', () => {
      const badContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'internxt-client': 'drive-desktop',
              'internxt-version': '1.2.3.4',
              'user-agent': 'Windows',
            },
          }),
        }),
      };

      const file = newFile();
      const next: CallHandler = {
        handle: () => of(file),
      };

      interceptor
        .intercept(badContext as ExecutionContext, next)
        .subscribe((data) => {
          expect(data).toEqual(file);
        });
    });
  });

  describe('when client version is greater than 2.2.0.50', () => {
    it('should not convert size to string', () => {
      const badContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'internxt-client': 'drive-desktop',
              'internxt-version': '2.2.0.51',
              'user-agent': 'Intel Mac OS X 10_15_7',
            },
          }),
        }),
      };

      const file = newFile();
      const next: CallHandler = {
        handle: () => of(file),
      };

      interceptor
        .intercept(badContext as ExecutionContext, next)
        .subscribe((data) => {
          expect(data).toEqual(file);
        });
    });
  });
});
