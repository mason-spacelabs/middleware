require('dotenv').config();
const chalk = require('chalk');
const http = require('http');
require('isomorphic-fetch');
require('dotenv').config();

const fs = require('fs');
const express = require('express');
const session = require('express-session');
const RateLimit = require('express-rate-limit');

const cookieParser = require('cookie-parser');
const MemoryStore = require('session-memory-store')(session);

const path = require('path');
const morgan = require('morgan');
const crypto = require('crypto');
const cors = require('cors');

const request = require('request-promise');
const helpers = require('./helpers');
const winston = require('./winston');
const bodyParser = require('body-parser');
const chokidar = require('chokidar');

const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('./config/webpack.config.js');

const ShopifyAPIClient = require('shopify-api-node');
const ShopifyExpress = require('@shopify/shopify-express');
const {
  MemoryStrategy
} = require('@shopify/shopify-express/strategies');

const NODE_ENV = process.env.NODE_ENV;
const SHOPIFY_APP_KEY = process.env.SHOPIFY_APP_KEY;
const SHOPIFY_APP_SECRET = process.env.SHOPIFY_APP_SECRET;
const SHOPIFY_APP_HOST = process.env.NODE_ENV === "production" ? process.env.SHOPIFY_PROD_APP_HOST : process.env.SHOPIFY_TEST_APP_HOST;

const shopifyConfig = {
  host: SHOPIFY_APP_HOST,
  apiKey: SHOPIFY_APP_KEY,
  secret: SHOPIFY_APP_SECRET,
  scope: ['write_orders, read_orders, read_customers, write_customers, read_checkouts, write_checkouts'],
  shopStore: new MemoryStrategy(),
  afterAuth(request, response) {
    const {
      session: {
        accessToken,
        shop
      }
    } = request;

    return response.redirect('/');
  },
};

const registerWebhook = function (shopDomain, accessToken, webhook) {
  const shopify = new ShopifyAPIClient({
    shopName: shopDomain,
    accessToken: accessToken
  });
  shopify.webhook.create(webhook).then(
    response => console.log(`webhook '${webhook.topic}' created`),
    err => console.log(`Error creating webhook '${webhook.topic}'. ${JSON.stringify(err.response.body)}`)
  );
}

const app = express();
const isDevelopment = NODE_ENV;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(morgan('combined', {
  stream: winston.stream
}));
app.use(cookieParser());
app.use(
  session({
    store: new MemoryStore(),
    secret: SHOPIFY_APP_SECRET,
    resave: true,
    saveUninitialized: false,
  })
);

app.enable('trust proxy');


var apiLimiter = new RateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  delayMs: 0
});

app.use(apiLimiter);

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
app.get('/node/fs/service/install', (req, res) => res.render('install'));

// Create shopify middlewares and router
const shopify = ShopifyExpress(shopifyConfig);

// Mount Shopify Routes
const {
  routes,
  middleware
} = shopify;
const {
  withShop,
  withWebhook
} = middleware;

app.use('/', routes);

// Client
app.get('/', withShop, function (request, response) {

  const {
    session: {
      shop,
      accessToken
    }
  } = request;
  response.render('app', {
    title: 'Shopify Node App',
    apiKey: shopifyConfig.apiKey,
    shop: shop,
  });
});

// ---------------- MIDDLEWARE INTEGRATION FOR ECOMMERCE SITES ----------------
// ---------------- MIDDLEWARE INTEGRATION FOR ECOMMERCE SITES ----------------

app.use(bodyParser.urlencoded({
  extended: true
}));


var corsOptions = {
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'application/json']
}

// ---------------- DYNAMIC SHOPIFY RESET CUSTOMER TAGS ----------------

app.post('/node/fs/service/spacelabs/customer', cors(corsOptions), helpers.middlewareHMACValidator, function (req, res) {

  var request_object = {
    domain: req.headers['x-forwarded-host'],
    response: req.body,
    client_tags: req.body.ShopifyFacilityNumber + ", " + req.body.ShopifyShippingNumber + ", " + req.body.ShopifyBillingNumber
  };

  helpers.environmentValidation(request_object)
  .then(helpers.shopifyPricingPUT)
  .then(function (response) {

    res.status(200).send();

  }, function (error) {
    
    res.status(error.error.code).send(error.error.response);

  });
});

// ---------------- DYNAMIC SHOPIFY APPLICATION PROXY PRICING ----------------

app.post('/node/fs/service/spacelabs/pricing', cors(corsOptions), helpers.middlewareHMACValidator, function (req, res) {

  var request_object = {
    domain: req.headers['x-forwarded-host'],
    response: req.body,
    internal: {
      path: 'pricing',
      error: 'Unable to authenticate for pricing request.'
    },
    authentication: {
      method: 'POST',
      uri: process.env.NODE_ENV === "production" ? process.env.MFG_PRO_PROD_NONCE_GENERATOR : process.env.MFG_PRO_TEST_NONCE_GENERATOR,
    }
  };
  
  helpers.environmentValidation(request_object)
    .then(helpers.internalAuthentication)
    .then(helpers.internalAuthenticatedPOST)
    .then(helpers.pricingObjectTransformation)
    .then(helpers.shopifyPricingPUT)
    .then(function (response) {
      
      res.status(200).send({ response: 'success' });

    }, function (error) {

      helpers.shopifyPricingPUT(error).then(function (response) {

        res.status(error.error.code).send(error.error.response);

      }, function (error) {

        res.status(error.error.code).send(error.error.response);

      });

      res.status(error.error.code).send(error.error.response);

    });
});

// ---------------- DYNAMIC SHOPIFY APPLICATION PROXY REGISTRATION ----------------

app.post('/node/fs/service/spacelabs/register', cors(corsOptions), helpers.middlewareHMACValidator, function (req, res) {

  var request_object = {
    domain: req.headers['x-forwarded-host'],
    response: req.body.contact,
    internal: {
      path: 'register',
      error: 'Unable to authenticate for customer registration.'
    },
    authentication: {
      method: 'POST',
      uri: process.env.NODE_ENV === "production" ? process.env.MFG_PRO_PROD_NONCE_GENERATOR : process.env.MFG_PRO_TEST_NONCE_GENERATOR,
    }
  };

  helpers.environmentValidation(request_object)
    .then(helpers.internalAuthentication)
    .then(helpers.customerRecordCreation)
    .then(helpers.shopifyCustomerPOST)
    .then(helpers.shopifyAddressPUT)
    .then(helpers.customerFileCreation)
    .then(helpers.internalAuthenticatedPOST)
    .then(function (response) {

      res.status(200).send({ response: response.shopify_response });

      console.log("Successful Registrating Cycle!");

    }, function (error) {
      
      res.status(error.error.code).send({ response: error.error.response });

    });
});


// ---------------- DYNAMIC SHOPIFY WEBHOOK FTP ORDER CREATE ----------------

app.post('/node/fs/service/spacelabs/webhook/order', cors(corsOptions), helpers.webhookParsingMiddleware, function(req, res, next) {

  var request_object = {
    domain: req.headers['x-shopify-shop-domain'],
    response: req.body,
    rawbody: req.rawbody,
    hmac: req.headers['x-shopify-hmac-sha256'],
    client_api_webhook: '',
    environment: '',
    internal: {
      path: 'order',
      error: 'Unable to authenticate webhook orders.'
    },
    authentication: {
      method: 'POST',
      uri: process.env.NODE_ENV === "production" ? process.env.MFG_PRO_PROD_NONCE_GENERATOR : process.env.MFG_PRO_TEST_NONCE_GENERATOR,
    }
  };
  
  helpers.webhookHMACValidator(request_object)
  .then(helpers.internalAuthentication)
  .then(helpers.orderObjectCreation)
  .then(helpers.internalAuthenticatedPOST)
  .then(function(response) {

 res.sendStatus(200);
 
    console.log("Successfully sent order!");
  
  },function(error) {

  res.sendStatus(400);

  console.log("Failed to send order");

  });
});

// ---------------- MFG PRO CUSTOMER VERIFIED AND INVITE ----------------

function internalCustomerVerified() {

  var request_object = {
    domain: '',
    internal: {
      path: 'invite',
      error: 'Unable to authenticate internal path for verifed customer creation.'
    },
    authentication: {
      method: 'POST',
      uri: process.env.NODE_ENV === "production" ? process.env.MFG_PRO_PROD_NONCE_GENERATOR : process.env.MFG_PRO_TEST_NONCE_GENERATOR,
    }
  };

  helpers.environmentValidation(request_object)
    .then(helpers.internalAuthentication)
    .then(helpers.internalAuthenticatedPOST)
    .then(function (response) {

      var internal_response = JSON.parse(response.internal_response);
      var intake_array = "";
      var file_content = "";

      request_object.file_array = [];

      for (let items in internal_response.Files) {

        intake_array = internal_response.Files[items].Contents.split('|');
        file_content = helpers.fileObjectCreation(intake_array);
        request_object.file_array.push(file_content);

      }
      helpers.PostCustomerUpdates(request_object)
        .then(function (response) {

          console.log("Successfully checked registration files or sent invite!");

        }, function (error) {

          console.log("Error sending invite");

        });

    }, function (error) {

    });
};

// ---------------- MFG PRO SET INTERVAL CUSTOMER VERIFIED AND INVITE ----------------

setInterval(function(){ internalCustomerVerified(); }, 1000 * 60 * 10);

// -------------------------------- END --------------------------------
// -------------------------------- END --------------------------------

// Error Handlers
app.use(function (req, res, next) {

  const error = new Error('Spacelabs Healthcare Not Found');
  error.status = 404;
  next(error);
});

app.use(function (error, request, response, next) {
  response.locals.message = error.message;
  response.locals.error = request.app.get('env') === 'development' ? error : {};

  winston.error(error.status || 500 + '-' + error.message + '-' + request.originalUrl + '-' + request.method + '-' + request.ip);

  response.status(error.status || 500);
  response.render('error');
});

const port = process.env.PORT || '3000';
app.set('port', port);

const server = http.createServer(app);

server.listen(port, err => {
  if (err) {
    return console.log('😫', chalk.red(err));
  }
  console.log(`🚀 Now listening on port ${chalk.green(port)}`);
});
