<?php

error_reporting(E_ALL);
ini_set('display_errors',1);
define("ERR_CODE_OK",0x00);

//live mode WSDL location
//    $soap = new SoapClient('https://secure.mobilpay.ro/api/payment2/?wsdl', Array('cache_wsdl' => WSDL_CACHE_NONE));
//test mode WSDL location
    $soap = new SoapClient('http://sandboxsecure.mobilpay.ro/api/payment2/?wsdl', Array('cache_wsdl' => WSDL_CACHE_NONE));
//your seller account identifier - available in your mobilPay account under Admin - Seller accounts - Edit - Security settings
    $sacId ='<your_sac_id>';

// Pay example

$req = new stdClass();

    $account = new stdClass();
    $account->id = $sacId;
    $account->user_name = '<your_mobilPay_username>'; //please ask mobilPay to upgrade the necessary access required for token payments
    $account->customer_ip = $_SERVER['REMOTE_ADDR']; //the IP address of the buyer. 
    $account->confirm_url = '<your_confirm_URL>';  //this is where mobilPay will send the payment result. This has priority over the SOAP call response


    $transaction = new stdClass();
    $transaction->paymentToken = '<the_payment_token>'; //you will receive this token together with its expiration date following a standard payment. Please store and use this token with maximum care

    $billing = new stdClass();
    $billing->country = 'billing_country';
    $billing->county = 'billing_county';
    $billing->city = 'billing_city';
    $billing->address = 'billing_address';
    $billing->postal_code = 'billing_postal_code';
    $billing->first_name = 'billing_first_name';
    $billing->last_name = 'billing_last_name';
    $billing->phone = 'billing_phone';
    $billing->email = 'email_address';
/*
    $shipping = new stdClass();
    $shipping->country = 'shipping_country';
    $shipping->county = 'shipping_county';
    $shipping->city = 'shipping_city';
    $shipping->address = 'shipping_address';
    $shipping->postal_code = 'shipping_postal_code';
    $shipping->first_name = 'shipping_first_name';
    $shipping->last_name = 'shipping_last_name';
    $shipping->phone = 'shipping_phone';
    $shipping->email = 'shipping_email';
*/

    $order = new stdClass();
    $order->id = md5(uniqid(rand())); //your orderId. As with all mobilPay payments, it needs to be unique at seller account level
    $order->description = 'desc'; //payment descriptor
    $order->amount = XX.XX; // order amount; decimals present only when necessary, i.e. 15 not 15.00
    $order->currency = 'RON'; //currency
    $order->billing = $billing;
//  $order->shipping = $shipping;

    $params = new stdClass();
    $params->item = new stdClass();
	$params->item->name = 'param1name';
	$params->item->value = 'param1value';

    $account->hash = strtoupper(sha1(strtoupper(md5('<your_mobilPay_account_password')) . "{$order->id}{$order->amount}{$order->currency}{$account->id}"));

    $req->account = $account;
    $req->order = $order;
	$req->params = $params;
    $req->transaction = $transaction;

    try
    {
        $response = $soap->doPayT(Array('request' => $req));
        if (isset($response->errors) && $response->errors->code != ERR_CODE_OK)
        {
            throw new Exception($response->code, $response->message);
        }
    }
    catch(SoapFault $e)
    {
        throw new Exception($e->faultstring);//, $e->faultcode, $e);
    }	
?>
