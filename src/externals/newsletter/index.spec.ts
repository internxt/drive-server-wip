import { Test, type TestingModule } from '@nestjs/testing';
import { NewsletterService } from './index';
import { ConfigService } from '@nestjs/config';
import { HttpClient } from '../http/http.service';
import { createMock } from '@golevelup/ts-jest';

describe('NewsletterService', () => {
  let service: NewsletterService;
  let configService: ConfigService;
  let httpClient: HttpClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NewsletterService],
    })
      .useMocker(createMock)
      .compile();

    service = module.get<NewsletterService>(NewsletterService);
    configService = module.get<ConfigService>(ConfigService);
    httpClient = module.get<HttpClient>(HttpClient);

    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'newsletter.listId') return 'defaultListId';
      if (key === 'newsletter.apiKey') return 'testApiKey';
      if (key === 'klaviyo.baseUrl') return 'https://a.klaviyo.com/api/';
      return null;
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('should subscribe user using default listId if not provided', async () => {
      const email = 'test@example.com';
      jest.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { data: { id: 'prof_123' } },
      } as any);
      jest.spyOn(httpClient, 'post').mockResolvedValueOnce({} as any);

      await service.subscribe(email);

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        'https://a.klaviyo.com/api/profiles/',
        {
          data: {
            type: 'profile',
            attributes: { email },
          },
        },
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Klaviyo-API-Key testApiKey',
            'Content-Type': 'application/json',
            revision: '2024-10-15',
          },
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        'https://a.klaviyo.com/api/lists/defaultListId/relationships/profiles/',
        { data: [{ type: 'profile', id: 'prof_123' }] },
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Klaviyo-API-Key testApiKey',
            'Content-Type': 'application/json',
            revision: '2024-10-15',
          },
        },
      );
    });

    it('should subscribe user using provided listId', async () => {
      const email = 'test@example.com';
      const providedListId = 'providedListId';
      jest.spyOn(httpClient, 'post').mockResolvedValueOnce({
        data: { data: { id: 'prof_123' } },
      } as any);
      jest.spyOn(httpClient, 'post').mockResolvedValueOnce({} as any);

      await service.subscribe(email, providedListId);

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        'https://a.klaviyo.com/api/profiles/',
        expect.any(Object),
        expect.any(Object),
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        'https://a.klaviyo.com/api/lists/providedListId/relationships/profiles/',
        { data: [{ type: 'profile', id: 'prof_123' }] },
        expect.any(Object),
      );
    });
  });
});
