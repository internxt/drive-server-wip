import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IncompleteCheckoutDto } from './incomplete-checkout.dto';

describe('IncompleteCheckoutDto', () => {
  describe('validate complete_checkout_url', () => {
    it('When valid HTTPS drive URL is passed, then no errors should be returned', async () => {
      const checkoutData = {
        complete_checkout_url: 'https://drive.internxt.com/checkout/complete',
      };
      const dto = plainToInstance(IncompleteCheckoutDto, checkoutData);

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('When valid HTTPS URL with different domain is passed, then no errors should be returned', async () => {
      const checkoutData = {
        complete_checkout_url: 'https://checkout.example.com/complete?id=12345',
      };
      const dto = plainToInstance(IncompleteCheckoutDto, checkoutData);

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('When valid HTTPS URL is passed, then no errors should be returned', async () => {
      const checkoutData = {
        complete_checkout_url: 'https://example.com/checkout/complete',
      };
      const dto = plainToInstance(IncompleteCheckoutDto, checkoutData);

      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('When invalid URL without protocol is passed, then validation error should be returned', async () => {
      const checkoutData = {
        complete_checkout_url: 'invalid-url',
      };
      const dto = plainToInstance(IncompleteCheckoutDto, checkoutData);

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('complete_checkout_url');
    });

    it('When malformed URL is passed, then validation error should be returned', async () => {
      const checkoutData = {
        complete_checkout_url: 'not-a-valid-url',
      };
      const dto = plainToInstance(IncompleteCheckoutDto, checkoutData);

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('complete_checkout_url');
    });

    it('When empty string is passed, then validation error should be returned', async () => {
      const checkoutData = {
        complete_checkout_url: '',
      };
      const dto = plainToInstance(IncompleteCheckoutDto, checkoutData);

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('complete_checkout_url');
    });
  });
});
