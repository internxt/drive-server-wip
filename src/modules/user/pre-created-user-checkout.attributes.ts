import { type PreCreatedUserStatus } from './pre-created-users.attributes';

export interface PreCreatedUserCheckoutAttributes {
  networkUuid: string;
  email: string;
  status: PreCreatedUserStatus;
  tierId: string | null;
  setupEmailSentAt: Date | null;
  setupEmailResendCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}
