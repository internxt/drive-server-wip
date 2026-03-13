export abstract class ReferralService {
  abstract generateToken(productUserId: string): string;
}
