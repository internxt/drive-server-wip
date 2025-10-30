import geoip from 'geoip-lite';

type Location = {
  country: string;
  region: string;
  city: string;
  timezone: string;
};

export async function getLocation(ip: string): Promise<Location> {
  try {
    const location = geoip.lookup(ip);
    if (!location) {
      throw new Error('No location available');
    }
    return {
      country: location.country,
      region: location.region,
      city: location.city,
      timezone: location.timezone,
    };
  } catch (err) {
    throw new Error(err.message || 'No message');
  }
}
