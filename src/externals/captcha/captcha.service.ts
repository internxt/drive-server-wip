import { Injectable } from '@nestjs/common';
import axios from 'axios';

import getEnv from '../../config/configuration';

@Injectable()
export class CaptchaService {
  async verifyCaptcha(token: string): Promise<boolean> {
    if (!getEnv().isProduction) {
      return true;
    }
    try {
      const response = await axios.post(getEnv().apis.captcha.url, {
        secret: getEnv().secrets.captcha,
        response: token,
      });

      return response.data.success;
    } catch (error) {
      return false;
    }
  }
}
