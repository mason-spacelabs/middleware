// ---------------- MIDDLEWARE INTEGRATION   ----------------
// ---------------- MIDDLEWARE INTEGRATION   ----------------

require('dotenv').config();

const fs = require('fs');
const request = require('request-promise');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const winston = require('./winston');
const md5 = require('md5');

// ---------------- MIDDLEWARE INTEGRATION ROUTE ENVIRONMENT VARIABLES - PROCESS ENVIRONMENT DEV/PRODUCTION ----------------

const environment_routes = process.env.NODE_ENV === "production" ? 
{
  MFG_PRO_NONCE_GENERATOR: process.env.MFG_PRO_PROD_NONCE_GENERATOR,
  MFG_PRO_PRICING: process.env.MFG_PRO_PROD_PRICING,
  MFG_PRO_FILE_PUT: process.env.MFG_PRO_PROD_FILE_PUT,
  MFG_PRO_FILE_GET: process.env.MFG_PRO_PROD_FILE_GET,
  MFG_PRO_INTERNAL_ACCOUNT: process.env.MFG_PRO_PROD_INTERNAL_ACCOUNT,
  MFG_PRO_INTERNAL_PASSWORD: process.env.MFG_PRO_PROD_INTERNAL_PASSWORD
}
: 
{
  MFG_PRO_NONCE_GENERATOR: process.env.MFG_PRO_TEST_NONCE_GENERATOR,
  MFG_PRO_PRICING: process.env.MFG_PRO_TEST_PRICING,
  MFG_PRO_FILE_PUT: process.env.MFG_PRO_TEST_FILE_PUT,
  MFG_PRO_FILE_GET: process.env.MFG_PRO_TEST_FILE_GET,
  MFG_PRO_INTERNAL_ACCOUNT: process.env.MFG_PRO_TEST_INTERNAL_ACCOUNT,
  MFG_PRO_INTERNAL_PASSWORD: process.env.MFG_PRO_TEST_INTERNAL_PASSWORD
}

// ---------------- MIDDLEWARE INTEGRATION ERROR FUNCTION - WINSTON ERROR FORMAT ----------------

function middlewareErrors(environment, error_type, domain, message) {

  var middleware_errors = environment + " " + error_type + " - " + domain + " - " + "Message: " + message;

  return middleware_errors;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - WEBHOOK BODY PARSER FROM SHOPIFY ----------------

var webhookParsingMiddleware = bodyParser.json({
  type: '*/*',
  limit: '50mb',
  verify: function (req, res, buf) {
    if (req.url.includes('/webhook/')) {
      req.rawbody = buf;
    }
  }
});

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - HMAC VALIDATION FROM SHOPIFY ----------------

function middlewareHMACValidator(req, res, next) {

  var path_prefix = req.query.path_prefix;
  var shop = req.query.shop;
  var timestamp = req.query.timestamp;
  var signature = req.query.signature;
  var secret = process.env.SHOPIFY_APP_SECRET;
  var sorted_parameters = "path_prefix=" + path_prefix + "shop=" + shop + "timestamp=" + timestamp;
  var calculated_signature = crypto.createHmac('sha256', secret).update(sorted_parameters).digest('hex');

  if (calculated_signature !== signature) {

    var errorMessage = middlewareErrors("*", "SHOPIFY VALIDATION", "ecommerce/spacelabs/pricing", "HMAC validation failed to connect to Shopify Server.");
    winston.error(errorMessage);
    return res.status(403).send({
      response: "HMAC Validation Failed"
    });

  }
  next();
}

// ---------------- MIDDLEWARE ENVIRONMENT CHECK - API ROUTES  ----------------

var environmentValidation = function (request_object) {

  var promise = new Promise(function (resolve, reject) {

    if (process.env.NODE_ENV === 'production') {

      request_object.client_api_key = process.env.SPACELABS_PROD_KEY;
      request_object.client_api_password = process.env.SPACELABS_PROD_PASSWORD;
      request_object.domain = process.env.SPACELABS_PROD_ENV;
      request_object.environment = "PROD";

      resolve(request_object);

    } else if (process.env.NODE_ENV === 'development') {

      request_object.client_api_key = process.env.SPACELABS_TEST_KEY;
      request_object.client_api_password = process.env.SPACELABS_TEST_PASSWORD;
      request_object.domain = process.env.SPACELABS_TEST_ENV;
      request_object.environment = "TEST";

      resolve(request_object);

    } else {

      request_object.error_message = middlewareErrors("*ALL*", "VALIDATION", request_object.domain, "Unable to validate ecommerce environment.");
      winston.error(request_object.error_message);
      reject(request_object);

    }
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY CUSTOMER INTAKE PUT - SHOPIFY PUT API CALL ----------------

function internalAuthentication(request_object) {

  var promise = new Promise(function (resolve, reject) {
    
    request(request_object.authentication).then(function (response) {
        
        var responseString = JSON.parse(response);
        var responseObject = JSON.parse(responseString);
        var authentication = responseObject[0].Pwd;
        var hashString = authentication += environment_routes.MFG_PRO_INTERNAL_PASSWORD;
        var cryptoHash = md5(hashString);
        
        switch (request_object.internal.path) {
          case 'pricing':
            request_object.internal_options = {
              method: 'POST',
              uri: environment_routes.MFG_PRO_PRICING,
              body: {
                Account: environment_routes.MFG_PRO_INTERNAL_ACCOUNT,
                TokenId: responseObject[0].id,
                AuthString: cryptoHash,
                QueryString: 'openagent&USA&' + request_object.response.RequestString,
              },
              json: true
            }
            resolve(request_object);
            break;

          case 'register':
            request_object.internal_options = {
              method: 'POST',
              uri: environment_routes.MFG_PRO_FILE_PUT,
              body: {
                Account: environment_routes.MFG_PRO_INTERNAL_ACCOUNT,
                TokenId: responseObject[0].id,
                AuthString: cryptoHash,
                FileDir: 'custreq',
                FileName: '',
                FileData: ''
              },
              json: true
            }
            resolve(request_object);
            break;

          case 'order':
            request_object.internal_options = {
              method: 'POST',
              uri: environment_routes.MFG_PRO_FILE_PUT + "?Account=" + environment_routes.MFG_PRO_INTERNAL_ACCOUNT + "&TokenId=" + responseObject[0].id + "&AuthString=" + cryptoHash + "&FileDir=so" + "&FileName=", // Adding file data as a parameter in the next promise
              json: true
            }
            resolve(request_object);
            break;

            case 'invite':
            request_object.internal_options = {
              method: 'POST',
              uri: environment_routes.MFG_PRO_FILE_GET,
              body: {
                Account: environment_routes.MFG_PRO_INTERNAL_ACCOUNT,
                TokenId: responseObject[0].id,
                AuthString: cryptoHash,
                FileDir: 'cust',
                ThenDelete: true
              },
              json: true
            }
            resolve(request_object);
            break;

          default:
            request_object.error_message = middlewareErrors("*ALL*", "VALIDATION", request_object.domain, "Unable to verify authenticated post route.");
            winston.error(request_object.error_message);
            reject();
        }
      })
      .catch(function (error) {

        var error_message = "Failed to get authentication from internal key generation. " + request_object.internal.error;
        request_object.error_message = middlewareErrors(request_object.environment, "MFG PRO INTERNAL AUTHENTICATION", "/ERP/NonceGenerator", error_message);
        winston.error(request_object.error_message);
        reject();

      });
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION MFG PRO AUTHENTICATED POST - INTERNAL API POST ----------------

function internalAuthenticatedPOST(request_object) {

  var promise = new Promise(function (resolve, reject) {
  
    request(request_object.internal_options).then(function (response) {

        request_object.internal_response = response;
        resolve(request_object);

      })
      .catch(function (error) {

        var error_message = "Failed to create an input file for MFG PRO. " + request_object.internal.error;
        request_object.error_message = middlewareErrors(request_object.environment, "MFG PRO FILE POST", "/ShopifyERPLink/ERP/FilePut", error_message);
        winston.error(request_object.error_message);
        reject(request_object);

      });
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - SHOPIFY PRICING OBJECT TRANSFORM ----------------

function pricingObjectTransformation(request_object) {

  var promise = new Promise(function (resolve, reject) {
    try {
      var pricingObject = {};
      var shopifyTagString = "";
      var shopifyAccounts = "";
      var increaseKey = 0;
      var increaseValue = 0;

      var raw = request_object.internal_response;
      var rawArray = raw.split('|');

      for (var i = 0; i < rawArray.length; i++) {

        if (rawArray[i].includes("XXX")) {

          pricingObject[increaseKey] = {};
          increaseKey++;
          increaseValue = 0;

        } else {

          var objectReference = increaseKey - 1;
          var value = rawArray[i];
          pricingObject[objectReference][increaseValue] = value;
          increaseValue++;

        }
      }

      for (var products in pricingObject) {

        var pricingRaw = Object.values(pricingObject[products][4]).join(' ');
        var pricing = pricingRaw.replace(/\s/g, '');

        var productRaw = Object.values(pricingObject[products][0]).join(' ');
        var product = productRaw.replace(/\s/g, '');

        var shopifyProductNumberRaw = Object.values(request_object.response.Variants[product]).join(' ');
        var shopifyProduct = shopifyProductNumberRaw.replace(/\s/g, '');

        shopifyTagString += shopifyProduct + ":" + pricing + ", ";

      }

      shopifyAccounts = "F" + request_object.response.ShopifyFacilityNumber + ", S" + request_object.response.ShopifyShippingNumber + ", B" + request_object.response.ShopifyBillingNumber;
      shopifyTagString += shopifyAccounts;
      request_object.client_tags = shopifyTagString;
      resolve(request_object);

    } catch (error) {

      var shopifyAccounts = "F" + request_object.response.ShopifyFacilityNumber + ", S" + request_object.response.ShopifyShippingNumber + ", B" + request_object.response.ShopifyBillingNumber;
      request_object.client_tags = shopifyAccounts;

      request_object.error_message = middlewareErrors(request_object.environment, "MFG PRO PRICING GET", "ecommerce/spacelabs/pricing", "Unable to retrieve customer pricing from internal network.");
      winston.error(request_object.error_message);
      reject(request_object);


    }
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - SHOPIFY PRICING PUT ----------------

function shopifyPricingPUT(request_object) {
  

  request_object.shopify_options = {
    method: 'PUT',
    uri: 'https://' + request_object.client_api_key + ':' + request_object.client_api_password + '@' + request_object.domain + '/admin/customers/' + request_object.response.ShopifyCustomerNumber + '.json',
    body: {
      "customer": {
        "id": request_object.response.ShopifyCustomerNumber,
        "tags": request_object.client_tags
      }
    },
    json: true
  };

  var promise = new Promise(function (resolve, reject) {

    request(request_object.shopify_options).then(function (response) {

        if(response){
          request_object.shopify_response = response;
          resolve(request_object);
        }else{
          request_object.shopify_response = "response";
          resolve(request_object);
        }

      })
      .catch(function (error) {

        var error_domain = "admin/customers/" + request_object.response.ShopifyCustomerNumber + ".json";
        request_object.error_message = middlewareErrors(request_object.environment, "SHOPIFY PRICING PUT", error_domain, error.response.response);
        winston.error(request_object.error_message);
        reject(request_object);

      });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - SHOPIFY CUSTOMER RECORD POST  ----------------

function customerRecordCreation(request_object) {

  var promise = new Promise(function (resolve, reject) {

    try {

      if (request_object.response.ShippingName == request_object.response.FacilityName || request_object.response.BillingName) {

        FacilityName = request_object.response.FacilityName + " (Facility)";
        BillingName = request_object.response.BillingName + " (Billing)";

      } else {

        FacilityName = request_object.response.FacilityName;
        BillingName = request_object.response.BillingName;

      }

      request_object.shopify_options = {
        method: 'POST',
        uri: 'https://' + request_object.client_api_key + ':' + request_object.client_api_password + '@' + request_object.domain + '/admin/customers.json',
        body: {
          "customer": {
            "first_name": request_object.response.Firstname,
            "last_name": request_object.response.Lastname,
            "email": request_object.response.email,
            "phone": "+1" + request_object.response.Phone,
            "tags": "F90022447, S90022449, B90022450", // These are placeholders prefixed with a letter to make them unique
            "verified_email": true,
            "addresses": [{
                "company": request_object.response.ShippingName,
                "address1": request_object.response.ShippingAddress,
                "city": request_object.response.ShippingAddressCity,
                "province": request_object.response.ShippingAddressState,
                "phone": request_object.response.ShippingContactNumber,
                "zip": request_object.response.ShippingAddressZip,
                "last_name": request_object.response.Lastname,
                "first_name": request_object.response.Firstname,
                "country": "US"
              },
              {
                "company": FacilityName,
                "address1": request_object.response.FacilityAddress,
                "city": request_object.response.FacilityAddressCity,
                "province": request_object.response.FacilityAddressState,
                "phone": request_object.response.FacilityContactNumber,
                "last_name": request_object.response.Lastname,
                "first_name": request_object.response.Firstname,
                "country": "US"
              },
              {
                "company": BillingName,
                "address1": request_object.response.BillingAddress,
                "city": request_object.response.BillingAddressCity,
                "province": request_object.response.BillingAddressState,
                "phone": request_object.response.BillingContactNumber,
                "zip": request_object.response.BillingAddressZip,
                "last_name": request_object.response.Lastname,
                "first_name": request_object.response.Firstname,
                "country": "US"
              },
            ],
            "send_email_invite": false,
            "send_email_welcome": false
          }
        },
        json: true
      };

      resolve(request_object);
    } catch (error) {

      var errorMessage = middlewareErrors(request_object.environment, "SHOPIFY POST OBJECT", request_object.domain, "Unable to create Shopify customer POST object.");
      winston.error(errorMessage);
      reject();
    }
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - CUSTOMER SHOPIFY POST  ----------------

function shopifyCustomerPOST(request_object) {

  var promise = new Promise(function (resolve, reject) {

    request(request_object.shopify_options).then(function (response) {

        request_object.shopify_response = {
          "Customer": response.customer.id,
          "Shipping_Address": response.customer.addresses['0'].id,
          "Facility_Address": response.customer.addresses['1'].id,
          "Billing_Address": response.customer.addresses['2'].id
        };

        resolve(request_object);
      })
      .catch(function (error) {

        var message = JSON.stringify(error.response.body);
        var errorMessage = middlewareErrors(request_object.environment, "SHOPIFY POST ROUTE", request_object.domain, message);
        winston.error(errorMessage);

        reject({error: error.response.body});

      });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - CUSTOMER SHOPIFY DEFAULT ADDRESS POST  ----------------

function shopifyAddressPUT(request_object) {

  request_object.shopify_address_options = {
    method: 'PUT',
    uri: 'https://' + request_object.client_api_key + ':' + request_object.client_api_password + '@' + request_object.domain + '/admin/customers/' + request_object.shopify_response.Customer + '/addresses/' + request_object.shopify_response.Shipping_Address + '/default.json',
  };

  var promise = new Promise(function (resolve, reject) {

    request(request_object.shopify_address_options).then(function (response) {
        resolve(request_object);
      })
      .catch(function (error) {

        var message = JSON.stringify(error.response.body);
        var errorMessage = middlewareErrors(request_object.environment, "SHOPIFY ADDRESS PUT ROUTE", request_object.domain, message);
        winston.error(errorMessage);

        reject({
          error: error.response.body
        });

      });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - MFG PRO INTAKE FILE  ----------------

function customerFileCreation(request_object) {

  var promise = new Promise(function (resolve, reject) {

    try {

      var customer_intake = "";
      var date = new Date();
      var short_date = date.getMonth() + 1 + '_' + date.getDate() + '_';

      var customer_headers = {
        "Shopify Customer ID": request_object.shopify_response.Customer,
        "Email": request_object.response.email,
        "First Name": request_object.response.Firstname,
        "Last Name": request_object.response.Lastname,
        "Phone Number": request_object.response.Phone,
        "Shopify Billing ID": request_object.shopify_response.Billing_Address,
        "Shopify Facility ID": request_object.shopify_response.Facility_Address,
        "Shopify Shipping ID": request_object.shopify_response.Shipping_Address
      };

      for (var header in customer_headers) {

        customer_intake += customer_headers[header] + ",";
      }

      request_object.internal_options.body.FileName = short_date + request_object.shopify_response.Customer;
      request_object.internal_options.body.FileData = customer_intake;
      request_object.error_message = "Please verify that the customer " + request_object.response.email + " has been created in Shopify Admin.";


      resolve(request_object);
    } catch (error) {

      var errorMessage = middlewareErrors(request_object.environment, "MFG PRO CUSTOMER POST OBJECT", "/ecommerce/spacelabs/register", "Unable to create MFG Pro customer intake object.");
      winston.error(errorMessage);
      reject(error);
    }

  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - MFG PRO ORDER OBJECT CREATION ----------------

function orderObjectCreation(request_object) {

  var promise = new Promise(function (resolve, reject) {

    try {
      var completed_order = "";
      var shipping_method = "";
      var line_items = request_object.response.line_items;
      var customer_tags = request_object.response.customer.tags;
      var tagsArray = customer_tags.split(", ");

      var date = new Date(request_object.response.created_at);
      var short_date = (date.getMonth() + 1 + '/' + date.getDate() + '/' + date.getFullYear());
      var order_date = (date.getMonth() + 1 + '_' + date.getDate());

      var date_added = addDays(request_object.response.created_at, 1);
      var ship_date = (date_added.getMonth() + 1 + '/' + date_added.getDate() + '/' + date_added.getFullYear());

      var shipping_number = tagsArray.pop().slice(1, 15);
      var facility_number = tagsArray.pop().slice(1, 15);
      var billing_number = tagsArray.pop().slice(1, 15);

      var order_paid = "order paid";
      var custom_shipper = "";
      var attention_note = "";
      var shipping_carrier = "";
      var shipping_carrier_number = "";
      var purchase_order = "";
      var shopify_order = "";

      for(var notes in request_object.response.note_attributes){
        switch (request_object.response.note_attributes[notes].name) {
          case "purchase_order":

            if(request_object.response.note_attributes[notes].value == "none"){
              purchase_order = request_object.response.name;
            }else{
              purchase_order = request_object.response.note_attributes[notes].value.trim();
            }

            break;
          case "shipping_name":

            if(request_object.response.note_attributes[notes].value == "none"){
              shipping_carrier = " ";
            }else{
              shipping_carrier = request_object.response.note_attributes[notes].value.trim() + " : ";
            }

            break;
          case "shipping_number":
            
            if(request_object.response.note_attributes[notes].value == "none"){
              shipping_carrier_number = " ";
            }else{
              shipping_carrier_number = request_object.response.note_attributes[notes].value.trim();
            }

            break;
          case "attention":

            if(request_object.response.note_attributes[notes].value == "none"){
              attention_note = " ";
            }else{
              attention_note = request_object.response.note_attributes[notes].value.trim();
            }

            break;
          default:
        }
      }

      if(request_object.response.financial_status == "pending"){
        order_paid = "collect payment";
      }

      switch (request_object.response.shipping_lines[0].title) {
        case "FedEx 2 Day":
          shipping_method = "FEDEX11";
          break;
        case "FedEx Express Saver":
          shipping_method = "FEDEX3";
          break;
        case "FedEx Ground":
          shipping_method = "FEDEX99";
          break;
        case "FedEx Priority Overnight":
          shipping_method = "FEDEX1";
          break;
        default:
          shipping_method = "FEDEX99";
      }

      customer_shipper = shipping_carrier + shipping_carrier_number;
      
      var order_header = {
        "Row ID": "H",
        "MFG Pro Sold-to": facility_number,
        "MFG Pro Bill-to": billing_number,
        "Customer PO Number": purchase_order,
        "PO Date": short_date,
        "MFG Pro Ship-to": shipping_number,
        "Total Price": request_object.response.total_price,
        "Total Tax": request_object.response.total_tax,
        "Total Shipping Cost": request_object.response.shipping_lines[0].price,
        "Ship Via": shipping_method,
        "Ship Date": ship_date,
        "Total Weight": request_object.response.total_weight,
        "Email Address": request_object.response.email,
        "Authorize Invoice Number": "c" + request_object.response.checkout_id + ".1",
        "Customer Paid": order_paid,
        "Attention to:": attention_note,
        "Shopify Order Number": request_object.response.name,
        "Shipping Carrier Details": customer_shipper
      };

      for (var header in order_header) {

        completed_order += order_header[header] + "|";
      }

      completed_order += "%0A";

      for (var items in line_items) {

        var line_number = parseInt(items) + 1;
        var pack_sku = line_items[items].sku;
        var pack_size = pack_sku.split('-').pop();
        var modified_size = "";

        if (pack_size == '00') {

          modified_size = '01';

        } else {

          modified_size = pack_size;

        }

        var line_item = {
          "Row ID": "I",
          "Line Number": line_number,
          "Vendor Part Number": line_items[items].sku,
          "Description": line_items[items].title,
          "Quantity": line_items[items].quantity,
          "UOM": "Each",
          "Unit Price": line_items[items].price,
          "Item Weight (Grams)": line_items[items].grams,
          "Pack Size": modified_size,
        };

        for (var line in line_item) {

          completed_order += line_item[line] + "|";

        }

        completed_order += "%0A";

      }

      request_object.internal_options.uri += order_date + "_" + request_object.response.name;
      request_object.internal_options.uri += "&FileData=" + completed_order.replace(/\s/g, "%20");
      resolve(request_object);
    } catch (error) {

      var errorMessage = middlewareErrors(request_object.environment, "MFG PRO ORDER POST OBJECT", "/webhook/spacelabs/order", "Unable to create the order intake post object for MFG PRO. Cross reference " + request_object.response.name + " in Shopify and verify in MFG PRO.");
      winston.error(errorMessage);

      reject();

    }
  });
  return promise;
}


// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - CREATE ORDER DATE FOR MFG PRO ----------------

function addDays(date, days) {

  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;

}

// ---------------- MIDDLEWARE INTEGRATION ROUTE CUSTOMER INTAKE - NORMALIZE PHONE NUMBERS ----------------

function normalizePhoneNumbers(phone) {
  //normalize string and remove all unnecessary characters
  phone = phone.replace(/[^\d]/g, "");

  //check if number length equals to 10
  if (phone.length == 10) {
      //reformat and return phone number
      return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
  }

  return null;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - HMAC VALIDATION FROM SHOPIFY ----------------

function webhookHMACValidator(request_object) {

  var promise = new Promise(function (resolve, reject) {

    if (process.env.NODE_ENV === 'production') {
      request_object.client_api_webhook = process.env.SPACELABS_PROD_WEBHOOK;
      request_object.environment = 'PROD';

    } else if (process.env.NODE_ENV === 'development') {
      request_object.client_api_webhook = process.env.SPACELABS_TEST_WEBHOOK;
      request_object.environment = 'TEST';

    } else {

      reject();

    }

    var generated_hash = crypto.createHmac('sha256', request_object.client_api_webhook).update(Buffer.from(request_object.rawbody)).digest('base64');

    if (generated_hash == request_object.hmac) {

      resolve(request_object);

    } else {

      var errorMessage = middlewareErrors("TEST", "SHOPIFY VALIDATION", "/webhook/spacelabs/order", "Webhook HMAC validation failed to connect to Shopify Server.");
      winston.error(errorMessage);
      res.sendStatus(403);

    }
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION CUSTOMER INTAKE VERIFIED - PARSE OBJECT FOR SHOPIFY PUT ----------------

var formatCustomerIntakeFile = function (customer_object) {

  var promise = new Promise(function (resolve, reject) {

    var tax_exempt = '';

    if (customer_object.intake_object[5] == 'No') {
      tax_exempt = false;
    } else {
      tax_exempt = true;
    }
    var company_billing = customer_object.intake_object[8];
    var company_facility = customer_object.intake_object[19];
    var company_shipping = customer_object.intake_object[30];

    if (customer_object.intake_object[30] == customer_object.intake_object[8] || customer_object.intake_object[30]) {
      company_billing = customer_object.intake_object[8] + " (Billing)";
      company_facility = customer_object.intake_object[19] + " (Facility)";
    }

    var billing_phone_number = customer_object.intake_object[12].trim();
    var shipping_phone_number = customer_object.intake_object[34].trim();
    var facility_phone_number = customer_object.intake_object[23].trim();

    if(billing_phone_number){
      billing_phone_number = normalizePhoneNumbers(billing_phone_number);
    }
    if(shipping_phone_number){
      shipping_phone_number = normalizePhoneNumbers(shipping_phone_number);
    }
    if(facility_phone_number){
      facility_phone_number = normalizePhoneNumbers(facility_phone_number);
    }
    
    try { 
      customer_object.options = {
        method: 'PUT',
        uri: 'https://' + customer_object.client_api_key + ':' + customer_object.client_api_password + '@' + customer_object.domain + '/admin/customers/' + customer_object.intake_object[0] + '.json',
        body: {
          "customer": {
            "id": customer_object.intake_object[0],
            "first_name": customer_object.intake_object[2],
            "last_name": customer_object.intake_object[3],
            "email": customer_object.intake_object[1],
            "phone": customer_object.intake_object[4],
            "verified_email": 'true',
            "tax_exempt": tax_exempt,
            "addresses": [{
                "id": customer_object.intake_object[6],
                "company": company_billing,
                "address1": customer_object.intake_object[9],
                "city": customer_object.intake_object[10],
                "province": customer_object.intake_object[11],
                "phone": billing_phone_number,
                "zip": customer_object.intake_object[13],
                "first_name": customer_object.intake_object[2],
                "last_name": customer_object.intake_object[3],
                "country": 'US'
              },
              {
                "id": customer_object.intake_object[28], // Facility Shopify Number is switched on intake
                "company": company_facility,
                "address1": customer_object.intake_object[20],
                "city": customer_object.intake_object[21],
                "province": customer_object.intake_object[22],
                "phone": facility_phone_number,
                "zip": customer_object.intake_object[24],
                "first_name": customer_object.intake_object[2],
                "last_name": customer_object.intake_object[3],
                "country": 'US'
              },
              {
                "id": customer_object.intake_object[17], // Shipping Shopify Number is switched on intake
                "company": company_shipping,
                "address1": customer_object.intake_object[31],
                "city": customer_object.intake_object[32],
                "province": customer_object.intake_object[33],
                "phone": shipping_phone_number,
                "zip": customer_object.intake_object[35],
                "first_name": customer_object.intake_object[2],
                "last_name": customer_object.intake_object[3],
                "country": 'US'
              }
            ],
            "metafields": [{
             "key": "details",
             "value": "Account #:" + "F" + customer_object.intake_object[18] + ", Company: " + customer_object.intake_object[30] + ", MFG Pro Bill #:" + "B" + customer_object.intake_object[7] + ", MFG Pro Ship #:" + "S" + customer_object.intake_object[29] + ",",
             "value_type": "string",
             "namespace": "account_data"
            }, ],
          }
        },
        json: true
      };
      resolve(customer_object);
    } catch (error) {

      var message = "Shopify: #" + customer_object.intake_object[0] + "- Unable to create Shopify customer PUT object."; 
      var errorMessage = middlewareErrors(customer_object.environment, "MFG PRO CUSTOMER INTAKE OBJECT", "/internal/route/customers", message);
      winston.error(errorMessage);
      resolve(customer_object);
    }
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY CUSTOMER INTAKE PUT - SHOPIFY PUT API CALL ----------------

function shopifyCustomerPUT(customer_object) {

  var promise = new Promise(function (resolve, reject) {

    request(customer_object.options).then(function (body) {

        customer_object.shopify_response = body;
        console.log(customer_object.shopify_response);
        resolve(customer_object);

      })
      .catch(function (error) {

        customer_object.shopify_response = error.response.body;

        var message = "Shopify: #" + customer_object.options.body.customer.id + "- " + JSON.stringify(error.response.body);
        var errorMessage = middlewareErrors(customer_object.environment, "SHOPIFY CUSTOMER INTAKE PUT", customer_object.domain, message);
        winston.error(errorMessage);
        resolve(customer_object);

      });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY CUSTOMER INTAKE PUT - SHOPIFY PUT API CALL ----------------

function shopifyCustomerInvite(customer_object) {

  var promise = new Promise(function (resolve, reject) {

    customer_object.invite = {
      method: 'POST',
      uri: 'https://' + customer_object.client_api_key + ':' + customer_object.client_api_password + '@' + customer_object.domain + '/admin/customers/' + customer_object.intake_object[0] + '/send_invite.json',
      body: {
        "customer_invite": {}
      },
      json: true
    };

    request(customer_object.invite).then(function (body) {

        customer_object.shopify_response = body;

        resolve(customer_object);

      })
      .catch(function (error) {

        customer_object.shopify_response = error.response.body;
        var message = "Shopify: #" + customer_object.options.body.customer.id + "- " + JSON.stringify(error.response.body);
        var errorMessage = middlewareErrors(customer_object.environment, "SHOPIFY CUSTOMER INVITE POST", customer_object.domain, message);
        winston.error(errorMessage);
        resolve(customer_object);

      });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY TO OBJECT ----------------

var fileObjectCreation = function (intake_array) {

  var intake_object = {};

  for (var i = 0; i < intake_array.length; ++i)
    if (intake_array[i] !== undefined) intake_object[i] = intake_array[i].toLowerCase().replace(/(^| )(\w)/g, s => s.toUpperCase());

  return intake_object;
}

// ---------------- MIDDLEWARE INTEGRATION LOOP THROUGH CUSTOMER REGISTRATION FILES AND SEND POST REQUESTS ----------------

var PostCustomerUpdates = async function (request_object) {

  let response = [];

  for (let file of request_object.file_array) {

    request_object.intake_object = file;
    request_object = await formatCustomerIntakeFile(request_object);
    request_object = await shopifyCustomerPUT(request_object);
    request_object = await shopifyCustomerInvite(request_object);
    response.push(request_object);

  }

  return response;
}

// -------------------------------- END --------------------------------
// -------------------------------- END --------------------------------


// -------------------------------- MIDDLEWARE FUNCTION --------------------------------

module.exports.middlewareHMACValidator = middlewareHMACValidator;
module.exports.webhookHMACValidator = webhookHMACValidator;
module.exports.webhookParsingMiddleware = webhookParsingMiddleware;

// -------------------------------- GLOBAL FUNCTION --------------------------------

module.exports.middlewareErrors = middlewareErrors;
module.exports.environmentValidation = environmentValidation;
module.exports.fileObjectCreation = fileObjectCreation; 

// -------------------------------- INTERNAL ROUTE --------------------------------

module.exports.internalAuthentication = internalAuthentication;
module.exports.internalAuthenticatedPOST = internalAuthenticatedPOST;
module.exports.customerFileCreation = customerFileCreation;
module.exports.PostCustomerUpdates = PostCustomerUpdates;

// -------------------------------- SHOPIFY REGISTRATION ROUTE --------------------------------

module.exports.customerRecordCreation = customerRecordCreation;
module.exports.shopifyCustomerPOST = shopifyCustomerPOST;
module.exports.shopifyAddressPUT = shopifyAddressPUT;

// -------------------------------- SHOPIFY ORDER INTAKE ROUTE --------------------------------

module.exports.orderObjectCreation = orderObjectCreation;

// -------------------------------- SHOPIFY PRICNG ROUTE --------------------------------

module.exports.pricingObjectTransformation = pricingObjectTransformation;
module.exports.shopifyPricingPUT = shopifyPricingPUT;
