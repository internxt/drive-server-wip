export abstract class ReferralService {
  abstract generateToken(productUserId: string, signupDate: Date): string;
}
