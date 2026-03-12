import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { verify } from 'jsonwebtoken';
import { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { HttpClientModule } from '../../externals/http/http.module';
import { HttpClient } from '../../externals/http/http.service';
import { CelloReferralService } from './cello-referral.service';
import { type TrackPurchaseParams } from './referral.service';

describe('CelloReferralService', () => {
  let service: CelloReferralService;
  let httpClient: HttpClient;

  const celloConfig = {
    'cello.productId': 'test-product-id',
    'cello.productSecret': 'test-product-secret',
    'cello.apiUrl': 'https://api.cello.test',
    'cello.apiAccessKey': 'test-access-key',
  };

  const tokenResponse: AxiosResponse = {
    data: { accessToken: 'cello-access-token', expiresIn: 3600 },
    status: 200,
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    statusText: 'OK',
  };

  const eventResponse: AxiosResponse = {
    data: null,
    status: 200,
    headers: {},
    config: {} as InternalAxiosRequestConfig,
    statusText: 'OK',
  };

  const purchaseParams: TrackPurchaseParams = {
    ucc: 'referral-code',
    userId: 'user-uuid',
    email: 'user@test.com',
    name: 'John Doe',
    price: 49.99,
    currency: 'EUR',
    invoiceId: 'inv-123',
    interval: 'month',
    productKey: 'plan-premium',
    subscriptionId: 'sub-456',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, HttpClientModule],
      providers: [CelloReferralService],
    })
      .setLogger(createMock<Logger>())
      .compile();

    service = module.get<CelloReferralService>(CelloReferralService);
    httpClient = module.get<HttpClient>(HttpClient);

    const configService = module.get<ConfigService>(ConfigService);
    jest
      .spyOn(configService, 'get')
      .mockImplementation((key: string) => celloConfig[key]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('generateToken', () => {
    it('When called, then it returns a valid JWT signed with HS512', () => {
      const token = service.generateToken('user-uuid');

      const decoded = verify(token, celloConfig['cello.productSecret'], {
        algorithms: ['HS512'],
      }) as Record<string, unknown>;

      expect(decoded.productId).toBe(celloConfig['cello.productId']);
      expect(decoded.productUserId).toBe('user-uuid');
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('trackPurchaseEvent', () => {
    it('When called, then it sends a signup event followed by a purchase event', async () => {
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValueOnce(tokenResponse)
        .mockResolvedValueOnce(eventResponse)
        .mockResolvedValueOnce(eventResponse);

      await service.trackPurchaseEvent(purchaseParams);

      expect(postSpy).toHaveBeenCalledTimes(3);

      const signupCall = postSpy.mock.calls[1];
      expect(signupCall[0]).toBe('https://api.cello.test/events');
      expect(signupCall[1]).toMatchObject({
        eventName: 'ReferralUpdated',
        context: { event: { trigger: 'new-signup' } },
      });

      const purchaseCall = postSpy.mock.calls[2];
      expect(purchaseCall[0]).toBe('https://api.cello.test/events');
      expect(purchaseCall[1]).toMatchObject({
        eventName: 'ReferralUpdated',
        payload: { price: 49.99, currency: 'EUR' },
        context: {
          event: { trigger: 'invoice-paid' },
          subscription: {
            id: 'sub-456',
            invoiceId: 'inv-123',
            interval: 'month',
            productKey: 'plan-premium',
          },
        },
      });
    });

    it('When the token fetch fails, then it propagates the error', async () => {
      jest
        .spyOn(httpClient, 'post')
        .mockRejectedValueOnce(new Error('Cello auth failed'));

      await expect(service.trackPurchaseEvent(purchaseParams)).rejects.toThrow(
        'Cello auth failed',
      );
    });

    it('When the event call fails, then it propagates the error', async () => {
      jest
        .spyOn(httpClient, 'post')
        .mockResolvedValueOnce(tokenResponse)
        .mockRejectedValueOnce(new Error('Cello event failed'));

      await expect(service.trackPurchaseEvent(purchaseParams)).rejects.toThrow(
        'Cello event failed',
      );
    });
  });

  describe('API token caching', () => {
    it('When called twice, then it reuses the cached token instead of fetching again', async () => {
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValueOnce(tokenResponse)
        .mockResolvedValue(eventResponse);

      await service.trackPurchaseEvent(purchaseParams);
      await service.trackPurchaseEvent(purchaseParams);

      const tokenFetchCalls = postSpy.mock.calls.filter(
        (call) => call[0] === 'https://api.cello.test/token',
      );
      expect(tokenFetchCalls).toHaveLength(1);
    });

    it('When concurrent calls are made, then only one token fetch is executed', async () => {
      const postSpy = jest
        .spyOn(httpClient, 'post')
        .mockResolvedValueOnce(tokenResponse)
        .mockResolvedValue(eventResponse);

      await Promise.all([
        service.trackPurchaseEvent(purchaseParams),
        service.trackPurchaseEvent(purchaseParams),
      ]);

      const tokenFetchCalls = postSpy.mock.calls.filter(
        (call) => call[0] === 'https://api.cello.test/token',
      );
      expect(tokenFetchCalls).toHaveLength(1);
    });
  });
});
