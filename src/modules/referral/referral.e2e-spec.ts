import { type NestExpressApplication } from '@nestjs/platform-express';
import { HttpStatus } from '@nestjs/common';
import request from 'supertest';
import {
  createTestUser,
  type TestUserContext,
} from '../../../test/helpers/user.helper';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { overrideUserLimit } from '../../../test/helpers/limit.helper';
import { LimitLabels, LimitTypes } from '../feature-limit/limits.enum';
import { PaymentRequiredErrorCode } from '../feature-limit/exceptions/payment-required.exception';

describe('Referral module', () => {
  let app: NestExpressApplication;
  let testUser: TestUserContext;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    testUser = await createTestUser(app);
  });

  afterEach(async () => {
    await testUser.cleanup();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /referral/token', () => {
    it('When referral is not in the user plan, then it fails with the feature not in plan error code', async () => {
      await overrideUserLimit(app, {
        userUuid: testUser.user.uuid,
        label: LimitLabels.ReferralAccess,
        type: LimitTypes.Boolean,
        value: 'false',
      });

      const response = await request(app.getHttpServer())
        .post('/referral/token')
        .set('Authorization', `bearer ${testUser.token}`);

      expect(response.status).toBe(HttpStatus.PAYMENT_REQUIRED);
      expect(response.body).toEqual({
        message: expect.any(String),
        errorCode: PaymentRequiredErrorCode.FeatureNotInPlan,
      });
    });
  });
});
