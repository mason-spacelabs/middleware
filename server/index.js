require('isomorphic-fetch');
require('dotenv').config();

const fs = require('fs');
const express = require('express');
const session = require('express-session');
const RateLimit = require('express-rate-limit');
const RedisStore = require('connect-redis')(session);
const path = require('path');
const logger = require('morgan');
const crypto = require('crypto');

const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('../config/webpack.config.js');

const ShopifyAPIClient = require('shopify-api-node');
const ShopifyExpress = require('@shopify/shopify-express');
const {MemoryStrategy} = require('@shopify/shopify-express/strategies');

const {
  SHOPIFY_APP_KEY,
  SHOPIFY_APP_HOST,
  SHOPIFY_APP_SECRET,
  NODE_ENV,
} = process.env;

const shopifyConfig = {
  host: SHOPIFY_APP_HOST,
  apiKey: SHOPIFY_APP_KEY,
  secret: SHOPIFY_APP_SECRET,
  scope: ['write_orders, read_orders, read_customers, write_customers, read_checkouts, write_checkouts'],
  shopStore: new MemoryStrategy(),
  afterAuth(request, response) {
    const { session: { accessToken, shop } } = request;

    // registerWebhook(shop, accessToken, {
    //   topic: 'orders/create',
    //   address: `${SHOPIFY_APP_HOST}/order-create`,
    //   format: 'json'
    // });

    return response.redirect('/');
  },
};

const registerWebhook = function(shopDomain, accessToken, webhook) {
  const shopify = new ShopifyAPIClient({ shopName: shopDomain, accessToken: accessToken });
  shopify.webhook.create(webhook).then(
    response => console.log(`webhook '${webhook.topic}' created`),
    err => console.log(`Error creating webhook '${webhook.topic}'. ${JSON.stringify(err.response.body)}`)
  );
}

const app = express();
const isDevelopment = NODE_ENV !== 'production';
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('combined', {stream: accessLogStream}));
app.use(logger('dev'));

app.use(
  session({
    store: isDevelopment ? undefined : new RedisStore(),
    secret: SHOPIFY_APP_SECRET,
    resave: true,
    saveUninitialized: false,
  })
);

app.enable('trust proxy'); 

var apiLimiter = new RateLimit({
  windowMs: 15*60*1000, 
  max: 100,
  delayMs: 0 
});

app.use('/ecommerce/', apiLimiter);

// Run webpack hot reloading in dev
if (isDevelopment) {
  const compiler = webpack(config);
  const middleware = webpackMiddleware(compiler, {
    hot: true,
    inline: true,
    publicPath: config.output.publicPath,
    contentBase: 'src',
    stats: {
      colors: true,
      hash: false,
      timings: true,
      chunks: false,
      chunkModules: false,
      modules: false,
    },
  });

  app.use(middleware);
  app.use(webpackHotMiddleware(compiler));
} else {
  const staticPath = path.resolve(__dirname, '../assets');
  app.use('/assets', express.static(staticPath));
}

// Install
app.get('/install', (req, res) => res.render('install'));

// Create shopify middlewares and router
const shopify = ShopifyExpress(shopifyConfig);

// Mount Shopify Routes
const {routes, middleware} = shopify;
const {withShop, withWebhook} = middleware;

app.use('/', routes);

// Client
app.get('/', withShop, function(request, response) {
  const { session: { shop, accessToken } } = request;
  response.render('app', {
    title: 'Shopify Node App',
    apiKey: shopifyConfig.apiKey,
    shop: shop,
  });
});

// ---------------- MIDDLEWARE INTEGRATION FOR ECOMMERCE SITES ----------------
// ---------------- MIDDLEWARE INTEGRATION FOR ECOMMERCE SITES ----------------

const request = require('request-promise');
const helpers = require('./helpers');
const cors = require('cors');
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true }));

var whitelist = ['https://spacelabshealthcare-dev.myshopify.com', 'https://spacelabshealthcare-test.myshopify.com','https://spacelabshealthcare.myshopify.com'];

var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

// ---------------- DYNAMIC SHOPIFY REGISTRATION ----------------

app.post('/ecommerce/register', cors(corsOptions), function(req ,res){

  var registration_data = req.body.contact;
  var domain_header = req.headers.origin;
  var domain = domain_header.replace(/^(https?:|)\/\//,'');

  var shopify_customer_record = helpers.customerRecord(registration_data, domain);

  request(shopify_customer_record).then(function (body) {

    var shopify_customer_form = {
      "Customer": body.customer.id,
      "Shipping_Address": body.customer.addresses["0"].id,
      "Facility_Address": body.customer.addresses["1"].id,
      "Billing_Address": body.customer.addresses["2"].id,
    };

    res.status(200).send({response: shopify_customer_form});

  })
  .catch(function (err) {

    res.status(422).send({error: err.response.body});

  });
});

// ---------------- DYNAMIC SHOPIFY PRICING QUERY + POST TO SHOPIFY ----------------

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

app.post('/ecommerce/pricing', middlewareHMACValidator, function(req ,res){
  
  console.time("RECIEVE DATA");
  var shopify_data = req.body;
  var domain_header = req.headers.origin;
  var domain = domain_header.replace(/^(https?:|)\/\//,'');
  var query_string = "https://qmstest.spacelabshealthcare.com/BMIQ2O/Q2O/GetPricing?openagent&USA&" + shopify_data.RequestString;

  var shopify_pricing = {
    shopify_request: shopify_data,
    header: domain,
    options: {
      uri: query_string,
      headers: {
          'User-Agent': 'Request-Promise'
      },
      json: true
    }
  };

  helpers.MFG_Request(shopify_pricing).then(helpers.shopifyPricingPut).then(function(response) {

    console.timeEnd("SHOPIFY POST PRICING");

    res.status(200).send({response: response});

  },function(error) {

  res.status(400).send({response: error});

  });
});

// ---------------- ORDER INTAKE ----------------

function webhookHMACValidator(req,res,next){

  var environment = req.get('x-shopify-shop-domain');
  var sharedSecret="";
  var environment_folder = "";

  switch(environment) {
    case 'spacelabshealthcare-dev.myshopify.com':
      sharedSecret="942d812cbcc1c70db91013c659126d432c21ce33d235af5744f2cf139ab30e2b";
      environment_folder = "dev/";
      break;
    case 'spacelabshealthcare-test.myshopify.com':
      sharedSecret="942d812cbcc1c70db91013c659126d432c21ce33d235af5744f2cf139ab30e2b";
      environment_folder = "test/";
      break;
    case 'spacelabshealthcare.myshopify.com':
      sharedSecret="8e4ccaf7dbdedc234dfe5281ac4de44d7cf10245bba734a04b148c073c6b17bf";
      environment_folder = "prod/";
      break;
    default:
      environment_folder ="error/";
      sharedSecret="942d812cbcc1c70db91013c659126d432c21ce33d235af5744f2cf139ab30e2b";
  }

  var generated_hash = crypto.createHmac('sha256', sharedSecret).update(Buffer.from(req.rawbody)).digest('base64');

  if (generated_hash == req.headers['x-shopify-hmac-sha256']) {
    req.root = environment_folder;
    next();
  } else {

    res.sendStatus(403);
  }
}

var parsingWebhook = bodyParser.json({type:'*/*',limit: '50mb',verify: function(req, res, buf) {
    if (req.url.includes('/webhook/')){
      req.rawbody = buf;
    }
  }
});

app.post('/webhook/order', parsingWebhook, webhookHMACValidator, function(req ,res, next) {

  try {

    var order = req.body;
    var completed_order = helpers.orderIntake(order);

    fs.writeFile("orders/" + req.root + order.id + '.txt', completed_order, function (err) {

      if (err) throw err;
      console.log("The file was succesfully saved!");
    });

    res.sendStatus(200);
  }
  catch(error) {

    console.log(error);
    res.sendStatus(403);
  }
});

// -------------------------------- END --------------------------------
// -------------------------------- END --------------------------------

// Error Handlers
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(error, request, response, next) {
  response.locals.message = error.message;
  response.locals.error = request.app.get('env') === 'development' ? error : {};

  response.status(error.status || 500);
  response.render('error');
});

module.exports = app;
