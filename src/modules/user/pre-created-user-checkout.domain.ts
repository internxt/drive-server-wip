import { type PreCreatedUserCheckoutAttributes } from './pre-created-user-checkout.attributes';
import { PreCreatedUserStatus } from './pre-created-users.attributes';

export class PreCreatedUserCheckout implements PreCreatedUserCheckoutAttributes {
  networkUuid: string;
  email: string;
  status: PreCreatedUserStatus;
  tierId: string | null;
  setupEmailSentAt: Date | null;
  setupEmailResendCount: number;
  createdAt?: Date;
  updatedAt?: Date;

  private constructor({
    networkUuid,
    email,
    status,
    tierId,
    setupEmailSentAt,
    setupEmailResendCount,
    createdAt,
    updatedAt,
  }: PreCreatedUserCheckoutAttributes) {
    this.networkUuid = networkUuid;
    this.email = email;
    this.status = status;
    this.tierId = tierId ?? null;
    this.setupEmailSentAt = setupEmailSentAt ?? null;
    this.setupEmailResendCount = setupEmailResendCount ?? 0;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static build(
    attributes: PreCreatedUserCheckoutAttributes,
  ): PreCreatedUserCheckout {
    return new PreCreatedUserCheckout(attributes);
  }

  isAwaitingPayment(): boolean {
    return this.status === PreCreatedUserStatus.AwaitingPayment;
  }

  isPendingSetup(): boolean {
    return this.status === PreCreatedUserStatus.PendingSetup;
  }

  hasStarted(): boolean {
    return this.isAwaitingPayment() || this.isPendingSetup();
  }

  hasPendingAccountSetup(): boolean {
    const hasPaidBeforeTheSetupEmail =
      this.isAwaitingPayment() && this.tierId != null;

    return this.isPendingSetup() || hasPaidBeforeTheSetupEmail;
  }
}
