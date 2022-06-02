import { Injectable, Logger } from '@nestjs/common';
import { AesService } from './aes.service';
import CryptoJS from 'crypto-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CryptoService {
  private cryptoSecret: string;
  constructor(
    private aesService: AesService,
    private configService: ConfigService,
  ) {
    this.cryptoSecret = configService.get('secrets.cryptoSecret');
  }

  encryptName(name, salt) {
    if (salt) {
      return this.aesService.encrypt(name, salt, salt === undefined);
    }
    return this.probabilisticEncryption(name);
  }

  probabilisticEncryption(content) {
    try {
      const b64 = CryptoJS.AES.encrypt(
        content,
        this.configService.get('secrets').cryptoSecret,
      ).toString();
      const e64 = CryptoJS.enc.Base64.parse(b64);
      const eHex = e64.toString(CryptoJS.enc.Hex);

      return eHex;
    } catch (error) {
      Logger.error(`(probabilisticEncryption): ${error}`);

      return null;
    }
  }

  /* DECRYPT */

  decryptName(cipherText, salt) {
    if (salt) {
      try {
        return this.aesService.decrypt(cipherText, salt);
      } catch (e) {
        // no op
      }
      // If salt is provided, we could have 2 scenarios
      // 1. The cipherText is truly encripted with salt in a deterministic way
      const decrypted = this.deterministicDecryption(cipherText, salt);

      if (!decrypted) {
        // 2. The deterministic algorithm failed although salt were provided.
        // So, the cipherText is encrypted in a probabilistic way.

        return this.probabilisticDecryption(cipherText);
      }

      return decrypted;
    }
    // If no salt, something is trying to use legacy decryption
    return this.probabilisticDecryption(cipherText);
  }

  deterministicDecryption(cipherText, salt) {
    try {
      const key = CryptoJS.enc.Hex.parse(this.cryptoSecret);
      const iv = salt ? CryptoJS.enc.Hex.parse(salt.toString()) : key;

      const reb64 = CryptoJS.enc.Hex.parse(cipherText);
      const bytes = reb64.toString(CryptoJS.enc.Base64);
      const decrypt = CryptoJS.AES.decrypt(bytes, key, { iv });
      const plain = decrypt.toString(CryptoJS.enc.Utf8);

      return plain;
    } catch (e) {
      return null;
    }
  }

  probabilisticDecryption(cipherText) {
    try {
      const reb64 = CryptoJS.enc.Hex.parse(cipherText);
      const bytes = reb64.toString(CryptoJS.enc.Base64);
      const decrypt = CryptoJS.AES.decrypt(bytes, this.cryptoSecret);
      const plain = decrypt.toString(CryptoJS.enc.Utf8);

      return plain;
    } catch (error) {
      Logger.error(`(probabilisticDecryption): ${error}`);

      return null;
    }
  }
  
}
