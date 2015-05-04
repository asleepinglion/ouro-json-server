"use strict";

var SuperJS = require('superjs');
var express = require('express');
var merge = require('recursive-merge');
var fs = require('fs');
var _ = require('underscore');

module.exports = SuperJS.Class.extend({

  _metaFile: function() {
    this._loadMeta(__filename);
  },

  init: function(app, config) {

    this._super.apply(this, arguments);

    //localize dependent modules
    this.app = app;

    //instantiate express application
    this.express = express();

    //maintain list of middleware to load
    this.middleware = [];

    //server initialization
    this.enableMiddleware();
    this.loadMiddleware();
  },

  //setup list of middleware to load
  enableMiddleware: function() {

    //maintain reference to instance
    var self = this;

    this.middleware = [

      //enable cross origin resource sharing
      self.enableCors,

      //bind middleware to initialize response object
      self.enableResponse,

      //enable the body parser
      self.enableBodyParser,

      //enable the superjs router
      self.enableRouter
    ];
  },

  //attach middleware to the express application pipeline
  loadMiddleware: function() {

    //loop through middleware and execute methods to bind them to express
    for( var i in this.middleware ) {
      this.middleware[i].apply(this);
    }

  },

  //attach CORS (cross origin resource sharing) middleware
  enableCors: function() {

    var cors = require('cors');
    this.express.use(cors());

  },

  //attach response middleware
  enableResponse: function() {

    //maintain reference to instance
    var self = this;

    this.express.use(function(req, res, next) {
      self.initResponse(req, res, next);
    });

  },

  //attach body parser middleware
  enableBodyParser: function() {

    var bodyParser = require('body-parser');
    var multer = require('multer');

    //maintain reference to instance
    var self = this;

    //parse body for json
    this.express.use(bodyParser.json());

    //parse body for application/x-www-form-urlencoded data
    this.express.use(bodyParser.urlencoded({extended: true}));

    //parse body for multipart/form-data
    this.express.use(multer());

    //handle errors from body parser
    this.express.use(function(err, req, res, next) {

      console.error('error',err.stack);

      //set the response status based on the error
      res.status(err.status);

      //if 4**, assume invalid body, else unknown.
      if( err.status >= 400 && err.status < 500 ) {

        self.setResponse({meta: {success: false}, errors: [{"id": "invalid_body", status: err.status, message: "The body of your request is invalid."}]}, res);
        self.sendResponse(req, res);

      } else {
        self.setResponse({meta: {success: false}, errors: [{"id": "server_error", status: err.status, message: "The server encountered an unknown error."}]}, res);
        self.sendResponse(req, res);
      }
    });
  },

  //attach the superjs router middleware
  enableRouter: function() {

    //maintain reference to self
    var self = this;

    this.express.use(function(req, res) {
      self.app.newRequest(req, res);
    });

  },

  //initialize the response object
  initResponse: function(req, res, next) {

    //log access
    this.log.info('incoming request:',{method: req.method, url: req.originalUrl, ip: req.ip});

    var response = {meta:{name: this.configs.get('pkg').name, version: this.configs.get('pkg').version}};

    //initialize response object
    this.setResponse(response, res);

    //set the request start time
    req.startTime = new Date();

    //proceed to next request process
    return next();

  },

  //handle failed requests
  processError: function(err, req, res) {

    //maintain reference to self
    var self = this;

    //todo: create different types of SuperJS errors...

    //if super js error, the request has failed
    if( err instanceof SuperJS.Error ) {
      self.log.warn('request failed:', {code: err.code, message: err.message});

      //else, an unknown error has occurred
    } else {
      err.status = 500;
      err = new SuperJS.Error('unknown_error', 'An unknown error occured processing the request.', err);
      self.log.error('error occured:', {code: err.code, message: err.message });

    }

    //make the error stack easier to read
    if (typeof err.stack === 'string') {
      err.stack = err.stack.split('\n');
    }

    //delete extra bluebird error object variables
    delete err.__stackCleaned__;
    delete err.isOperational;

    //remove stack traces from response object unless option is enabled
    if( !self.configs.get('api').stackTraces ) {
      delete err.stack;
    }

    //output the error object to the console
    self.log.object(err);

    self.log.break();

    //prepare response object
    var response = {meta:{success: false}};

    //move err.status out to the meta section
    if( err.status ) {
      response.meta.status = err.status;
      delete err.status;
    }

    //store the error on the response object
    response.error = err;

    //merge changes onto the existing response object
    self.setResponse(response, res, response.meta.status);

    //send the response to the user
    self.sendResponse(req,res);
  },

  //merge object onto res.response
  setResponse: function(obj, res, status) {

    if( !obj ) {
      return;
    }

    if( !res.response ) {
      res.response = {};
    }

    //extend response object with obj
    res.response = merge(res.response, obj);

    //set response status if set
    if( status ) {
      res.status(status);
    }

  },

  //send res.response to the user
  sendResponse: function(resolve, reject, req, res) {

    //maintain reference to instance
    var self = this;

    //calculate request time
    var endTime = new Date();
    var requestDuration = endTime - req.startTime;
    res.response.meta.duration = requestDuration + 'ms';

    self.log.info('request duration:',{duration: requestDuration, unit:'ms'});
    self.log.break();

    //send response
    res.json(res.response);

    resolve();

  }

});
