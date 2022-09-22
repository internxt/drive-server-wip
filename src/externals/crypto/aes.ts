// AES Encryption/Decryption with AES-256-GCM using random Initialization Vector + Salt
// ----------------------------------------------------------------------------------------
// the encrypted datablock is base64 encoded for easy data exchange.
// if you have the option to store data binary save consider to remove the encoding to reduce storage size
// ----------------------------------------------------------------------------------------
// format of encrypted data - used by this example. not an official format
//
// +--------------------+-----------------------+----------------+----------------+
// | SALT               | Initialization Vector | Auth Tag       | Payload        |
// | Used to derive key | AES GCM XOR Init      | Data Integrity | Encrypted Data |
// | 64 Bytes, random   | 16 Bytes, random      | 16 Bytes       | (N-96) Bytes   |
// +--------------------+-----------------------+----------------+----------------+
//
// ----------------------------------------------------------------------------------------
// Input/Output Vars
//
// MASTERKEY: the key used for encryption/decryption.
//            it has to be cryptographic safe - this means randomBytes or derived by pbkdf2 (for example)
// TEXT:      data (utf8 string) which should be encoded. modify the code to use Buffer for binary data!
// ENCDATA:   encrypted data as base64 string (format mentioned on top)
import crypto from 'crypto';

export class AesService {
  constructor(
    private readonly magicIv: string,
    private readonly magicSalt: string,
    private readonly cryptoKey: string,
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.magicIv) {
      throw new Error('AES SERVICE: Missing magic IV');
    }

    if (!this.magicSalt) {
      throw new Error('AES SERVICE: Missing magic salt');
    }

    if (!this.cryptoKey) {
      throw new Error('AES SERVICE: Missing crytpo key');
    }
  }

  encrypt(text, originalSalt, randomIv = false) {
    // random initialization vector
    const iv = randomIv
      ? crypto.randomBytes(16)
      : Buffer.from(this.magicIv, 'hex');

    // random salt
    const salt = randomIv
      ? crypto.randomBytes(64)
      : Buffer.from(this.magicSalt, 'hex');

    // derive encryption key: 32 byte key length
    // in assumption the masterkey is a cryptographic and NOT a password there is no need for
    // a large number of iterations. It may can replaced by HKDF
    // the value of 2145 is randomly chosen!
    const key = crypto.pbkdf2Sync(
      `${this.cryptoKey}-${originalSalt}`,
      salt,
      2145,
      32,
      'sha512',
    );

    // AES 256 GCM Mode
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // encrypt the given text
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    // extract the auth tag
    const tag = cipher.getAuthTag();

    // generate output
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  decrypt(encdata, folderId) {
    // base64 decoding
    const bData = Buffer.from(encdata, 'base64');

    // convert data to buffers
    const salt = bData.slice(0, 64);
    const iv = bData.slice(64, 80);
    const tag = bData.slice(80, 96);
    const text = bData.slice(96);

    if (
      salt.length === 0 ||
      iv.length === 0 ||
      tag.length === 0 ||
      text.length === 0
    ) {
      // One empty param makes Node crash
      throw Error('Length 0, cannot decrypt');
    }

    // derive key using; 32 byte key length
    const key = crypto.pbkdf2Sync(
      `${this.cryptoKey}-${folderId}`,
      salt,
      2145,
      32,
      'sha512',
    );

    // AES 256 GCM Mode
    const decipher: crypto.DecipherCCM = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      iv,
    );
    decipher.setAuthTag(tag);

    // encrypt the given text
    const decrypted: string =
      decipher.update(text as unknown as string, 'binary', 'utf8') +
      decipher.final('utf-8');

    return decrypted;
  }
}
