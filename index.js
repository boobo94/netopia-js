import xml2js from 'xml2js';
import axios from 'axios';
import config from './config';
import utils from './utils';

const builder = new xml2js.Builder({
  cdata: true,
});

const parser = new xml2js.Parser({
  explicitArray: false,
  tagNameProcessors: [xml2js.processors.stripPrefix],
  attrNameProcessors: [xml2js.processors.stripPrefix],
});

axios.defaults.headers = {
  'Content-Type': 'application/xml',
};

/**
 * Parse the xml response
 * @param {string} responseXML The xml response send by Netopia
 * @returns
 */
async function parseResponse(responseXML) {
  return new Promise((resolve, reject) => {
    parser.parseString(responseXML, (err, result) => {
      if (err) {
        reject(err);
      }
      resolve(result);
    });
  });
}

function prepareParamsForNetopia(params) {
  const preparedParams = [];
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined) {
      preparedParams.push({
        name: key,
        value: params[key],
      });
    }
  });

  return preparedParams;
}

function parseAndSetParams(netopiaResponse) {
  if (netopiaResponse.order && netopiaResponse.order.params) {
    netopiaResponse.order.params.param.forEach((param) => {
      // eslint-disable-next-line no-param-reassign
      netopiaResponse.order.params[param.name] = param.value;
    });
  }
}

/**
 * Parse xml response encoded
 * @param {string} responseXML The xml response send by Netopia on IPN
 * @returns
 */
async function parseIPNResponse(responseXML) {
  const decoded = await parseResponse(
    utils.decrypt(config.privateKey, responseXML.env_key, responseXML.data),
  );

  const response = builder.buildObject({
    crc: 'success',
  });

  // add params to the response object
  parseAndSetParams(decoded);

  return {
    decoded,
    response,
    success: decoded.order.mobilpay.error.$.code === '0',
  };
}

/**
 * Generate unique id
 * @returns {string} unique id
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Create simple payment by card
 * This method creates a token that can be used for future payments.
 *
 * @param {String} amount
 * @param {Object} billing Billing information
 *  (firstName, lastName, address, email, phone, description) required and
 *  (country, county, city, postalCode, type[person | company, default: person]) optional
 * @returns string
 */
async function createPayment(amount, billing) {
  const xml = builder.buildObject({
    order: {
      $: {
        id: uid(), // generate new orderId
        timestamp: new Date().getTime(),
        type: 'card',
      },
      signature: config.sellerId,
      url: {
        return: config.returnUrl,
        confirm: config.confirmUrl,
      },
      invoice: {
        $: {
          currency: config.currency,
          amount,
        },
        details: billing.description,
        contact_info: {
          billing: {
            $: {
              type: billing.type || 'person',
            },
            first_name: billing.firstName,
            last_name: billing.lastName,
            address: billing.address,
            email: billing.email,
            mobile_phone: billing.phone,
          },
          shipping: {
            $: {
              type: billing.type || 'person',
            },
            first_name: billing.firstName,
            last_name: billing.lastName,
            address: billing.address,
            email: billing.email,
            mobile_phone: billing.phone,
          },
        },
      },
    },
  });

  const body = utils.encrypt(config.publicKey, xml);

  return `
        <form id="paymentForm" method="post" action="${config.baseUrl}">
          <input type="hidden" name="env_key" value="${body.envKey}"/>
          <input type="hidden" name="data" value="${body.envData}"/>
          <script type="text/javascript">document.getElementById("paymentForm").submit();</script>
        </form>
    `;
}

/**
 * Login into Netopia and create a new session
 * @returns {string} Session id
 */
async function login() {
  const xml = builder.buildObject({
    Envelope: {
      $: {
        xmlns: 'http://schemas.xmlsoap.org/soap/envelope/',
      },
      Body: {
        logIn: {
          $: {
            xmlns: `${config.baseUrl}/api/payment2/`,
          },
          request: {
            $: {
              xmlns: '',
            },
            username: config.accountUsername,
            password: config.accountPassword,
          },
        },
      },
    },
  });

  const { data } = await axios.post(`${config.baseUrl}/api/payment2/`, xml)
    .catch((error) => error.response);

  const parsedObject = await parseResponse(data);
  if (parsedObject.Envelope.Body.Fault) {
    return parsedObject.Envelope.Body.Fault;
  }
  return parsedObject.Envelope.Body.logInResponse.logInResult.id;
}

/**
 * Authorize payment using token
 * If the pre-authorization is not set, the payment will be done immediately.
 * @param {Number} amount
 * @param {String} token
 * @param {Object} billing Billing information
 *  (firstName, lastName, address, email, phone, description) required and
 *  (country, county, city, postalCode) optional
 * @param {Object} params
 * @returns
 */
async function createPaymentByToken(amount, token, billing, params = {}) {
  const orderId = uid();
  const xml = builder.buildObject({
    Envelope: {
      $: {
        xmlns: 'http://schemas.xmlsoap.org/soap/envelope/',
      },
      Body: {
        doPayT: {
          $: {
            xmlns: `${config.baseUrl}/api/payment2/`,
          },
          request: {
            $: {
              xmlns: '',
            },
            account: {
              /**
               * your seller account identifier - available in your mobilPay account
               * under Admin - Seller accounts - Edit - Security settings
               */
              id: config.sellerId,

              /**
               *  please ask mobilPay to upgrade the necessary access required for token payments
               */
              user_name: config.accountUsername,

              /**
               * The hash that has to be sent along with
               * the other credentials has to be calculated as follows:
               * hashPassword = strtoupper(md5(usrPassword));
               * usrPassword is the same used to log into the merchant console
               * for the user performing the call
               * requestHashString=
               *  "{hashPassword}{orderId}{orderAmount}{orderCurrency}{cardNumber} {account id}";
               * where hashPassword - the one obtained above
               * orderID - merchant order ID - ‘Soap_Type_Payment_Order/id’
               * orderAmount - amount as sent in the ‘Soap_Type_Payment_Order/amount’ field
               * orderCurrency - currency ‘Soap_Type_Payment_Order/currency’
               * account id - Soap_Type_Payment_Account/id
               * requeshHash=strtoupper(sha1(requestHashString));
               */

              hash: utils.hash(orderId, amount, config.currency),

              confirm_url: config.confirmUrl,
            },

            transaction: {
              paymentToken: token,
            },

            order: {
              id: orderId,
              description: billing.description,
              amount,
              currency: config.currency,

              billing: {
                country: billing.country || 'Romania',
                county: billing.county || 'Bucharest',
                city: billing.city || 'Bucharest',
                postal_code: billing.postalCode || '000000',
                phone: billing.phone,
                first_name: billing.firstName,
                last_name: billing.lastName,
                address: billing.address,
                email: billing.email,
              },
            },
            params: {
              item: prepareParamsForNetopia(params),
            },
          },
        },
      },
    },
  });

  const { data } = await axios.post(`${config.baseUrl}/api/payment2/`, xml)
    .catch((error) => error.response);

  const parsedObject = await parseResponse(data);
  if (parsedObject.Envelope.Body.Fault) {
    return parsedObject.Envelope.Body.Fault;
  }
  return parsedObject.Envelope.Body.doPayTResponse.doPayTResult;
}

/**
 * Capture a pre-authorized transaction
 * Not used if pre-authorization is disabled on your account
 * @param {String} orderId
 * @param {Number} amount
 * @returns
 */
async function captureWithToken(orderId, amount) {
  const sessionId = await login();

  const xml = builder.buildObject({
    Envelope: {
      $: {
        xmlns: 'http://schemas.xmlsoap.org/soap/envelope/',
      },
      Body: {
        capture: {
          $: {
            xmlns: `${config.baseUrl}/api/payment2/`,
          },
          request: {
            $: {
              xmlns: '',
            },

            sessionId,
            orderId,
            amount,
            sacId: config.sellerId,

          },
        },
      },
    },
  });

  const { data } = await axios.post(`${config.baseUrl}/api/payment2/`, xml)
    .catch((error) => error.response);

  const parsedObject = await parseResponse(data);
  if (parsedObject.Envelope.Body.Fault) {
    return parsedObject.Envelope.Body.Fault;
  }
  return parsedObject.Envelope.Body.captureResponse.captureResult;
}

/**
 * Cancel payment or refund
 * @param {String} orderId
 * @param {Number} amount
 * @returns
 */
async function creditWithToken(orderId, amount = 0) {
  const sessionId = await login();

  const xml = builder.buildObject({
    Envelope: {
      $: {
        xmlns: 'http://schemas.xmlsoap.org/soap/envelope/',
      },
      Body: {
        credit: {
          $: {
            xmlns: `${config.baseUrl}/api/payment2/`,
          },
          request: {
            $: {
              xmlns: '',
            },

            sessionId,
            orderId,
            amount,
            sacId: config.sellerId,

          },
        },
      },
    },
  });

  const { data } = await axios.post(`${config.baseUrl}/api/payment2/`, xml)
    .catch((error) => error.response);

  const parsedObject = await parseResponse(data);

  if (parsedObject.Envelope.Body.Fault) {
    return parsedObject.Envelope.Body.Fault;
  }
  return parsedObject.Envelope.Body.creditResponse.creditResult;
}

/**
 * Authorize a payment then capture it
 *
 * As an workaround we can make an authorization and capture
 * another solution would be to use another seller account,
 * that seller account will be configured to use capture payments without pre-authorization
 *
 * @param {String} amount
 * @param {String} token
 * @param {Object} params
 * @returns
 */
async function authorizeAndCapture(amount, token, billing, params = {}) {
  const authorizeResponse = await createPaymentByToken(amount, token, billing, params);
  const captureResponse = await captureWithToken(authorizeResponse.order.id, amount);

  return {
    ...captureResponse,
    orderId: authorizeResponse.order.id,
  };
}

export default {
  parseResponse,
  parseIPNResponse,
  uid,
  authorizeAndCapture,
  createSimplePayment: createPayment,
  registerCard: createPayment,
  authorize: createPaymentByToken,
  captureWithoutAuthorization: createPaymentByToken,
  capture: captureWithToken,
  cancel: creditWithToken,
  refund: creditWithToken,
};