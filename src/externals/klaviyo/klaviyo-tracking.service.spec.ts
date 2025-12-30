import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KlaviyoTrackingService } from './klaviyo-tracking.service';
import axios, { AxiosResponse } from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KlaviyoTrackingService', () => {
  let service: KlaviyoTrackingService;
  const mockApiKey = 'test-klaviyo-api-key';
  const mockBaseUrl = 'https://a.klaviyo.com/api';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KlaviyoTrackingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'klaviyo.apiKey') return mockApiKey;
              if (key === 'klaviyo.baseUrl') return mockBaseUrl;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<KlaviyoTrackingService>(KlaviyoTrackingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackCheckoutStarted', () => {
    const mockEmail = 'test@internxt.com';
    const mockCheckoutData = {
      checkoutUrl: 'https://drive.internxt.com/checkout/complete',
      planName: 'Premium',
      price: 725,
    };

    it('When tracking checkout with valid data, then should call Klaviyo API with correct payload', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      } as AxiosResponse);

      await service.trackCheckoutStarted(mockEmail, mockCheckoutData);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockBaseUrl}/events/`,
        {
          data: {
            type: 'event',
            attributes: {
              profile: {
                data: {
                  type: 'profile',
                  attributes: { email: mockEmail },
                },
              },
              metric: {
                data: {
                  type: 'metric',
                  attributes: { name: 'Started Checkout' },
                },
              },
              properties: {
                checkout_url: mockCheckoutData.checkoutUrl,
                plan_name: mockCheckoutData.planName,
                price: mockCheckoutData.price,
                $value: mockCheckoutData.price,
              },
              time: expect.any(String),
            },
          },
        },
        {
          headers: {
            Authorization: `Klaviyo-API-Key ${mockApiKey}`,
            'Content-Type': 'application/json',
            revision: '2024-10-15',
          },
        },
      );
    });

    it('When tracking checkout with minimal data (no plan or price), then should call API successfully', async () => {
      const minimalCheckoutData = {
        checkoutUrl: 'https://drive.internxt.com/checkout/complete',
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      } as AxiosResponse);

      await service.trackCheckoutStarted(mockEmail, minimalCheckoutData);

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const callArgs = mockedAxios.post.mock.calls[0];
      const payload = callArgs[1] as any;

      expect(payload.data.attributes.properties).toMatchObject({
        checkout_url: minimalCheckoutData.checkoutUrl,
        plan_name: undefined,
        price: undefined,
        $value: undefined,
      });
    });

    it('When Klaviyo API returns error, then should throw error', async () => {
      const apiError = new Error('Request failed with status code 400');
      (apiError as any).response = {
        status: 400,
        data: { message: 'Invalid request' },
      };

      mockedAxios.post.mockRejectedValueOnce(apiError);

      await expect(
        service.trackCheckoutStarted(mockEmail, mockCheckoutData),
      ).rejects.toThrow('Request failed with status code 400');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('When Klaviyo API is unavailable, then should throw error', async () => {
      const networkError = new Error('Network Error');

      mockedAxios.post.mockRejectedValueOnce(networkError);

      await expect(
        service.trackCheckoutStarted(mockEmail, mockCheckoutData),
      ).rejects.toThrow('Network Error');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('When API key is configured, then should include it in headers', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      } as AxiosResponse);

      await service.trackCheckoutStarted(mockEmail, mockCheckoutData);

      const callArgs = mockedAxios.post.mock.calls[0];
      const config = callArgs[2] as any;

      expect(config.headers.Authorization).toBe(
        `Klaviyo-API-Key ${mockApiKey}`,
      );
    });

    it('When tracking checkout, then should use ISO timestamp', async () => {
      const beforeCall = new Date().toISOString();

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      } as AxiosResponse);

      await service.trackCheckoutStarted(mockEmail, mockCheckoutData);

      const callArgs = mockedAxios.post.mock.calls[0];
      const payload = callArgs[1] as any;
      const timestamp = payload.data.attributes.time;

      expect(timestamp).toBeDefined();
      expect(new Date(timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeCall).getTime(),
      );
    });

    it('When tracking multiple checkouts, then should call API for each one', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      } as AxiosResponse);

      await service.trackCheckoutStarted('user1@internxt.com', {
        checkoutUrl: 'https://example.com/1',
        planName: 'Basic',
        price: 100,
      });

      await service.trackCheckoutStarted('user2@internxt.com', {
        checkoutUrl: 'https://example.com/2',
        planName: 'Premium',
        price: 200,
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('When email contains special characters, then should handle correctly', async () => {
      const specialEmail = 'test+special@internxt.com';

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      } as AxiosResponse);

      await service.trackCheckoutStarted(specialEmail, mockCheckoutData);

      const callArgs = mockedAxios.post.mock.calls[0];
      const payload = callArgs[1] as any;

      expect(payload.data.attributes.profile.data.attributes.email).toBe(
        specialEmail,
      );
    });
  });
});
