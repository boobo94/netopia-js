
# Initial setup

Copy the package to modules/netopia and install dependencies

```sh
  npm i ./modules/netopia
```

Set the environment variables

```sh
# or something else, for example  local, staging
ENVIRONMENT=production
 # your webhook url where Netopia sends confirmation messages
NETOPIA_WEBHOOK_URL=http://localhost:8000/api/v1/webhooks/netopia
# the seller account id found in Admin > Seller Accounts > in the table press edit near the seller account >
# > Security Settings (4th tab) > is under Seller account id having format XXXX-XXXX-XXXX-XXXX-XXXX
NETOPIA_SELLER_ID=123456789
# under seller account there is Digital Certificate Netopia Payments (the public key)
# download the certificate then copy an paste the certificate inside quotes
# for those who use dotenv library, you need at least v15
NETOPIA_PUBLIC_KEY="change_me"
# under the public key there is Seller Account Certificate (the private key)
# download the certificate then copy an paste the certificate inside quotes
NETOPIA_PRIVATE_KEY="change_me"
# If your implementation requires an user go to Admin > Users > Create a new one (you should talk with Netopia about your needs)
# but here you find the username and the password that you picked
NETOPIA_ACCOUNT_USERNAME=change_me
NETOPIA_ACCOUNT_PASSWORD=change_me
NETOPIA_CURRENCY=RON
```

To get the settings of account [login into Netopia](https://admin.mobilpay.ro/ro/login).

# Usage

## Import

```js
import Netopia from '../../../modules/netopia'
```

## IPN using Express

```js
import Netopia from '../../../modules/netopia'

// ...

.post(
  '/api/v1/webhooks/netopia',
  bodyParser.urlencoded({ extended: false }),
  async (req, res) => {
    const ipnResponse = await Netopia.parseIPNResponse(req.body)

    // action = status only if the associated error code is zero
    if (ipnResponse.success) {
      switch (ipnResponse.decoded.order.mobilpay.action) {
        // every action has an error code and an error message
        case 'confirmed': {
          // confirmed actions means that the payment was successful and
          // the money was transferred from custtomers account to the merchant account and you can deliver the goods

          break
        }
        case 'confirmed_pending': {
          // confirmed pending action means that the transaction pending for antifraud validation
          // you should not deliver the goods to the customer until a confirmed or canceled action is received

          break
        }
        case 'paid_pending': {
          // confirmed paid pending action means that the transaction pending validation
          // you should not deliver the goods to the customer until a confirmed or canceled action is received

          break
        }
        case 'paid': {
          // paid action means that the transaction pre-authorized
          // you should not deliver the goods to the customer until a confirmed or canceled action is received

          break
        }
        case 'canceled': {
          // canceled action means that the payment was canceled
          // you should not deliver the goods to the customer

          break
        }
        case 'credit': {
          // credit action means that the payment was refund

          break
        }
        default:
          throw Error('action parameter is not supported')
      }
    } else {
      console.error('error ipn', ipnResponse.order.mobilpay.error)
    }

    return res.status(200).send(ipnResponse.response)
  }
)
```

### IPN response example

<!-- todo: add an ipn example -->
```json

```

## How to create a simple payment or add the card in Netopia

To create simple payments where the user insert the card. This method returns an html form that submits automatically, simulating the redirect to Netopia's payment page, where the customer has to fill the card details.

```js
const response = await Netopia.createSimplePayment(
  "10", // the price in RON, in string format
  {
    type: 'person', // optional, options: 'person' or 'company', default = 'person'
    firstName: 'John', // required
    lastName: 'Doe', // required
    address: "my street", // required
    email: "contact@cmevo.com", // required
    phone: "071034782", // required
    description: "the product or service description", // required
  });
```

This method can be use to register a card, or use the alias `registerCard(amount, billing)`. Is the same function.

If your seller account has an user which is activated for token usage, you'll receive on IPN a token. Save it for further payments.

<!-- todo: the path to save token on IPN -->

## Create payment based on tokens or authorize a payment

If your seller account doesn't have pre-authorization active, by default all payments are captured instantly.


```js
const response = await Netopia.captureWithoutAuthorization(
  "10", // the price in RON, in string format
  "the token stored previously",
  {
    type: 'person', // optional, options: 'person' or 'company', default = 'person'
    firstName: 'John', // required
    lastName: 'Doe', // required
    address: "my street", // required
    email: "contact@cmevo.com", // required
    phone: "071034782", // required
    description: "the product or service description", // required
    country: "Romania", // optional, default = 'Romania'
    county: "Bucharest", // optional, default = 'Bucharest'
    city: "Bucharest", // optional, default = 'Bucharest'
    postalCode: "123456", // optional, default = '123456'
  },
  {
    // pass custom params that will be returned to you on IPN later
    "userId": 1,
    "internalPaymentId": "3sad3",
    "foo": "bar"
  });
```

I created an alias of this function for pre-authorization (if your seller account supports), only to be easier for you with the name. Instead of `captureWithoutAuthorization(...)` use `authorize(...)`. Pre-authorization means the money are locked in the customer's account, but are not transferred to your account until you don't execute the capture method.
If you use have pre-authorization, save for later the order id created from `response.order.id`.

## Capture a pre-authorized payment

Execute this function to transfer the money from customer to your account.

```js
const response = await Netopia.capture(
  "previous order id pre-authorized", // response.order.id, where response = Netopia.authorize(...), in string format
  "5", // the price in RON, in string format
  )
```

You can capture the pre-authorize value or a smaller amount and the difference will remain in the customer. Is not a refund, because the money didn't leave his account yet. You only capture partially. You cannot capture more than the pre-authorized value.

Netopia has a limitation when you have pre-authorization active on you seller account and you need to do both payments with pre-authorizations and instant capture. The are unable to do it using a single customer account. I implemented this functionality using an workaround by doing authorize and capture. Use function `authorizeAndCapture(amount, token, billing, params)`.

## Cancel pre-authorized payment

If you decide at any moment to cancel a payment, use:

```js
const response = await Netopia.cancel(
  "previous order id pre-authorized", // response.order.id, where response = Netopia.authorize(...), in string format
)
```

## Refund payment

If you decide to refund a payment

```js
const response = await Netopia.refund(
  "previous order id pre-authorized", // response.order.id, where response = Netopia.authorize(...), in string format
  "5", // the price in RON, in string format
  )
```

The amount you refund can be different that the value you captured. For example if you captured 5 lei, you can refund only 2, maximum 5.


## How to check the SOAP documentation

Install Wizdler browser extension and check https://secure.mobilpay.ro/api/payment2/?wsdl
There you'll find all methods available.

# Testing

You can find a [simple payment example](https://github.com/mobilpay/Node.js) and [Netopia's Github](https://github.com/mobilpay/).

## Cards

9900004810225098 - card accepted, CVV = 111
9900541631437790 - card expired
9900518572831942 - insufficinet funds
9900827979991500 - CVV2/CCV incorect
9900576270414197 - transaction declined 
9900334791085173 - high risk card (for example is a stolen card) 
9900130597497640 - error from the bank (connection with the bank cannot be established)