// ---------------- MIDDLEWARE INTEGRATION   ----------------
// ---------------- MIDDLEWARE INTEGRATION   ----------------

require('dotenv').config();

const fs = require('fs');
const shopify_config = require('./config.json');
const request = require('request-promise');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const {
  SHOPIFY_APP_KEY,
  SHOPIFY_APP_HOST,
  SHOPIFY_APP_SECRET,
  NODE_ENV,
} = process.env;

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - CUSTOMER RECORD  ----------------

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

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/REGISTER - MFG PRO INTAKE FILE  ----------------

function customerIntake(body, domain){
  var customer_intake = "";
  var customer_headers = {
    "Row ID": "H",
    "Transaction ID": 850,
    "Shopify Customer ID": body.customer.id,
    "Email": body.customer.email,
    "First Name":body.customer.first_name,
    "Last Name": body.customer.last_name,
    "Phone Number":body.customer.phone,
    "Shopify Billing ID": body.customer.addresses["2"].id,
    "Shopify Facility ID": body.customer.addresses["1"].id,
    "Shopify Shipping ID": body.customer.addresses["0"].id
  };

  for(var header in customer_headers){

    customer_intake += customer_headers[header] + "|";
  }

  var domain_config = shopify_config[domain];
  var environment_folder = domain_config.environment + '/';

  fs.writeFile("./tmp/customers/" + environment_folder + body.customer.id + '.txt', customer_intake, function (error) {

    if (error) throw error;

    console.log("The file was succesfully saved!");
    
  });
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - MFG PRICING REQUEST ----------------

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

        shopifyTagString += pricingObject[products][1].trim();
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

// ---------------- MIDDLEWARE INTEGRATION ROUTE ECOMMERCE/PRICING - SHOPIFY PRICING POST ----------------

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

function orderIntake(order){

  var completed_order="";
  var shipping_method = "";
  var line_items = order.line_items;

  var customer_tags = order.customer.tags;
  var customer_account = customer_tags.split(", ").pop();

  var date = new Date(order.created_at);
  var short_date = (date.getMonth()+1 +'/' + date.getDate() + '/' + date.getFullYear());

  var date_added = addDays(order.created_at, 3);
  var ship_date = (date_added.getMonth()+1 +'/' + date_added.getDate() + '/' + date_added.getFullYear());

  if(order.shipping_lines[0]){

    shipping_method = order.shipping_lines[0].source + " - " + order.shipping_lines[0].title;
  }else{

    shipping_method = "Shopify Undefined";
  }

  var order_header = {
    "Row ID": "H",
    "Transaction ID": "850",
    "Accounting ID": customer_account,
    "Purchase Order Number": order.id,
    "PO Date": short_date,
    "Ship To Name": order.shipping_address.first_name,
    "Ship To Address - Line One": order.shipping_address.address1,
    "Ship To Address - Line Two": order.shipping_address.address2,
    "Ship To City": order.shipping_address.city,
    "Ship To State": order.shipping_address.province,
    "Ship To Zip code": order.shipping_address.zip,
    "Ship To Country": order.shipping_address.country,
    "Store #": "",
    "Bill To Name": order.billing_address.first_name,
    "Bill To Address - Line One": order.billing_address.address1,
    "Bill To Address - Line Two": order.billing_address.address2,
    "Bill To City": order.billing_address.city,
    "Bill To State": order.billing_address.province,
    "Bill To Zip code": order.billing_address.zip,
    "Bill To Country": order.billing_address.country,
    "Bill To Code": "",
    "Ship Via": shipping_method,
    "Ship Date": ship_date,
    "Terms": "",
    "Note": "",
    "Department Number": "",
    "Cancel Date": "",
    "Do Not Ship Before": short_date,
    "Do Not Ship After": short_date,
    "Allowance Percent1": "",
    "Allowance Amount1": "",
    "Allowance Precent2": "",
    "Allowance Amount2": "",
  };

  for(var header in order_header){

    completed_order += order_header[header] + "|";
  }

  for(var items in line_items){

    var line_number = parseInt(items) + 1;
    var line_item = {
      "Row ID": "I",
      "Line #": line_number,
      "Vendor Part #": "",
      "Buyer Part #": "",
      "UPC #": "",
      "Description": line_items[items].title,
      "Quantity": line_items[items].quantity,
      "UOM": "Each",
      "Unit Price": line_items[items].price,
      "Pack Size": "",
      "# of Inner Packs": "",
      "Item Allowance Percent1": "",
      "Item Allowance Amount1": "",
  };

    for(var line in line_item){

      completed_order += line_item[line] + "|";
    }
  }  
  return completed_order;
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - HMAC VALIDATION FROM SHOPIFY ----------------

function webhookHMACValidator(req,res,next){

  var environment = req.get('x-shopify-shop-domain');
  var domain_config = shopify_config[environment];
  var sharedSecret = domain_config.webhook_secret;
  var environment_folder = domain_config.environment + '/';

  var generated_hash = crypto.createHmac('sha256', sharedSecret).update(Buffer.from(req.rawbody)).digest('base64');

  if (generated_hash == req.headers['x-shopify-hmac-sha256']) {
    req.root = environment_folder;
    next();
  } else {

    res.sendStatus(403);
  }
}

// ---------------- MIDDLEWARE INTEGRATION ROUTE WEBHOOK/ORDERS - WEBHOOK BODY PARSER FROM SHOPIFY ----------------

var parsingWebhook = bodyParser.json({type:'*/*',limit: '50mb',verify: function(req, res, buf) {
  if (req.url.includes('/webhook/')){
    req.rawbody = buf;
  }
}
});

// -------------------------------- END --------------------------------
// -------------------------------- END --------------------------------

module.exports.customerIntake = customerIntake;
module.exports.middlewareHMACValidator = middlewareHMACValidator;
module.exports.webhookHMACValidator = webhookHMACValidator;
module.exports.parsingWebhook = parsingWebhook;
module.exports.orderIntake = orderIntake;
module.exports.shopifyPricingPut = shopifyPricingPut;
module.exports.customerRecord = customerRecord;
module.exports.MFG_Request = MFG_Request;
