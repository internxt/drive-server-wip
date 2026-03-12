export interface TrackSignupParams {
  ucc: string;
  userId: string;
  email: string;
  name: string;
}

export interface TrackPurchaseParams extends TrackSignupParams {
  price: number;
  currency: string;
  invoiceId: string;
  interval: string;
  productKey: string;
  subscriptionId: string;
}

export abstract class ReferralService {
  abstract generateToken(productUserId: string): string;
  abstract trackPurchaseEvent(params: TrackPurchaseParams): Promise<void>;
}
