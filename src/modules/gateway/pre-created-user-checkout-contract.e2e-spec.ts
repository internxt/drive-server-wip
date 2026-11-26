import { generateKeyPairSync } from 'crypto';
import { HttpStatus } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Sequelize } from 'sequelize-typescript';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { v4 } from 'uuid';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { createTestUser } from '../../../test/helpers/user.helper';
import { generateValidRegistrationData } from '../../../test/helpers/register.helper';
import { BridgeService } from '../../externals/bridge/bridge.service';
import { MailerService } from '../../externals/mailer/mailer.service';
import { CryptoService } from '../../externals/crypto/crypto.service';
import { CaptchaService } from '../../externals/captcha/captcha.service';
import { UserUseCases } from '../user/user.usecase';

describe('Gateway checkout contract with payments E2E', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const originalGatewayPublicKey = process.env.DRIVE_GATEWAY_PUBLIC_SECRET;

  let app: NestExpressApplication;
  let sequelize: Sequelize;
  let tierId: string;
  let cryptoService: CryptoService;
  let sendAccountSetupEmail: jest.Mock;
  let createdUserUuids: string[] = [];
  let emails: string[] = [];

  const gatewayToken = () =>
    sign({}, privateKey, { algorithm: 'RS256', expiresIn: '5m' });

  const gateway = () => {
    const server = request(app.getHttpServer());
    const auth = `Bearer ${gatewayToken()}`;

    return {
      startCheckout: (email: string) =>
        server
          .post('/gateway/users/pre-create')
          .set('Authorization', auth)
          .send({ email }),
      getCheckout: (email: string) =>
        server
          .get('/gateway/users/pre-create')
          .set('Authorization', auth)
          .query({ email }),
      updateCheckout: (body: Record<string, unknown>) =>
        server
          .patch('/gateway/users/pre-create')
          .set('Authorization', auth)
          .send(body),
      updateUser: (uuid: string, body: Record<string, unknown>) =>
        server
          .patch(`/gateway/users/${uuid}`)
          .set('Authorization', auth)
          .send(body),
      signUp: (data: Record<string, unknown>) =>
        server.post('/users').send(data),
      resendSetupEmail: (email: string) =>
        server
          .post('/users/pre-created-users/setup-email')
          .set('x-internxt-captcha', 'captcha-token')
          .send({ email }),
      completeSetup: (data: Record<string, unknown>) =>
        server
          .post('/users/pre-created-users/complete-setup')
          .set('x-internxt-captcha', 'captcha-token')
          .send(data),
      sendSetupEmail: (uuid: string) =>
        server
          .post(`/gateway/users/${uuid}/setup-email`)
          .set('Authorization', auth)
          .send({ planName: 'Premium 2TB' }),
    };
  };

  const newEmail = async () => {
    const { email } = await generateValidRegistrationData();
    const lowercaseEmail = email.toLowerCase();
    emails.push(lowercaseEmail);
    return lowercaseEmail;
  };

  beforeAll(async () => {
    process.env.DRIVE_GATEWAY_PUBLIC_SECRET =
      Buffer.from(publicKey).toString('base64');
    app = await createTestApp();
    sequelize = app.get(Sequelize);
    const networkUuids = new Map<string, string>();
    const bridge = Object.getPrototypeOf(app.get(BridgeService));
    const mailer = Object.getPrototypeOf(app.get(MailerService));
    bridge.createUser = jest.fn(async (email: string) => {
      if (!networkUuids.has(email)) {
        networkUuids.set(email, v4());
      }
      return { userId: 'network-user', uuid: networkUuids.get(email) };
    });
    bridge.setStorage = jest.fn().mockResolvedValue(undefined);
    sendAccountSetupEmail = jest.fn().mockResolvedValue(undefined);
    mailer.sendAccountSetupEmail = sendAccountSetupEmail;
    cryptoService = app.get(CryptoService);
    Object.getPrototypeOf(app.get(CaptchaService)).verifyCaptcha = jest
      .fn()
      .mockResolvedValue(true);
    const [[tier]] = (await sequelize.query(
      'SELECT id FROM tiers LIMIT 1',
    )) as [{ id: string }[], unknown];
    tierId = tier.id;
  });

  afterEach(async () => {
    for (const uuid of createdUserUuids) {
      await sequelize.query(
        `UPDATE users SET root_folder_id = NULL WHERE uuid = :uuid;
         DELETE FROM keyserver WHERE user_id = (SELECT id FROM users WHERE uuid = :uuid);
         DELETE FROM folders WHERE user_id = (SELECT id FROM users WHERE uuid = :uuid);
         DELETE FROM users WHERE uuid = :uuid;`,
        { replacements: { uuid } },
      );
    }
    createdUserUuids = [];

    if (emails.length === 0) {
      return;
    }

    await sequelize.query(
      'DELETE FROM pre_created_user_checkouts WHERE email IN (:emails)',
      { replacements: { emails } },
    );
    await sequelize.query(
      'DELETE FROM pre_created_users WHERE username IN (:emails)',
      { replacements: { emails } },
    );
    emails = [];
  });

  afterAll(async () => {
    process.env.DRIVE_GATEWAY_PUBLIC_SECRET = originalGatewayPublicKey;
    await app.close();
  });

  it('When payments goes through a purchase, then every step answers as it expects', async () => {
    const email = await newEmail();

    const started = await gateway().startCheckout(email).expect(HttpStatus.OK);
    const { uuid } = started.body;
    expect(started.body).toEqual({ uuid, status: 'awaiting_payment' });

    const startedAgain = await gateway()
      .startCheckout(email)
      .expect(HttpStatus.OK);
    expect(startedAgain.body).toEqual({ uuid, status: 'awaiting_payment' });

    const found = await gateway().getCheckout(email).expect(HttpStatus.OK);
    expect(found.body).toEqual({ uuid, status: 'awaiting_payment' });

    await gateway()
      .updateUser(uuid, { maxSpaceBytes: 2199023255552, tierId })
      .expect(HttpStatus.OK);

    await gateway().sendSetupEmail(uuid).expect(HttpStatus.NO_CONTENT);
    const paid = await gateway().getCheckout(email).expect(HttpStatus.OK);
    expect(paid.body).toEqual({ uuid, status: 'pending_setup' });

    await gateway().sendSetupEmail(uuid).expect(HttpStatus.NO_CONTENT);
  });

  it('When the customer pays and completes the account setup, then the account keeps the checkout uuid and plan', async () => {
    const registrationData = await generateValidRegistrationData();
    const email = registrationData.email.toLowerCase();
    emails.push(email);
    const { email: _email, ...setupData } = {
      ...registrationData,
      password: cryptoService.encryptText(registrationData.password),
      salt: cryptoService.encryptText(registrationData.salt),
    };
    const lastSetupToken = () => {
      const [, { setupUrl }] = sendAccountSetupEmail.mock.calls.at(-1);
      return setupUrl.split('/complete-account/')[1];
    };
    const {
      body: { uuid },
    } = await gateway().startCheckout(email).expect(HttpStatus.OK);
    await gateway()
      .updateUser(uuid, { maxSpaceBytes: 2199023255552, tierId })
      .expect(HttpStatus.OK);
    await gateway().sendSetupEmail(uuid).expect(HttpStatus.NO_CONTENT);

    const blockedSignUp = await gateway()
      .signUp({ ...setupData, email })
      .expect(HttpStatus.FORBIDDEN);
    expect(blockedSignUp.body).toMatchObject({ code: 'AccountSetupPending' });

    await gateway().resendSetupEmail(email).expect(HttpStatus.OK);
    expect(sendAccountSetupEmail).toHaveBeenLastCalledWith(email, {
      setupUrl: expect.stringContaining('/complete-account/'),
    });

    const completed = await gateway()
      .completeSetup({ ...setupData, token: lastSetupToken() })
      .expect(HttpStatus.CREATED);
    createdUserUuids.push(uuid);
    expect(completed.body.user.uuid).toBe(uuid);
    const [[account]] = (await sequelize.query(
      'SELECT tier_id, email_verified FROM users WHERE uuid = :uuid',
      { replacements: { uuid } },
    )) as [{ tier_id: string; email_verified: boolean }[], unknown];
    expect(account).toEqual({ tier_id: tierId, email_verified: true });

    await gateway().getCheckout(email).expect(HttpStatus.NOT_FOUND);
    await gateway().sendSetupEmail(uuid).expect(HttpStatus.NO_CONTENT);
    await gateway().startCheckout(email).expect(HttpStatus.CONFLICT);
  });

  it('When the email was invited to a shared item before buying, then the checkout starts and the setup email can be sent', async () => {
    const email = await newEmail();
    await app.get(UserUseCases).preCreateUser({ email });

    const started = await gateway().startCheckout(email).expect(HttpStatus.OK);
    const { uuid } = started.body;
    expect(started.body).toEqual({ uuid, status: 'awaiting_payment' });

    await gateway().sendSetupEmail(uuid).expect(HttpStatus.NO_CONTENT);
    const paid = await gateway().getCheckout(email).expect(HttpStatus.OK);
    expect(paid.body).toEqual({ uuid, status: 'pending_setup' });
  });

  it('When payments cancels the plan and the customer buys again, then the checkout starts again with the same uuid', async () => {
    const email = await newEmail();
    const {
      body: { uuid },
    } = await gateway().startCheckout(email).expect(HttpStatus.OK);

    await gateway()
      .updateCheckout({ uuid, status: 'cancelled' })
      .expect(HttpStatus.OK);
    const cancelled = await gateway().getCheckout(email).expect(HttpStatus.OK);
    expect(cancelled.body).toEqual({ uuid, status: 'cancelled' });

    const restarted = await gateway()
      .startCheckout(email)
      .expect(HttpStatus.OK);
    expect(restarted.body).toEqual({ uuid, status: 'awaiting_payment' });
  });

  it('When the email already has an account, then starting a checkout is rejected as a conflict', async () => {
    const registered = await createTestUser(app);

    await gateway()
      .startCheckout(registered.user.email)
      .expect(HttpStatus.CONFLICT);

    await registered.cleanup();
  });

  it('When the email has no checkout, then payments gets the not found code it recognizes', async () => {
    const email = await newEmail();

    const response = await gateway()
      .getCheckout(email)
      .expect(HttpStatus.NOT_FOUND);

    expect(response.body).toMatchObject({
      message: 'Pre-created user not found',
      code: 'USER_NOT_FOUND',
    });
  });

  it('When the uuid has no checkout and no account, then the setup email and the updates are rejected as not found', async () => {
    const uuid = v4();

    await gateway().sendSetupEmail(uuid).expect(HttpStatus.NOT_FOUND);
    await gateway()
      .updateCheckout({ uuid, status: 'cancelled' })
      .expect(HttpStatus.NOT_FOUND);
    await gateway()
      .updateUser(uuid, { maxSpaceBytes: 2199023255552 })
      .expect(HttpStatus.NOT_FOUND);
  });
});
