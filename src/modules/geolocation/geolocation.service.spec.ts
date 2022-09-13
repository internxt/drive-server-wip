import { Test, TestingModule } from '@nestjs/testing';
import { GeolocationService } from './geolocation.service';
describe('GeolocationService', () => {
  let service: GeolocationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeolocationService],
    }).compile();

    service = module.get<GeolocationService>(GeolocationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return location', async () => {
    jest.spyOn(service, 'getLocation').mockImplementationOnce(() =>
      Promise.resolve({
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles',
      }),
    );
    const location = await service.getLocation('192.168.1.0');
    expect(service.getLocation).toHaveBeenCalledTimes(1);
    expect(location).toEqual({
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      timezone: 'America/Los_Angeles',
    });
  });
  it('should return invalid location', async () => {
    jest
      .spyOn(service, 'getLocation')
      .mockRejectedValue(new Error('no location available'));
    await expect(service.getLocation('192')).rejects.toThrow(
      'no location available',
    );
  });
});
