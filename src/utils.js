import crypto from 'crypto';
import config from './config';

function encrypt(publicKey, data) {
  const key = crypto.randomBytes(32);

  const cipher = crypto.createCipheriv('rc4', Buffer.from(key), '');

  const sealedBuf = [];
  sealedBuf.push(cipher.update(Buffer.from(data)));
  sealedBuf.push(cipher.final());

  // Passing length of buffers as second arg excludes 1 loop
  const encrypted = Buffer.concat(sealedBuf, sealedBuf[0].length + sealedBuf[1].length).toString('base64');

  const envKey = crypto.publicEncrypt({
    key: publicKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }, key);

  return {
    envKey: envKey.toString('base64'),
    envData: encrypted,
  };
}

function decrypt(privateKey, envKey, data) {
  const buffer = Buffer.from(envKey, 'base64');

  const decrypted = crypto.privateDecrypt({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  }, buffer);

  const decipher = crypto.createDecipheriv('rc4', decrypted, '');
  return decipher.update(data, 'base64', 'utf8') + decipher.final('utf8');
}

function hash(orderId, amount, currency) {
  const md5 = crypto.createHash('md5').update(config.accountPassword).digest('hex').toString()
    .toUpperCase();

  const text = `${md5}${orderId}${amount}${currency}${config.sellerId}`;

  return crypto.createHash('sha1')
    .update(text)
    .digest('hex').toString()
    .toUpperCase();
}

export default {
  encrypt,
  decrypt,
  hash,
};
