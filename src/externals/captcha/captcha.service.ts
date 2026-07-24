import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { encode } from 'querystring';

import getEnv from '../../config/configuration';

@Injectable()
export class CaptchaService {
  async verifyCaptcha(token: string, ip: string): Promise<boolean> {
    if (!getEnv().isProduction) {
      return true;
    }

    try {
      return getEnv().apis.captcha.provider === 'turnstile'
        ? await this.verifyTurnstile(token, ip)
        : await this.verifyRecaptcha(token, ip);
    } catch (error) {
      Logger.error(
        `[AUTH/CAPTCHA_VERIFICATION] Error while verifying the captcha token: ${error}`,
      );
      return false;
    }
  }

  private async verifyRecaptcha(token: string, ip: string): Promise<boolean> {
    const response = await axios.post(
      getEnv().apis.captcha.url,
      encode({
        secret: getEnv().secrets.captcha,
        response: token,
        remoteip: ip,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!response.data.success) {
      throw new Error(
        'Captcha verification failed ' + response.data['error-codes'],
      );
    }

    const score = response.data.score;

    if (score < getEnv().apis.captcha.threshold) {
      throw new Error(`Score ${score} is below threshold`);
    }

    return response.data.success;
  }

  private async verifyTurnstile(token: string, ip: string): Promise<boolean> {
    const response = await axios.post(
      getEnv().apis.captcha.turnstileUrl,
      encode({
        secret: getEnv().secrets.turnstileCaptcha,
        response: token,
        remoteip: ip,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!response.data.success) {
      throw new Error(
        'Turnstile verification failed ' + response.data['error-codes'],
      );
    }

    return response.data.success;
  }
}
