require('isomorphic-fetch');
require('dotenv').config();

const fs = require('fs');
const express = require('express');
const session = require('express-session');
const RateLimit = require('express-rate-limit');
const RedisStore = require('connect-redis')(session);
const path = require('path');
const morgan = require('morgan');
const crypto = require('crypto');

const request = require('request-promise');
const helpers = require('./helpers');
const winston = require('./winston');
const bodyParser = require('body-parser');
const chokidar = require('chokidar');

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
const isDevelopment = NODE_ENV;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(morgan('combined', { stream: winston.stream }));

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

app.use(bodyParser.urlencoded({ extended: true }));

// ---------------- DYNAMIC SHOPIFY REGISTRATION ----------------

app.post('/ecommerce/spacelabs/register', helpers.middlewareHMACValidator, function(req ,res){

  var request_object = {
    domain: req.headers['x-forwarded-host'],
    response: req.body.contact
  };

  helpers.environmentValidation(request_object).then(helpers.customerRecordCreation).then(helpers.shopifyCustomerPost).then(function(response) {

    res.status(200).send({response: response.shopify_response});
    helpers.customerFileCreation(response);

  },function(error) {

    res.status(404).send(error);

  });
});

// ---------------- DYNAMIC SHOPIFY PRICING QUERY + POST TO SHOPIFY ----------------

app.post('/ecommerce/spacelabs/pricing', helpers.middlewareHMACValidator, function(req ,res){

  var request_object = {
    domain: req.headers['x-forwarded-host'],
    response: req.body
  };

  helpers.environmentValidation(request_object).then(helpers.MFGPricingGet).then(helpers.shopifyPricingPut).then(function(response) {

    res.status(200).send({response: response.shopify_response});

  },function(error) {

    res.status(403).send({error: error.message});

  });
});

// ---------------- ORDER INTAKE + STATIC FILE CREATION ----------------

app.post('/webhook/spacelabs/order', helpers.webhookParsingMiddleware, helpers.webhookHMACValidator, function(req ,res, next) {

  var request_object = {
    domain: req.headers['x-shopify-shop-domain'],
    response: req.body
  };

  helpers.environmentValidation(request_object).then(helpers.orderFileCreation).then(function(response) {

    res.sendStatus(200);

  },function(error) {

    res.sendStatus(403);

  });
});

// ---------------- VALID CUSTOMER UPDATE + WATCH ----------------

var watcher = chokidar.watch('./tmp/customer_verified/intake');

watcher.on('ready', function() { 
    watcher.on('add', function(path) {

      var file_path = "./" + path.split("\\").join("/");

      helpers.readIntakeFile(file_path).then(helpers.formatFileIntake).then(function (resolve) {
         
          console.log(resolve);
        })
        .catch(function (error) {
          console.log(error);
         
        });
    });
});

// function processFile(customer_intake) {

    // }

    //   customerVerification(path).then(function (resolve) {

    //     fs.unlink(resolve, function(){
    //       console.log("File has been processed");
    //     });
     
    // })
    // .catch(function (error) {
      
    //     console.log(error);
     
    // });
  function customerVerification(customer_intake) {

    var path = customer_intake;

    var promise = new Promise(function(resolve, reject){

      try {

        var file_path = "./" + path.split("\\").join("/");
        var file_name = path.split("\\").pop();
        var target_path = "./tmp/customer_verified/processed/" + file_name;

        fs.createReadStream(file_path).pipe(fs.createWriteStream(target_path));

        resolve(file_path);
      }
      catch(error) {

          reject(error);

      }
    });
    return promise;
 }
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

  winston.error(err.status || 500 + '-' + err.message + '-' + req.originalUrl + '-' + req.method + '-' + req.ip);

  response.status(error.status || 500);
  response.render('error');
});

module.exports = app;