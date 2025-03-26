import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpAdapterHost } from '@nestjs/core';
import { ValidationError } from 'sequelize';
import { AxiosError } from 'axios';
import { HttpGlobalExceptionFilter } from './http-global-exception-filter.exception';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { newUser } from '../../test/fixtures';

jest.mock('../modules/auth/decorators/client.decorator', () => ({
  getClientIdFromHeaders: jest.fn().mockReturnValue('drive-web'),
}));

describe('HttpGlobalExceptionFilter', () => {
  let filter: HttpGlobalExceptionFilter;
  let mockHttpAdapter: DeepMocked<HttpAdapterHost['httpAdapter']>;
  let mockHttpAdapterHost: DeepMocked<HttpAdapterHost>;
  let loggerMock: DeepMocked<Logger>;

  beforeEach(async () => {
    mockHttpAdapter = createMock<HttpAdapterHost['httpAdapter']>();
    mockHttpAdapterHost = createMock<HttpAdapterHost>({
      httpAdapter: mockHttpAdapter,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpGlobalExceptionFilter,
        {
          provide: HttpAdapterHost,
          useValue: mockHttpAdapterHost,
        },
      ],
    }).compile();
    loggerMock = createMock<Logger>();
    module.useLogger(loggerMock);
    filter = module.get<HttpGlobalExceptionFilter>(HttpGlobalExceptionFilter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When HttpException is sent, it should format response and not log errors', () => {
    const mockUser = newUser();
    const exceptionMessage = 'Test exception';
    const mockException = new HttpException(
      exceptionMessage,
      HttpStatus.BAD_REQUEST,
    );
    const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

    filter.catch(mockException, mockHost);

    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message: exceptionMessage,
      },
      HttpStatus.BAD_REQUEST,
    );
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  describe('Not HTTP errors logs', () => {
    it('When unexpected error is sent, it should log details and return 500 error', () => {
      const mockUser = newUser();
      const mockException = new Error('Unexpected error');
      const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
          errorId: expect.any(String),
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('When SequelizeError is sent, it should log with DATABASE tag', () => {
      const mockUser = newUser();
      const mockException = new ValidationError(
        'Database validation error',
        [],
      );
      const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(loggerMock.error.mock.calls[0][0]).toContain('[DATABASE]');
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('When AxiosError is sent, it should log with EXTERNAL_SERVICE tag', () => {
      const mockException = new AxiosError(
        'External service error',
        'ETIMEDOUT',
        {} as any,
        {},
        {
          status: 500,
          data: 'Error',
          statusText: 'Error',
          headers: {},
          config: {} as any,
        },
      );
      const mockUser = newUser();
      const mockHost = createMockArgumentsHost('/test-url', 'GET', mockUser);

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(loggerMock.error.mock.calls[0][0]).toContain('[EXTERNAL_SERVICE]');
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    it('When request does not contain user, it should be able to handle it gracefully', () => {
      const mockException = new Error('Unexpected error');
      const mockHost = createMockArgumentsHost('/test-url', 'GET', null);

      filter.catch(mockException, mockHost);

      expect(loggerMock.error).toHaveBeenCalled();
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal Server Error',
        }),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });
  });

  describe('isExceptionObject', () => {
    it('When an object is an exception object, it should return true', () => {
      expect(filter.isExceptionObject(new Error('test'))).toBe(true);
      expect(filter.isExceptionObject({ message: 'test message' })).toBe(true);
    });

    it('When an object is not an exception object, it should return false', () => {
      expect(filter.isExceptionObject({ something: 'else' })).toBe(false);
      expect(filter.isExceptionObject(null)).toBe(false);
      expect(filter.isExceptionObject(undefined)).toBe(false);
    });
  });
});

const createMockArgumentsHost = (
  url: string,
  method: string,
  user: any,
  body: any = {},
) =>
  createMock<ArgumentsHost>({
    switchToHttp: () => ({
      getRequest: () => ({
        url,
        method,
        user,
        body,
      }),
      getResponse: () => ({}),
    }),
  });
