import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SetSharingExpirationDto } from './set-sharing-expiration.dto';

describe('SetSharingExpirationDto Validation', () => {
  it('When the expiration date is a valid ISO date, then it passes', async () => {
    const dto = plainToInstance(SetSharingExpirationDto, {
      linkExpirationDate: '2026-10-31T22:59:59.999Z',
    });

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When the expiration date is missing, then it fails', async () => {
    const dto = plainToInstance(SetSharingExpirationDto, {});

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('When the expiration date is not a date, then it fails', async () => {
    const dto = plainToInstance(SetSharingExpirationDto, {
      linkExpirationDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
