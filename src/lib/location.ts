import geoip from 'geoip-lite';

export type Location = {
  country: string;
  region: string;
  city: string;
  timezone: string;
};

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function getCountryName(code: string): string {
  if (!code || code === 'ZZ') {
    return '';
  }

  try {
    const name = countryNames.of(code);

    return name && name !== code ? name : '';
  } catch {
    return '';
  }
}

export function getLocation(ip: string): Location | null {
  if (!ip) {
    return null;
  }

  try {
    const location = geoip.lookup(ip);

    if (!location) {
      return null;
    }

    return {
      country: getCountryName(location.country),
      region: location.region,
      city: location.city,
      timezone: location.timezone,
    };
  } catch {
    return null;
  }
}
