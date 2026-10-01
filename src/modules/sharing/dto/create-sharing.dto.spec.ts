import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSharingDto } from './create-sharing.dto';

describe('CreateSharingDto Validation', () => {
  const validData = {
    itemId: '550e8400-e29b-41d4-a716-446655440000',
    itemType: 'folder',
    encryptionKey: 'encryption-key',
    encryptionAlgorithm: 'inxt-v3',
    encryptedCode: 'encrypted-code',
    persistPreviousSharing: true,
  };

  it('When the link expiration date is omitted, then it passes', async () => {
    const dto = plainToInstance(CreateSharingDto, validData);

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When the link expiration date is a valid ISO date, then it passes', async () => {
    const dto = plainToInstance(CreateSharingDto, {
      ...validData,
      linkExpirationDate: '2026-10-31T22:59:59.999Z',
    });

    const errors = await validate(dto);

    expect(errors.length).toBe(0);
  });

  it('When the link expiration date is not a date, then it fails', async () => {
    const dto = plainToInstance(CreateSharingDto, {
      ...validData,
      linkExpirationDate: 'not-a-date',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('linkExpirationDate');
  });
});
