import geoip from 'geoip-lite';
import { getLocation } from './location';

jest.mock('geoip-lite');

const mockedGeoip = jest.mocked(geoip);

describe('getLocation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('When the ip resolves, then it should map the country name, region, city and timezone', () => {
    mockedGeoip.lookup.mockReturnValue({
      country: 'ES',
      region: 'CT',
      city: 'Barcelona',
      timezone: 'Europe/Madrid',
      ll: [41.3891, 2.1611],
    } as any);

    expect(getLocation('139.47.19.216')).toEqual({
      country: 'Spain',
      region: 'CT',
      city: 'Barcelona',
      timezone: 'Europe/Madrid',
    });
  });

  it('When the country code has no name, then it should leave the country empty so it is not sent', () => {
    mockedGeoip.lookup.mockReturnValue({
      country: 'QQ',
      region: '',
      city: '',
      timezone: 'Europe/Madrid',
    } as any);

    expect(getLocation('139.47.19.216').country).toBe('');
  });

  it('When the country is ZZ, then it should leave it empty instead of the Unknown Region placeholder', () => {
    mockedGeoip.lookup.mockReturnValue({
      country: 'ZZ',
      region: '',
      city: '',
      timezone: 'Europe/Madrid',
    } as any);

    expect(getLocation('139.47.19.216').country).toBe('');
  });

  it('When the country is empty, then it should leave it empty', () => {
    mockedGeoip.lookup.mockReturnValue({
      country: '',
      region: '',
      city: '',
      timezone: 'Europe/Madrid',
    } as any);

    expect(getLocation('139.47.19.216').country).toBe('');
  });

  it('When the ip is empty, then it should return null without querying the database', () => {
    expect(getLocation('')).toBeNull();
    expect(mockedGeoip.lookup).not.toHaveBeenCalled();
  });

  it('When the ip does not resolve, then it should return null', () => {
    mockedGeoip.lookup.mockReturnValue(null);

    expect(getLocation('172.18.0.1')).toBeNull();
  });

  it('When the lookup fails, then it should return null', () => {
    mockedGeoip.lookup.mockImplementation(() => {
      throw new Error('database not available');
    });

    expect(getLocation('139.47.19.216')).toBeNull();
  });
});
