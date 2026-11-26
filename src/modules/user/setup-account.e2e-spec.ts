import { type NestExpressApplication } from '@nestjs/platform-express';
import { getModelToken } from '@nestjs/sequelize';
import { createTestApp } from '../../../test/helpers/test-app.helper';
import { generateValidRegistrationData } from '../../../test/helpers/register.helper';
import { PreCreatedUserStatus } from './pre-created-users.attributes';
import { PreCreatedUserCheckoutModel } from './pre-created-user-checkout.model';
import { PreCreatedUserModel } from './pre-created-users.model';
import { SetupCheckoutAccountUseCase } from './setup-account.usecase';
import { UserUseCases } from './user.usecase';

describe('Pre-created user checkouts E2E', () => {
  let app: NestExpressApplication;
  let setupCheckoutAccount: SetupCheckoutAccountUseCase;
  let userUseCases: UserUseCases;
  let preCreatedUserCheckoutModel: typeof PreCreatedUserCheckoutModel;
  let preCreatedUserModel: typeof PreCreatedUserModel;
  let emails: string[] = [];

  const newEmail = async () => {
    const { email } = await generateValidRegistrationData();
    const lowercaseEmail = email.toLowerCase();
    emails.push(lowercaseEmail);
    return lowercaseEmail;
  };

  beforeAll(async () => {
    app = await createTestApp();
    setupCheckoutAccount = app.get(SetupCheckoutAccountUseCase);
    userUseCases = app.get(UserUseCases);
    preCreatedUserCheckoutModel = app.get(
      getModelToken(PreCreatedUserCheckoutModel),
    );
    preCreatedUserModel = app.get(getModelToken(PreCreatedUserModel));
  });

  afterEach(async () => {
    await preCreatedUserCheckoutModel.destroy({ where: { email: emails } });
    await preCreatedUserModel.destroy({ where: { username: emails } });
    emails = [];
  });

  afterAll(async () => {
    await app.close();
  });

  it('When the email was invited to a shared item, then starting the checkout keeps the uuid of its invitations', async () => {
    const email = await newEmail();
    const [invitedUser] = await userUseCases.preCreateUser({ email });

    const checkout = await setupCheckoutAccount.getOrCreate(email);

    const preCreatedUser = await preCreatedUserModel.findOne({
      where: { username: email },
    });
    expect(preCreatedUser.uuid).toBe(invitedUser.uuid);
    expect(checkout.uuid).not.toBe(invitedUser.uuid);
    expect(checkout.status).toBe(PreCreatedUserStatus.AwaitingPayment);
  });

  it('When the checkout is started twice, then the same checkout is returned', async () => {
    const email = await newEmail();

    const first = await setupCheckoutAccount.getOrCreate(email);
    const second = await setupCheckoutAccount.getOrCreate(email);

    expect(second).toEqual(first);
    expect(await preCreatedUserCheckoutModel.count({ where: { email } })).toBe(
      1,
    );
  });

  it('When a checkout was started before the checkouts had their own table, then it is found and copied there', async () => {
    const email = await newEmail();
    const [legacyCheckout] = await userUseCases.preCreateUser({ email });
    await preCreatedUserModel.update(
      { status: PreCreatedUserStatus.PendingSetup },
      { where: { username: email } },
    );

    const checkout = await setupCheckoutAccount.get(email);

    expect(checkout).toEqual({
      uuid: legacyCheckout.uuid,
      status: PreCreatedUserStatus.PendingSetup,
    });
    const copied = await preCreatedUserCheckoutModel.findByPk(
      legacyCheckout.uuid,
    );
    expect(copied.email).toBe(email);
    expect(copied.status).toBe(PreCreatedUserStatus.PendingSetup);
  });
});
