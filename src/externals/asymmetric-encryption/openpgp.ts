import {
  type Data,
  type MaybeStream,
  type WebStream,
  generateKey,
  readPrivateKey,
  readMessage,
  decrypt,
  readKey,
  encrypt,
  createMessage,
} from 'openpgp';

export async function generateNewKeys(date?: Date): Promise<{
  privateKeyArmored: string;
  publicKeyArmored: string;
  revocationCertificate: string;
}> {
  const { privateKey, publicKey, revocationCertificate } = await generateKey({
    userIDs: [{ email: 'inxt@inxt.com' }],
    curve: 'ed25519',
    date,
  });

  return {
    privateKeyArmored: privateKey,
    publicKeyArmored: Buffer.from(publicKey).toString('base64'),
    revocationCertificate: Buffer.from(revocationCertificate).toString(
      'base64',
    ),
  };
}

export const decryptMessageWithPrivateKey = async ({
  encryptedMessage,
  privateKeyInBase64,
}: {
  encryptedMessage: WebStream<string>;
  privateKeyInBase64: string;
}): Promise<MaybeStream<Data> & WebStream<Uint8Array>> => {
  const privateKey = await readPrivateKey({
    armoredKey: privateKeyInBase64,
  });

  const message = await readMessage({
    armoredMessage: encryptedMessage,
  });

  const { data: decryptedMessage } = await decrypt({
    message,
    decryptionKeys: privateKey,
  });

  return decryptedMessage;
};

export const encryptMessageWithPublicKey = async ({
  message,
  publicKeyInBase64,
}: {
  message: string;
  publicKeyInBase64: string;
}): Promise<WebStream<string>> => {
  const publicKeyArmored = Buffer.from(publicKeyInBase64, 'base64').toString();
  const publicKey = await readKey({ armoredKey: publicKeyArmored });

  const encryptedMessage = await encrypt({
    message: await createMessage({ text: message }),
    encryptionKeys: publicKey,
  });

  return encryptedMessage;
};
