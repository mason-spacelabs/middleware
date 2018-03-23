const shopify_config = require('./config.json');
const request = require('request-promise');

function customerRecord(registration_data, domain){

    var domain_config = shopify_config[domain];

    var options = {
      method: 'POST',
      uri: 'https://' + domain_config.api_key + ':' + domain_config.api_password + '@' + domain + '/admin/customers.json',
      body: {
        "customer": {
          "first_name": registration_data.Firstname,
          "last_name": registration_data.Lastname,
          "email": registration_data.email,
          "phone": "+1" + registration_data.Phone,
          "verified_email": true,
          "addresses": [
            {
              "company": "Shipping Address",
              "address1": registration_data.ShippingAddress,
              "city": registration_data.ShippingAddressCity,
              "province": registration_data.ShippingAddressState,
              "phone": registration_data.ShippingContactNumber,
              "zip": registration_data.ShippingAddressZip,
              "country": "US"
            },
            {
              "company": "Facility Address",
                "address1": registration_data.FacilityAddress,
                "city": registration_data.FacilityAddressCity,
                "province": registration_data.FacilityAddressState,
                "phone": registration_data.FacilityContactNumber,
                "zip": registration_data.FacilityAddressZip,
                "country": "US"
            },
            {
              "company": "Billing Address",
                "address1": registration_data.BillingAddress,
                "city": registration_data.BillingAddressCity,
                "province": registration_data.BillingAddressState,
                "phone": registration_data.BillingContactNumber,
                "zip": registration_data.BillingAddressZip,
                "country": "US"
            }
          ],
          "metafields": [
            {
              "key": "details",
              "value": "Account #:90022447, GPO #: 999-9999, Company: " + registration_data.BillingName + ",",
              "value_type": "string",
              "namespace": "account_data"
            }
          ],
          "send_email_invite": false,
          "send_email_welcome": false
        }
      },
      json: true
  };
    return options;
  }

 function MFG_Request(shopify_pricing){

    console.timeEnd("RECIEVE DATA");
    console.time("GET MFG PRICING");
    
    var promise = new Promise(function(resolve, reject){
    request(shopify_pricing.options)
      .then(function (response) {

        console.timeEnd("GET MFG PRICING");
        console.time("TRANSFORM PRICING");

        var raw = response;
        var rawArray = raw.split('|');
        var increaseKey = 0;
        var increaseValue = 0;
        var pricingObject = {};
  
        for(var i = 0; i < rawArray.length; i++) {

          if(rawArray[i].includes("XXX")){

            pricingObject[increaseKey] = {};
            increaseKey++; 
            increaseValue = 0;   

          }else{

            var objectReference = increaseKey - 1;
            var value = rawArray[i];
            pricingObject[objectReference][increaseValue] = value;
            increaseValue++;

          }
        }

        var shopifyTagString = "";
          
        for(var products in pricingObject){

          var pricingRaw = Object.values(pricingObject[products][4]).join(' ');
          var pricing = pricingRaw.replace(/\s/g,''); 

          var productRaw = Object.values(pricingObject[products][0]).join(' ');
          var product = productRaw.replace(/\s/g,'');

          var shopifyProductNumberRaw = Object.values(shopify_pricing.shopify_request.Variants[product]).join(' ');
          var shopifyProduct = shopifyProductNumberRaw.replace(/\s/g,''); 

          shopifyTagString += shopifyProduct + ":" + pricing + ", ";

        }
        var shopify_data = {
          "customer": {
            "id": shopify_pricing.shopify_request.ShopifyCustomerNumber,
            "tags": shopifyTagString,
            "domain": shopify_pricing.header,
          }
        };

        resolve(shopify_data);

      })
      .catch(function (error) {

        reject(error);

      });
    });
  return promise;
  }

function shopifyPricingPut(shopify_data) {

    var domain = shopify_data.customer.domain;
    var domain_config = shopify_config[domain];

    var promise = new Promise(function(resolve, reject){

      var options = {
        method: 'PUT',
        uri: 'https://' + domain_config.api_key + ':' + domain_config.api_password + '@' + domain + '/admin/customers/' + shopify_data.customer.id + '.json',
        body: {
          "customer": {
            "id": shopify_data.customer.id,
            "tags": shopify_data.customer.tags
          }
        },
        json: true
      };

      console.timeEnd("TRANSFORM PRICING");
      console.time("SHOPIFY POST PRICING");

      request(options).then(function (body) {

        resolve({response: body});
    
      })
      .catch(function (err) {

        reject({error: err.response.body});
    
      });

    });
    return promise;
 }

 var body = {  
  "id":417742422059,
  "email":"mason@spacelabs.com",
  "closed_at":null,
  "created_at":"2018-03-23T16:06:25-07:00",
  "updated_at":"2018-03-23T16:06:26-07:00",
  "number":37,
  "note":null,
  "token":"ae019049c231a92e2d71cba61f80afcf",
  "gateway":"Cash on Delivery (COD)",
  "test":false,
  "total_price":"30.00",
  "subtotal_price":"30.00",
  "total_weight":0,
  "total_tax":"0.00",
  "taxes_included":false,
  "currency":"USD",
  "financial_status":"paid",
  "confirmed":true,
  "total_discounts":"0.00",
  "total_line_items_price":"30.00",
  "cart_token":null,
  "buyer_accepts_marketing":false,
  "name":"#SP1037",
  "referring_site":null,
  "landing_site":null,
  "cancelled_at":null,
  "cancel_reason":null,
  "total_price_usd":"30.00",
  "checkout_token":null,
  "reference":null,
  "user_id":17954373675,
  "location_id":null,
  "source_identifier":null,
  "source_url":null,
  "processed_at":"2018-03-23T16:06:25-07:00",
  "device_id":null,
  "phone":null,
  "customer_locale":null,
  "app_id":1354745,
  "browser_ip":null,
  "landing_site_ref":null,
  "order_number":1037,
  "discount_codes":[  

  ],
  "note_attributes":[  

  ],
  "payment_gateway_names":[  
     "Cash on Delivery (COD)"
  ],
  "processing_method":"manual",
  "checkout_id":null,
  "source_name":"shopify_draft_order",
  "fulfillment_status":null,
  "tax_lines":[  

  ],
  "tags":"",
  "contact_email":"mason@spacelabs.com",
  "order_status_url":"https:\/\/checkout.shopify.com\/27777236\/orders\/ae019049c231a92e2d71cba61f80afcf\/authenticate?key=39acefe40d58ac40c8c194feeeccb35b",
  "line_items":[  
     {  
        "id":835113648171,
        "variant_id":10233012781099,
        "title":"Neonatal Single Tube Monitor Hose",
        "quantity":1,
        "price":"30.00",
        "sku":"714-0019-01",
        "variant_title":"9'",
        "vendor":"Non-Invasive Blood Pressure Cuffs",
        "fulfillment_service":"manual",
        "product_id":964139221035,
        "requires_shipping":true,
        "taxable":true,
        "gift_card":false,
        "pre_tax_price":"30.00",
        "name":"Neonatal Single Tube Monitor Hose - 9'",
        "variant_inventory_management":null,
        "properties":[  

        ],
        "product_exists":true,
        "fulfillable_quantity":1,
        "grams":0,
        "total_discount":"0.00",
        "fulfillment_status":null,
        "tax_lines":[  

        ]
     }
  ],
  "shipping_lines":[  

  ],
  "billing_address":{  
     "first_name":"Name",
     "address1":"78848 148th Ave",
     "phone":"555-1212",
     "city":"Redmond",
     "zip":"78952",
     "province":"Washington",
     "country":"United States",
     "last_name":"Something",
     "address2":null,
     "company":"Shipping Address",
     "latitude":null,
     "longitude":null,
     "name":"Name Something",
     "country_code":"US",
     "province_code":"WA"
  },
  "shipping_address":{  
     "first_name":"Name",
     "address1":"78848 148th Ave",
     "phone":"555-1212",
     "city":"Redmond",
     "zip":"78952",
     "province":"Washington",
     "country":"United States",
     "last_name":"Something",
     "address2":null,
     "company":"Shipping Address",
     "latitude":null,
     "longitude":null,
     "name":"Name Something",
     "country_code":"US",
     "province_code":"WA"
  },
  "fulfillments":[  

  ],
  "refunds":[  

  ],
  "customer":{  
     "id":529391910955,
     "email":"mason@spacelabs.com",
     "accepts_marketing":false,
     "created_at":"2018-03-23T12:46:58-07:00",
     "updated_at":"2018-03-23T16:06:26-07:00",
     "first_name":"Mason",
     "last_name":"Halstead",
     "orders_count":10,
     "state":"enabled",
     "total_spent":"393.00",
     "last_order_id":417742422059,
     "note":null,
     "verified_email":true,
     "multipass_identifier":null,
     "tax_exempt":false,
     "phone":"+14252837999",
     "tags":"",
     "last_order_name":"#SP1037",
     "default_address":{  
        "id":548110925867,
        "customer_id":529391910955,
        "first_name":"Name",
        "last_name":"Something",
        "company":"Shipping Address",
        "address1":"78848 148th Ave",
        "address2":null,
        "city":"Redmond",
        "province":"Washington",
        "country":"United States",
        "zip":"78952",
        "phone":"555-1212",
        "name":"Name Something",
        "province_code":"WA",
        "country_code":"US",
        "country_name":"United States",
        "default":true
     }
  }
};


  module.exports.shopifyPricingPut = shopifyPricingPut;
  module.exports.body = body;
  module.exports.customerRecord = customerRecord;
  module.exports.MFG_Request = MFG_Request;
