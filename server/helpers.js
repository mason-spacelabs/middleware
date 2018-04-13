// ---------------- MIDDLEWARE INTEGRATION   ----------------
// ---------------- MIDDLEWARE INTEGRATION   ----------------

require('dotenv').config();

const fs = require('fs');
const request = require('request-promise');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const winston = require('./winston');

const {
  SHOPIFY_APP_KEY,
  SHOPIFY_APP_HOST,
  SHOPIFY_APP_SECRET,
  NODE_ENV,
} = process.env;

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

    if(NODE_ENV == 'production' && request_object.domain == 'spacelabshealthcare.myshopify.com'){

      request_object.query_string = process.env.MFG_PRO_PROD;
      request_object.client_api_key = process.env.SPACELABS_PROD_KEY;
      request_object.client_api_password = process.env.SPACELABS_PROD_PASSWORD;
      request_object.client_api_webhook = process.env.SPACELABS_PROD_WEBHOOK;
      request_object.environment = "PROD";

    }else if(NODE_ENV == 'production' && request_object.domain != 'spacelabshealthcare.myshopify.com'){
      
      winston.error("VALIDATION PRODUCTION MODE " + request_object.domain + " - Message: Unable to validate ecommerce environment.");
      reject(error);

    }else{

      switch(request_object.domain) {
        case 'spacelabshealthcare-dev.myshopify.com':
            
          request_object.client_api_key = process.env.SPACELABS_DEV_KEY;
          request_object.client_api_password = process.env.SPACELABS_DEV_PASSWORD;
          request_object.client_api_webhook = process.env.SPACELABS_DEV_WEBHOOK;
          request_object.environment = "DEV";

          break;
        case 'spacelabshealthcare-test.myshopify.com':
            
          request_object.client_api_key = process.env.SPACELABS_DEV_KEY;
          request_object.client_api_password = process.env.SPACELABS_DEV_PASSWORD;
          request_object.client_api_webhook = process.env.SPACELABS_DEV_WEBHOOK;
          request_object.environment = "TEST";

          break;
        default:
          winston.error("VALIDATION " + request_object.domain + " - Message: Unable to validate ecommerce environment.");
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

    if(NODE_ENV == 'production'){

      domain = 'spacelabshealthcare.myshopify.com';

    }else{
      switch(file_environment) {
        case 'DEV':
          domain = 'spacelabshealthcare-dev.myshopify.com';
          break;

        case 'TEST':
          domain = 'spacelabshealthcare-test.myshopify.com';
          break;

        default:
          winston.error("VALIDATION - Message: Unable to validate ecommerce file order intake environment.");
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
            "tags": "90022447, 90022449",
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
      winston.error("CREATE: "+ request_object.environment + " " + request_object.domain + " - Message: Unable to create Shopify customer POST object.");
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

      winston.error("POST: "+ request_object.environment + " " + request_object.domain + " - Message: " + JSON.stringify(error.response.body));
      reject({error: error.response.body});

    });
  });
  return promise;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - MFG PRO INTAKE FILE  ----------------

function customerFileCreation(response_object){

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

  fs.writeFile("./tmp/customer_request/" + response_object.environment + "_" + short_date + response_object.shopify_response.Customer + '.csv', customer_intake, function (error) {

    if (error){
    winston.error("WRITE: " + response_object.environment + " " + response_object.domain + "/ecommerce/spacelabs/register: Message - Unable to write MFG Pro customer intake file.");
    throw error;
    }

    console.log("The file was succesfully saved!");
    
  });
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

  console.timeEnd("Transforming POST Data");
  console.time("Retrieved MFG Pro Pricing");

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

        shopifyAccounts = request_object.response.ShopifyFacilityNumber + ", " + request_object.response.ShopifyShippingNumber;
        shopifyTagString += shopifyAccounts;

        request_object.client_tags = shopifyTagString;

        resolve(request_object);

      })
      .catch(function (error) {

        error.message = "Message: Unable to retrieve customer pricing";
        winston.error("GET: " + request_object.environment + " " + request_object.options.uri + " - " + error.message);
        reject(error);

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

    console.timeEnd("Retrieved MFG Pro Pricing");
    console.time("POST Pricing to Shopify Admin");

    var promise = new Promise(function(resolve, reject){

      request(request_object.shopify).then(function (body) {

        request_object.shopify_response = body;
        resolve(request_object);
    
      })
      .catch(function (err) {

        request_object.shopify_response = err.response.body;

        winston.error("PUT: " + request_object.environment + " " + request_object.domain + "/admin/customers/" + request_object.response.ShopifyCustomerNumber + ".json - Message: " + request_object.shopify_response);

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
  var secret = SHOPIFY_APP_SECRET;
  var sorted_parameters = "path_prefix=" + path_prefix + "shop=" + shop + "timestamp=" + timestamp;
  var calculated_signature = crypto.createHmac('sha256', secret).update(sorted_parameters).digest('hex');

  if (calculated_signature !== signature) {
    winston.error("VALIDATION /ecommerce/spacelabs/pricing: - Message: HMAC validation failed to connect to Shopify Server.");
    return res.status(400).send({response: "HMAC Validation Failed"});
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

    var completed_order="";
    var shipping_method = "";
    var line_items = request_object.response.line_items;
    var customer_tags = request_object.response.customer.tags;
    var tagsArray = customer_tags.split(", ");
    var facility_number = tagsArray.pop();
    var shipping_number = tagsArray.pop();

    var date = new Date(request_object.response.created_at);
    var short_date = (date.getMonth()+1 +'/' + date.getDate() + '/' + date.getFullYear());
    var order_date = (date.getMonth()+1 + '_' + date.getDate() + '_');

    var date_added = addDays(request_object.response.created_at, 1);
    var ship_date = (date_added.getMonth()+1 +'/' + date_added.getDate() + '/' + date_added.getFullYear());

    if(request_object.response.shipping_lines[0]){

      shipping_method = request_object.response.shipping_lines[0].source + " - " + request_object.response.shipping_lines[0].title;
      shipping_cost = request_object.response.shipping_lines[0].price;

    }else{

      shipping_method = "Shopify Undefined";
    }
  
    var order_header = {
      "Row ID": "H",
      "MFG Pro Ship-to": shipping_number,
      "Purchase Order Number": request_object.response.name,
      "PO Date": short_date,
      "MFG Pro Facility": facility_number,
      "Total Price": request_object.response.total_price,
      "Total Tax": request_object.response.total_tax,
      "Total Shipping Cost": shipping_cost,
      "Ship Via": shipping_method,
      "Ship Date": ship_date,
      "Total Weight": request_object.response.total_weight
    };
  
    for(var header in order_header){

      completed_order += order_header[header] + "|";
    }
  
    completed_order += "\n";
  
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

      completed_order += "\n";

    }  
  
    fs.writeFile("./tmp/orders/" + request_object.environment + "_" + order_date + request_object.response.id + '.txt', completed_order, function (error) {
  
      if (error){ 

        winston.error("WRITE " + request_object.environment + " /webhook/spacelabs/order: - Message: Unable to write MFG Pro customer order file.");
        reject();
      }

      console.log("The file was succesfully saved!");
      resolve();
  
    });
     
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

      winston.error("VALIDATION /webhook/spacelabs/order: - Message: Webhook HMAC validation failed to connect to Shopify Server.");
      res.sendStatus(403);

    }

  },function(error) {

    winston.error("SCRIPT /webhook/spacelabs/order: - Message: Script error comparing Shopify HMAC to generated hash.");
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
          if (intake_array[i] !== undefined) intake_object[i] = intake_array[i];
        return intake_object;
      }

      customer_object.intake_object = intake_object;
      customer_object.intake_raw = customer_read;

      if(error != 'null'){
        resolve(customer_object);
      }else{
        winston.error("READ " + customer_object.environment + " : Message - Unable to read MFG Pro verified customer intake file.");
        reject(error);
      }
    });
  });
  return promise;
};

var customerIntakeProcessed = function(customer_object){

  var promise = new Promise(function(resolve, reject){

    var file_name = customer_object.response.split('/').pop();

    if(customer_object.shopify_response.errors){
      fs.writeFile('./tmp/customer_verified/error/' + file_name, customer_object.intake_raw, function (error) {
        if (error) {                                                 
          winston.error("WRITE " + customer_object.environment + " : Message - Customer intake file cannot be created in the ERROR directory.");                         
        }    
        fs.unlink(customer_object.response, function (error) {            
          if (error) {                                                 
            winston.error("WRITE " + customer_object.environment + " : Message - Customer intake file cannot be removed from the INTAKE directory.");                          
          }                                                          
         console.log('File has an Error!');                           
        });         
      }); 
    }else{
      fs.writeFile('./tmp/customer_verified/processed/' + file_name, customer_object.intake_raw, function (err) {
        if (err) {                                                 
          winston.error("WRITE " + customer_object.environment + " : Message - Customer intake file cannot be created in the PROCESSED directory.");                             
        }    
        fs.unlink(customer_object.response, function (err) {            
          if (err) {                                                 
            winston.error("WRITE " + customer_object.environment + " : Message - Customer intake file cannot be removed from the INTAKE directory.");                        
          }                                                          
         console.log('File has been Processed!');                           
        });         
      }); 
    }
  });
  return promise;
};

// ---------------- MIDDLEWARE INTEGRATION CUSTOMER INTAKE VERIFIED - PARSE OBJECT FOR SHOPIFY PUT ----------------

var formatCustomerIntakeFile = function(customer_object){

  var promise = new Promise(function(resolve, reject){
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
            "tax_exempt": customer_object.intake_object[5],
            "addresses": [
              {
                "id": customer_object.intake_object[6],
                "company": customer_object.intake_object[8],
                "address1": customer_object.intake_object[9],
                "city": customer_object.intake_object[10],
                "province": customer_object.intake_object[11],
                "phone": customer_object.intake_object[12],
                "zip": customer_object.intake_object[13],
                "last_name": customer_object.intake_object[15],
                "first_name": customer_object.intake_object[14],
                "country": customer_object.intake_object[16]
              },
              {
                "id": customer_object.intake_object[17],
                "company": customer_object.intake_object[19],
                "address1": customer_object.intake_object[20],
                "city": customer_object.intake_object[21],
                "province": customer_object.intake_object[22],
                "phone": customer_object.intake_object[23],
                "zip": customer_object.intake_object[24],
                "last_name": customer_object.intake_object[26],
                "first_name": customer_object.intake_object[25],
                "country": customer_object.intake_object[27]
              },
              {
                "id": customer_object.intake_object[28],
                "company": customer_object.intake_object[30],
                "address1": customer_object.intake_object[31],
                "city": customer_object.intake_object[32],
                "province": customer_object.intake_object[33],
                "phone": customer_object.intake_object[34],
                "zip": customer_object.intake_object[35],
                "last_name": customer_object.intake_object[37],
                "first_name": customer_object.intake_object[36],
                "country": customer_object.intake_object[38]
              }
            ],
            "metafields": [
              {
                "key": "details",
                "value": "Account #:" + customer_object.intake_object[18] + ", Company: " + customer_object.intake_object[8] + ", MFG Pro Bill #:"+ customer_object.intake_object[29] + ", MFG Pro Ship #:" + customer_object.intake_object[7] + ",",
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
      winston.error("CREATE " + customer_object.environment + " " + customer_object.domain + " - Message: Unable to create Shopify customer PUT object.");
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
      winston.error("PUT: "+ customer_object.environment + " " + customer_object.domain + " - Message: " + JSON.stringify(error.response.body));
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
      winston.error("POST: " + customer_object.environment + " " + customer_object.domain + " - Message: " + JSON.stringify(error.response.body));
      reject(customer_object);

    });
  });
  return promise;
}
// -------------------------------- END --------------------------------
// -------------------------------- END --------------------------------

// ----- GLOBAL FUNCTION -----

module.exports.environmentValidation = environmentValidation;
module.exports.environmentFileValidation = environmentFileValidation;
module.exports.middlewareHMACValidator = middlewareHMACValidator;
module.exports.webhookHMACValidator = webhookHMACValidator;
module.exports.webhookParsingMiddleware = webhookParsingMiddleware;

// ----- /ECOMMERCE/SPACELABS/REGISTER -----

module.exports.customerRecordCreation = customerRecordCreation;
module.exports.shopifyCustomerPost = shopifyCustomerPost;
module.exports.customerFileCreation = customerFileCreation;

// ----- /ECOMMERCE/SPACELABS/PRICING -----

module.exports.MFGPricingGet = MFGPricingGet;
module.exports.shopifyPricingPut = shopifyPricingPut;

// ----- /WEBHOOK/SPACELABS/ORDERS -----

module.exports.orderFileCreation = orderFileCreation;

// ----- /WEBHOOK/SPACELABS/ORDERS -----

module.exports.readCustomerIntakeFile = readCustomerIntakeFile;
module.exports.formatCustomerIntakeFile = formatCustomerIntakeFile;
module.exports.shopifyCustomerPut = shopifyCustomerPut;
module.exports.shopifyCustomerInvite = shopifyCustomerInvite;
module.exports.customerIntakeProcessed = customerIntakeProcessed;


