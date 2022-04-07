export default {
  baseUrl: process.env.ENVIRONMENT === 'production' ? 'https://secure.mobilpay.ro' : 'http://sandboxsecure.mobilpay.ro',
  returnUrl: process.env.NETOPIA_BASE_URL,
  confirmUrl: process.env.NETOPIA_WEBHOOK_URL,
  sellerId: process.env.NETOPIA_SELLER_ID,
  publicKey: process.env.NETOPIA_PUBLIC_KEY,
  privateKey: process.env.NETOPIA_PRIVATE_KEY,
  accountUsername: process.env.NETOPIA_ACCOUNT_USERNAME,
  accountPassword: process.env.NETOPIA_ACCOUNT_PASSWORD,
  currency: process.env.NETOPIA_CURRENCY,
};
