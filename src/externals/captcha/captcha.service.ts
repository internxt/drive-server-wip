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
        throw Error(
          'Captcha verification failed ' + response.data['error-codes'],
        );
      }

      const score = response.data.score;

      if (score < getEnv().apis.captcha.threshold) {
        throw new Error(`Score ${score} is below threshold`);
      }

      return response.data.success;
    } catch (error) {
      Logger.error(
        `[AUTH/CAPTCHA_VERIFICATION] Error while verifying the captcha token: ${error}`,
      );
      return false;
    }
  }
}
