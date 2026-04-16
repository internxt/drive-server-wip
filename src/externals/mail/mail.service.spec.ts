import { Test, type TestingModule } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { HttpClient } from '../http/http.service';
import { MailService } from './mail.service';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-gateway-jwt'),
}));

describe('MailService', () => {
  let service: MailService;
  let configService: ConfigService;
  let httpClient: HttpClient;

  const emptyAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as InternalAxiosRequestConfig,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: HttpClient, useValue: { get: jest.fn() } },
      ],
    })
      .setLogger(createMock<Logger>())
      .compile();

    service = module.get(MailService);
    configService = module.get(ConfigService);
    httpClient = module.get(HttpClient);
  });

  describe('findUserIdByAddress', () => {
    const baseUrl = 'https://mail.test';

    beforeEach(() => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'apis.mail.url') return baseUrl;
        if (key === 'isDevelopment') return false;
        if (key === 'secrets.gateway') return 'ZHVtbXk=';
        return undefined;
      });
    });

    it('When the gateway returns a userId, then it returns that userId', async () => {
      const address = 'alias@inxt.eu';
      const userId = 'resolved-user-uuid';
      jest
        .spyOn(httpClient, 'get')
        .mockResolvedValueOnce(emptyAxiosResponse({ userId }));

      const result = await service.findUserIdByAddress(address);

      expect(result).toBe(userId);
      expect(httpClient.get).toHaveBeenCalledWith(
        `${baseUrl}/gateway/addresses/${encodeURIComponent(address)}`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-gateway-jwt',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('When the gateway returns no userId, then it returns null', async () => {
      jest
        .spyOn(httpClient, 'get')
        .mockResolvedValueOnce(emptyAxiosResponse({}));

      const result = await service.findUserIdByAddress('a@inxt.eu');

      expect(result).toBeNull();
    });

    it('When the gateway responds with 404, then it returns null', async () => {
      jest.spyOn(httpClient, 'get').mockRejectedValueOnce({
        response: { status: 404 },
      });

      const result = await service.findUserIdByAddress('missing@inxt.eu');

      expect(result).toBeNull();
    });

    it('When the gateway responds with a non-404 error, then it propagates the error', async () => {
      const err = new Error('upstream');
      jest.spyOn(httpClient, 'get').mockRejectedValueOnce(err);

      await expect(service.findUserIdByAddress('a@inxt.eu')).rejects.toThrow(
        err,
      );
    });
  });
});
