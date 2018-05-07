// ---------------- MIDDLEWARE INTEGRATION   ----------------
// ---------------- MIDDLEWARE INTEGRATION   ----------------

require('dotenv').config();

const fs = require('fs');
const request = require('request-promise');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const winston = require('./winston');
const md5 = require('md5');

function middlewareErrors(environment, error_type, domain, message){

  var middleware_errors = environment + " " + error_type + " - " + domain + " - " + "Message: " + message;

  return middleware_errors;
}

// ---------------- MIDDLEWARE ENVIRONMENT CHECK - API ROUTES  ----------------

var environmentValidation = function(response){

  var promise = new Promise(function(resolve, reject){

    var request_object = {
      response: response.response,
      domain: response.domain,
      query_string: process.env.MFG_PRO_TEST,
      client_api_key: 'client_api_key',
      client_api_password: 'client_api_password',
      client_api_webhook: 'client_api_webhook',
      environment: '',
    };
    
    if(process.env.NODE_ENV == 'production' && request_object.domain == process.env.SPACELABS_PROD_ENV){

      request_object.query_string = process.env.MFG_PRO_PROD;
      request_object.client_api_key = process.env.SPACELABS_PROD_KEY;
      request_object.client_api_password = process.env.SPACELABS_PROD_PASSWORD;
      request_object.client_api_webhook = process.env.SPACELABS_PROD_WEBHOOK;
      request_object.environment = "PROD";

      resolve(request_object);

    }else if(process.env.NODE_ENV == 'production' && request_object.domain != process.env.SPACELABS_PROD_ENV){


      var errorMessage = middlewareErrors("PROD", "VALIDATION", request_object.domain, "Unable to validate ecommerce environment.");
      winston.error(errorMessage);

      reject(error);

    }else{

      switch(request_object.domain) {
        case process.env.SPACELABS_DEV_ENV:
            
          request_object.client_api_key = process.env.SPACELABS_DEV_KEY;
          request_object.client_api_password = process.env.SPACELABS_DEV_PASSWORD;
          request_object.client_api_webhook = process.env.SPACELABS_DEV_WEBHOOK;
          request_object.environment = "DEV";

          break;
        case process.env.SPACELABS_TEST_ENV:
            
          request_object.client_api_key = process.env.SPACELABS_TEST_KEY;
          request_object.client_api_password = process.env.SPACELABS_TEST_PASSWORD;
          request_object.client_api_webhook = process.env.SPACELABS_TEST_WEBHOOK;
          request_object.environment = "TEST";

          break;
        default:

          var errorMessage = middlewareErrors("DEV/TEST", "VALIDATION", request_object.domain, "Unable to validate ecommerce environment.");
          winston.error(errorMessage);
          reject(error);
      }
      resolve(request_object);
    }
  });
  return promise;
};

// ---------------- MIDDLEWARE ENVIRONMENT FILE CHECK - CUSTOMER INTAKE ----------------

var environmentFileValidation = function(response){

  var promise = new Promise(function(resolve, reject){

    var path_format = "./" + response.split("\\").join("/");
    var file_name = path_format.split('/').pop();
    var file_environment = file_name.split('_').reverse().pop();
    var domain = "";

    if(process.env.NODE_ENV == 'production'){
   
      domain = process.env.SPACELABS_PROD_ENV;

    }else{
      switch(file_environment) {
        case 'DEV':
          domain = process.env.SPACELABS_DEV_ENV;
          break;

        case 'TEST':
          domain = process.env.SPACELABS_TEST_ENV;
          break;

        default:

          var errorMessage = middlewareErrors("DEV/TEST", "VALIDATION", request_object.domain, "Unable to validate ecommerce file order intake environment.");
          winston.error(errorMessage);
          reject();
      }
    }

    var customer_object = {
      domain: domain,
      response: path_format
    };

    resolve(customer_object);
  });
  return promise;
};
// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - CUSTOMER RECORD  ----------------

function customerRecordCreation(request_object){

  var promise = new Promise(function(resolve, reject){

    try {

      if(request_object.response.ShippingName == request_object.response.FacilityName || request_object.response.BillingName){

        FacilityName = request_object.response.FacilityName + " (Facility)";
        BillingName = request_object.response.BillingName + " (Billing)";

      }else{

        FacilityName = request_object.response.FacilityName;
        BillingName = request_object.response.BillingName;

      }
  
      request_object.options = {
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
    }
    catch(error) {

      var errorMessage = middlewareErrors(request_object.environment, "SHOPIFY POST OBJECT", request_object.domain, "Unable to create Shopify customer POST object.");
      winston.error(errorMessage);
      reject();
    }
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - CUSTOMER SHOPIFY POST  ----------------

function shopifyCustomerPost(request_object) {

  var promise = new Promise(function(resolve, reject){

    request(request_object.options).then(function (body) {

      request_object.shopify_response = {
        "Customer": body.customer.id,
        "Shipping_Address": body.customer.addresses['0'].id,
        "Facility_Address": body.customer.addresses['1'].id,
        "Billing_Address": body.customer.addresses['2'].id
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

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - MFG PRO INTAKE FILE  ----------------

function customerFileCreation(response_object){

  var promise = new Promise(function(resolve, reject){

  try {

    var customer_intake = "";
    var date = new Date();
    var short_date = date.getMonth()+1 + '_' + date.getDate() + '_';

    var customer_headers = {
      "Shopify Customer ID": response_object.shopify_response.Customer,
      "Email": response_object.response.email,
      "First Name":response_object.response.Firstname,
      "Last Name": response_object.response.Lastname,
      "Phone Number":response_object.response.Phone,
      "Shopify Billing ID": response_object.shopify_response.Billing_Address,
      "Shopify Facility ID": response_object.shopify_response.Facility_Address,
      "Shopify Shipping ID": response_object.shopify_response.Shipping_Address
    };

    for(var header in customer_headers){

      customer_intake += customer_headers[header] + ",";
    }

    response_object.file_intake = {};
    response_object.file_intake.file_directory = 'custreq';
    response_object.file_intake.order_date = short_date;
    response_object.file_intake.error = "Please verify that the customer " + response_object.response.email + " has been created in Shopify Admin.";
    response_object.file_intake.order_parameter = customer_intake;

    resolve(response_object);
  }
  catch(error) {

    var errorMessage = middlewareErrors(request_object.environment, "MFG PRO CUSTOMER POST OBJECT", "/ecommerce/spacelabs/register", "Unable to create MFG Pro customer intake object.");
    winston.error(errorMessage);
    reject(error);
  }

  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - MFG PRICING REQUEST ----------------

function MFGPricingGet(request_object){

  request_object.options = {
    uri: request_object.query_string + request_object.response.RequestString,
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true
  };
  
  var promise = new Promise(function(resolve, reject){

    request(request_object.options)
      .then(function (response) {

        var pricingObject = {};
        var shopifyTagString = "";
        var shopifyAccounts = "";
        var increaseKey = 0;
        var increaseValue = 0;

        var raw = response;
        var rawArray = raw.split('|');
        
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
          
        for(var products in pricingObject){

          var pricingRaw = Object.values(pricingObject[products][4]).join(' ');
          var pricing = pricingRaw.replace(/\s/g,''); 

          var productRaw = Object.values(pricingObject[products][0]).join(' ');
          var product = productRaw.replace(/\s/g,'');

          var shopifyProductNumberRaw = Object.values(request_object.response.Variants[product]).join(' ');
          var shopifyProduct = shopifyProductNumberRaw.replace(/\s/g,''); 

          shopifyTagString += shopifyProduct + ":" + pricing + ", ";

        }

        shopifyAccounts = "F" + request_object.response.ShopifyFacilityNumber + ", S" + request_object.response.ShopifyShippingNumber + ", B" + request_object.response.ShopifyBillingNumber;
        shopifyTagString += shopifyAccounts;

        request_object.client_tags = shopifyTagString;

        resolve(request_object);

      })
      .catch(function (error) {
        
        var shopifyAccounts = "F" + request_object.response.ShopifyFacilityNumber + ", S" + request_object.response.ShopifyShippingNumber + ", B" + request_object.response.ShopifyBillingNumber;
        request_object.client_tags = shopifyAccounts;


        var errorMessage = middlewareErrors(request_object.environment, "MFG PRO PRICING GET", "ecommerce/spacelabs/pricing", "Unable to retrieve customer pricing from internal network.");
        winston.error(errorMessage);
        reject(request_object);

      });
    });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - SHOPIFY PRICING POST ----------------

function shopifyPricingPut(request_object) {

    request_object.shopify = {
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

    var promise = new Promise(function(resolve, reject){

      request(request_object.shopify).then(function (body) {

        request_object.shopify_response = body;
        resolve(request_object);
    
      })
      .catch(function (err) {

        request_object.shopify_response = err.response.body;

        var errorDomain = "admin/customers/" + request_object.response.ShopifyCustomerNumber + ".json";
        var errorMessage = middlewareErrors(request_object.environment, "SHOPIFY PRICING PUT", errorDomain, request_object.shopify_response);
        winston.error(errorMessage);

        reject(request_object);
    
      });
    });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - HMAC VALIDATION FROM SHOPIFY ----------------

function middlewareHMACValidator( req, res, next ) {

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

    return res.status(403).send({response: "HMAC Validation Failed"});
  }
  next();
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - CREATE ORDER DATE FOR MFG PRO ----------------

function addDays(date, days) {

  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;

}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - MFG PRO ORDER INTAKE FILE ----------------

function orderFileCreation(request_object){

  var promise = new Promise(function(resolve, reject){

    try {
      var completed_order="";
      var shipping_method = "";
      var line_items = request_object.response.line_items;
      var customer_tags = request_object.response.customer.tags;
      var tagsArray = customer_tags.split(", ");
      var shipping_number = tagsArray.pop().slice(1, 15);
      var facility_number = tagsArray.pop().slice(1, 15);
      var billing_number = tagsArray.pop().slice(1, 15);

      var date = new Date(request_object.response.created_at);
      var short_date = (date.getMonth()+1 +'/' + date.getDate() + '/' + date.getFullYear());
      var order_date = (date.getMonth()+1 + '_' + date.getDate() + '_');

      var date_added = addDays(request_object.response.created_at, 1);
      var ship_date = (date_added.getMonth()+1 +'/' + date_added.getDate() + '/' + date_added.getFullYear());

      switch(request_object.response.shipping_lines[0].title){
        case "FedEx 2 Day":
          shipping_method= "FEDEX11";
          break;
        case "FedEx Express Saver":
          shipping_method= "FEDEX3";
          break;
          case "FedEx Ground":
          shipping_method= "FEDEX99";
          break;
        case "FedEx Priority Overnight":
        shipping_method= "FEDEX1";
          break;
        default:
          shipping_method= "FEDEX99";
      }
      var order_header = {
        "Row ID": "H",
        "MFG Pro Sold-to": facility_number,
        "MFG Pro Bill-to": billing_number,
        "Shopify PO Number": request_object.response.name,
        "PO Date": short_date,
        "MFG Pro Ship-to": shipping_number,
        "Total Price": request_object.response.total_price,
        "Total Tax": request_object.response.total_tax,
        "Total Shipping Cost": request_object.response.shipping_lines[0].price,
        "Ship Via": shipping_method,
        "Ship Date": ship_date,
        "Total Weight": request_object.response.total_weight,
        "Email Address": request_object.response.email,
        "Authorize Invoice Number": "c" + request_object.response.checkout_id + ".1"
      };
    
      for(var header in order_header){

        completed_order += order_header[header] + "|";
      }
    
      completed_order += "%0A";
    
      for(var items in line_items){

        var line_number = parseInt(items) + 1;
        var pack_sku = line_items[items].sku;
        var pack_size = pack_sku.split('-').pop();
        var modified_size = "";

        if(pack_size == '00'){

          modified_size = '01';

        }else{

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

        for(var line in line_item){

          completed_order += line_item[line] + "|";

        }

        completed_order += "%0A";

      } 
      
      request_object.file_intake = {};
      request_object.file_intake.file_directory = 'so';
      request_object.file_intake.order_date = order_date;
      request_object.file_intake.error = "Please verify that order " + request_object.response.name + " has been created in MFG PRO";
      request_object.file_intake.order_parameter = completed_order.replace(/\s/g,"%20");

      resolve(request_object);
    }
    catch(error) {
      
      var errorMessage = middlewareErrors(request_object.environment, "MFG PRO ORDER POST OBJECT", "/webhook/spacelabs/order", "Unable to create the order intake post object for MFG PRO. Cross reference " + request_object.response.name + " in Shopify and verify in MFG PRO.");
      winston.error(errorMessage);

      reject();

    }
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - HMAC VALIDATION FROM SHOPIFY ----------------

function webhookHMACValidator(req,res,next){

  var request_object = {
    domain: req.headers['x-shopify-shop-domain'],
    response: req.body,
  };

  environmentValidation(request_object).then(function(response) {

    var generated_hash = crypto.createHmac('sha256', response.client_api_webhook).update(Buffer.from(req.rawbody)).digest('base64');

    if (generated_hash == req.headers['x-shopify-hmac-sha256']) {

      next();

    } else {

      var errorMessage = middlewareErrors(request_object.environment, "SHOPIFY VALIDATION", "/webhook/spacelabs/order", "Webhook HMAC validation failed to connect to Shopify Server.");
      winston.error(errorMessage);
      res.sendStatus(403);

    }

  },function(error) {

    var errorMessage = middlewareErrors(request_object.environment, "SHOPIFY VALIDATION SCRIPT", "/webhook/spacelabs/order", "Script error comparing Shopify HMAC to generated hash.");
    winston.error(errorMessage);
    res.sendStatus(403);

  });
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - WEBHOOK BODY PARSER FROM SHOPIFY ----------------

var webhookParsingMiddleware = bodyParser.json({type:'*/*',limit: '50mb',verify: function(req, res, buf) {
  if (req.url.includes('/webhook/')){
    req.rawbody = buf;
  }
}
});

// ---------------- MIDDLEWARE INTEGRATION CUSTOMER INTAKE VERIFIED - MFG PRO PARSE FILE TO OBJECT ----------------

var readCustomerIntakeFile = function(customer_object){

  var promise = new Promise(function(resolve, reject){

    fs.readFile(customer_object.response, {encoding: "utf8"}, function read(error, customer_read) {

      var intake_array = customer_read.split('|');
      var intake_object = toObject(intake_array);

      function toObject(intake_array) {
        var intake_object = {};
        
        for (var i = 0; i < intake_array.length; ++i)
        
          if (intake_array[i] !== undefined) intake_object[i] = intake_array[i].toLowerCase().replace(/(^| )(\w)/g, s => s.toUpperCase());
        return intake_object;
      }

      customer_object.intake_object = intake_object;
      customer_object.intake_raw = customer_read;

      if(error != 'null'){
        resolve(customer_object);
      }else{

        var errorMessage = middlewareErrors(customer_object.environment, "MFG PRO READ INTAKE FILE", "/tmp/customer_verified/intake", "Unable to read MFG Pro verified customer intake file.");
        winston.error(errorMessage);
        reject(error);
      }
    });
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION CUSTOMER INTAKE VERIFIED - MFG PRO PARSE FILE TO OBJECT ----------------

var customerIntakeProcessed = function(customer_object){

  var promise = new Promise(function(resolve, reject){

    if(customer_object.shopify_response.errors){

      fs.unlink(customer_object.response, function (error) {            
        if (error) {
          var errorMessage = middlewareErrors(customer_object.environment, "MFG PRO UPLOAD/DELETE INTAKE FILE", "/tmp/customer_verified/intake", "Customer intake file cannot be removed from the INTAKE directory and could not be uploaded to Shopify.");
          winston.error(errorMessage);                   
        }                                           

       console.log('File has ERROR but has been removed from intake folder!');   
                         
      });

    }else{
      fs.unlink(customer_object.response, function (err) {            
        if (err) {   

          var errorMessage = middlewareErrors(customer_object.environment, "MFG PRO DELETE INTAKE FILE", "/tmp/customer_verified/intake", "Customer intake file cannot be removed from the INTAKE directory.");
          winston.error(errorMessage);      

        }

       console.log('File has been processed and removed from intake folder!');  
                                
      });   
    }
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION CUSTOMER INTAKE VERIFIED - PARSE OBJECT FOR SHOPIFY PUT ----------------

var formatCustomerIntakeFile = function(customer_object){

  var promise = new Promise(function(resolve, reject){

    var tax_exempt = '';
  
    if(customer_object.intake_object[5] == 'No'){
      tax_exempt = false;
    }else{
      tax_exempt = true;
    }
    var company_billing = customer_object.intake_object[8];
    var company_facility = customer_object.intake_object[19];
    var company_shipping = customer_object.intake_object[30];
    
    if(customer_object.intake_object[30] == customer_object.intake_object[8] || customer_object.intake_object[30]){
      company_billing = customer_object.intake_object[8] + " (Billing)";
      company_facility = customer_object.intake_object[19] + " (Facility)";
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
            "addresses": [
              {
                "id": customer_object.intake_object[6],
                "company": company_billing,
                "address1": customer_object.intake_object[9],
                "city": customer_object.intake_object[10],
                "province": customer_object.intake_object[11],
                "phone": customer_object.intake_object[12],
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
                "phone": customer_object.intake_object[23],
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
                "phone": customer_object.intake_object[34],
                "zip": customer_object.intake_object[35],
                "first_name": customer_object.intake_object[2],
                "last_name": customer_object.intake_object[3],
                "country": 'US'
              }
            ],
            "metafields": [
              {
                "key": "details",
                "value": "Account #:" + "F" + customer_object.intake_object[18] + ", Company: " + customer_object.intake_object[30] + ", MFG Pro Bill #:" + "B" + customer_object.intake_object[7] + ", MFG Pro Ship #:" + "S" + customer_object.intake_object[29] + ",",
                "value_type": "string",
                "namespace": "account_data"
              },
            ],
          }
        },
        json: true
      };
      resolve(customer_object);
    }
    catch(error) {

      var errorMessage = middlewareErrors(customer_object.environment, "MFG PRO CUSTOMER INTAKE OBJECT", "/internal/route/customers", "Unable to create Shopify customer PUT object.");
      winston.error(errorMessage);  
      reject();
    }
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY CUSTOMER INTAKE PUT - SHOPIFY PUT API CALL ----------------

function shopifyCustomerPut(customer_object) {

  var promise = new Promise(function(resolve, reject){

    request(customer_object.options).then(function (body) {

      customer_object.shopify_response = body;
      resolve(customer_object);

    })
    .catch(function (error) {

      customer_object.shopify_response = error.response.body;

      var message = JSON.stringify(error.response.body);
      var errorMessage = middlewareErrors(customer_object.environment, "SHOPIFY CUSTOMER INTAKE PUT", customer_object.domain, message);
      winston.error(errorMessage);
      reject(customer_object);

    });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY CUSTOMER INTAKE PUT - SHOPIFY PUT API CALL ----------------

function shopifyCustomerInvite(customer_object) {
  
  var promise = new Promise(function(resolve, reject){

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
      var message = JSON.stringify(error.response.body);
      var errorMessage = middlewareErrors(customer_object.environment, "SHOPIFY CUSTOMER INVITE POST", customer_object.domain, message);
      winston.error(errorMessage);
      reject(customer_object);

    });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY CUSTOMER INTAKE PUT - SHOPIFY PUT API CALL ----------------

function internalFilePost(request_object) {
  
  var promise = new Promise(function(resolve, reject){
  
    request_object.file_options = {
      method: 'POST',
      uri: process.env.MFG_PRO_FILE_PUT + request_object.authentication.accountKey + request_object.authentication.accountID + request_object.authentication.cryptoHash + request_object.authentication.fileDirectory + request_object.authentication.fileName + request_object.authentication.orderData
    };

    request(request_object.file_options).then(function (body) {

      resolve(body);
    
    })
    .catch(function (error) {

      var message = "Failed to create an input file for MFG PRO. " + request_object.file_intake.error;
      var errorMessage = middlewareErrors(request_object.environment, "MFG PRO FILE POST", "/ShopifyERPLink/ERP/FilePut", message);
      winston.error(errorMessage);
      reject(error);

    });
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION SHOPIFY CUSTOMER INTAKE PUT - SHOPIFY PUT API CALL ----------------

function internalAuthentication(request_object) {

  var promise = new Promise(function(resolve, reject){

    request_object.file_intake.auth_options = {
      method: 'POST',
      uri: process.env.MFG_PRO_NONCE_GENERATOR
    }
    
    request(request_object.file_intake.auth_options).then(function (body) {
      
      var responseString = JSON.parse(body);
      var responseObject = JSON.parse(responseString);
      var authentication = responseObject[0].Pwd;
      var accountPassword = "TestAcctPwd";
      var fileName = '';
      var hashString = authentication += accountPassword;
      var cryptoHash = md5(hashString);

      if(request_object.file_intake.file_directory == 'so'){
        fileName = request_object.response.name;
      }else{
        fileName = request_object.shopify_response.Customer;
      }

      request_object.authentication = {};
      request_object.authentication.accountKey = 'Account=TestAcct';
      request_object.authentication.accountID = '&TokenId=' + responseObject[0].id;
      request_object.authentication.cryptoHash = '&AuthString=' + cryptoHash;
      request_object.authentication.fileDirectory = '&FileDir=' + request_object.file_intake.file_directory;
      request_object.authentication.fileName = '&FileName=' + request_object.environment + "_" + request_object.file_intake.order_date + fileName;
      request_object.authentication.orderData = '&FileData=' + request_object.file_intake.order_parameter;

      console.log(request_object.authentication.fileName);
      resolve(request_object);
      
    })
    .catch(function (error) {

      var message = "Failed to get authentication from internal key generation. " + request_object.file_intake.error;
      var errorMessage = middlewareErrors(request_object.environment, "MFG PRO INTERNAL AUTHENTICATION", "/ERP/NonceGenerator", message);
      winston.error(errorMessage);
      reject(error);

    });
  });
  return promise;
};

// -------------------------------- END --------------------------------
// -------------------------------- END --------------------------------

// ----- GLOBAL FUNCTION -----

module.exports.environmentValidation = environmentValidation;
module.exports.environmentFileValidation = environmentFileValidation;
module.exports.middlewareHMACValidator = middlewareHMACValidator;
module.exports.webhookHMACValidator = webhookHMACValidator;
module.exports.webhookParsingMiddleware = webhookParsingMiddleware;
module.exports.middlewareErrors = middlewareErrors;

// ----- /ECOMMERCE/SPACELABS/REGISTER -----

module.exports.customerRecordCreation = customerRecordCreation;
module.exports.shopifyCustomerPost = shopifyCustomerPost;
module.exports.customerFileCreation = customerFileCreation;

// ----- /ECOMMERCE/SPACELABS/PRICING -----

module.exports.MFGPricingGet = MFGPricingGet;
module.exports.shopifyPricingPut = shopifyPricingPut;

// ----- /WEBHOOK/SPACELABS/ORDERS -----

module.exports.orderFileCreation = orderFileCreation;
module.exports.internalAuthentication = internalAuthentication;
module.exports.internalFilePost = internalFilePost;

// ----- /WEBHOOK/SPACELABS/ORDERS -----

module.exports.readCustomerIntakeFile = readCustomerIntakeFile;
module.exports.formatCustomerIntakeFile = formatCustomerIntakeFile;
module.exports.shopifyCustomerPut = shopifyCustomerPut;
module.exports.shopifyCustomerInvite = shopifyCustomerInvite;
module.exports.customerIntakeProcessed = customerIntakeProcessed;


