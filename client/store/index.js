import { createStore, applyMiddleware } from 'redux';
import thunkMiddleware from 'redux-thunk';
import logger from 'redux-logger';

const requestFields = {
  verb: 'POST',
  path: '/customers.json',
  params: JSON.stringify({
    customer: {
      first_name: "Mason",
      last_name: "Halstead",
      email: "mason.halstead@spacelabs.com",
      phone: "+15142546011",
      verified_email: true,
      addresses: [
        {
          company: "Shipping Address",
          address1: "78848 148th Ave",
          city: "Redmond",
          province: "WA",
          phone: "555-1212",
          zip: "78952",
          last_name: "Something",
          first_name: "Name",
          country: "US"
        },
        {
          company: "Facility Address",
            address1: "78333 158th Ave",
            city: "Redmond",
            province: "WA",
            phone: "555-1212",
            zip: "123 ABC",
            last_name: "Lastnameson",
            first_name: "Mother",
            country: "US"
        },
        {
          company: "Billing Address",
            address1: "78333 158th Ave",
            city: "Bellevue",
            province: "WA",
            phone: "555-1212",
            zip: "45878",
            last_name: "Lastnameson",
            first_name: "Mother",
            country: "US"
        }
      ],
      "metafields": [
        {
          key: "details",
          value: "Account #: 7899-45-4577, GPO #: 9988-76-8888, Company: Spacelabs,",
          value_type: "string",
          namespace: "account_data"
        }
      ],
      "password": "password",
      "password_confirmation": "password",
      "send_email_welcome": false
    }
  }, null, 2)
};

const initState = {
  requestFields,
  requestInProgress: false,
  requestError: null,
  responseBody: '',
};

function reducer(state = initState, action) {
  switch (action.type) {
    case 'UPDATE_VERB':
      return {
        ...state,
        responseBody: '',
        requestFields: {
          ...state.requestFields,
          verb: action.payload.verb,
        },
      };
    case 'UPDATE_PATH':
      return {
        ...state,
        responseBody: '',
        requestFields: {
          ...state.requestFields,
          path: action.payload.path,
        },
      };
    case 'UPDATE_PARAMS':
      return {
        ...state,
        responseBody: '',
        requestFields: {
          ...state.requestFields,
          params: action.payload.params,
        },
      };
    case 'REQUEST_START':
      return {
        ...state,
        requestInProgress: true,
        requestError: null,
        responseBody: ''
      };
    case 'REQUEST_COMPLETE':
      return {
        ...state,
        requestInProgress: false,
        requestError: null,
        responseBody: action.payload.responseBody
      };
    case 'REQUEST_ERROR':
      return {
        ...state,
        requestInProgress: false,
        requestError: action.payload.requestError,
      };
    default:
      return state;
  }
}

const middleware = applyMiddleware(thunkMiddleware, logger);

const store = createStore(reducer, middleware);

export default store;
