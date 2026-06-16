import CryptoJS from 'crypto-js';

export const encryptMnemonicForTest = (
  mnemonic: string,
  password: string,
): string => {
  const b64 = CryptoJS.AES.encrypt(mnemonic, password).toString();
  const e64 = CryptoJS.enc.Base64.parse(b64);
  return e64.toString(CryptoJS.enc.Hex);
};
