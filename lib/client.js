'use strict';

var stringify = require('json-stringify-safe');
var parsers = require('./parsers');
var zlib = require('zlib');
var utils = require('./utils');
var uuid = require('node-uuid');
var transports = require('./transports');
var localContext = require('./localContext');
var node_util = require('util'); // node_util to avoid confusion with "utils"
var events = require('events');

module.exports.version = require('../package.json').version;

var extend = utils.extend;

var Client = function Client(dsn, options) {
  if (arguments.length === 0) {
    // no arguments, use default from environment
    dsn = process.env.SENTRY_DSN;
    options = {};
  }
  if (typeof dsn === 'object') {
    // They must only be passing through options
    options = dsn;
    dsn = process.env.SENTRY_DSN;
  }
  options = options || {};

  this.raw_dsn = dsn;
  this.dsn = utils.parseDSN(dsn);
  this.name = options.name || process.env.SENTRY_NAME || require('os').hostname();
  this.root = options.root || process.cwd();
  this.transport = options.transport || transports[this.dsn.protocol];
  this.release = options.release || process.env.SENTRY_RELEASE || '';
  this.environment = options.environment || process.env.SENTRY_ENVIRONMENT || '';

  this.loggerName = options.logger || '';
  this.dataCallback = options.dataCallback;

  if (this.dsn.protocol === 'https') {
    // In case we want to provide our own SSL certificates / keys
    this.ca = options.ca || null;
  }

  // enabled if a dsn is set
  this._enabled = !!this.dsn;

  // the global context is somewhat internal however when a local context
  // is created these attributes are copied over.  see `LocalContext` for
  // more information.
  var globalContext = this._globalContext = {};
  if (options.tags) {
    globalContext.tags = options.tags;
  }
  if (options.extra) {
    globalContext.extra = options.extra;
  }

  this.on('error', function(e) {}); // noop
};
node_util.inherits(Client, events.EventEmitter);
var proto = Client.prototype;

module.exports.Client = Client;

module.exports.captureBreadcrumb = function(crumb) {
  var context = localContext.contextManager.getContext();
  if (context) {
    context.captureBreadcrumb(crumb);
    return true;
  }
  return false;
};

proto.getIdent =
  proto.get_ident = function getIdent(result) {
    return result.id;
  };

proto.process = function process(kwargs) {
  var localCtx = localContext.contextManager.getContext();
  var ctx = localCtx || this._globalContext;
  kwargs.modules = utils.getModules();
  kwargs.server_name = kwargs.server_name || this.name;

  if (typeof process.version !== 'undefined') {
    kwargs.extra.node = process.version;
  }

  kwargs.environment = kwargs.environment || this.environment;
  kwargs.extra = extend({}, ctx.extra, kwargs.extra);
  kwargs.tags = extend({}, ctx.tags, kwargs.tags);

  kwargs.logger = kwargs.logger || this.loggerName;
  kwargs.event_id = uuid().replace(/-/g, '');
  kwargs.timestamp = new Date().toISOString().split('.')[0];
  kwargs.project = this.dsn.project_id;
  kwargs.platform = 'node';
  if (localCtx) {
    kwargs.breadcrumbs = localCtx.breadcrumbs.fetch();
  }

  if (ctx.user) {
    kwargs.user = ctx.user || kwargs.user;
  }

  // Only include release information if it is set
  if (this.release) {
    kwargs.release = this.release;
  }

  var ident = {
    id: kwargs.event_id
  };

  if (this.dataCallback) {
    kwargs = this.dataCallback(kwargs);
  }

  // this will happen asynchronously. We don't care about it's response.
  this._enabled && this.send(kwargs, ident);

  return ident;
};

proto.send = function send(kwargs, ident) {
  var self = this;
  
  var skwargs = stringify(kwargs);

  zlib.deflate(skwargs, function(err, buff) {
    var message = buff.toString('base64'),
      timestamp = new Date().getTime(),
      headers = {
        'X-Sentry-Auth': utils.getAuthHeader(timestamp, self.dsn.public_key, self.dsn.private_key),
        'Content-Type': 'application/octet-stream',
        'Content-Length': message.length
      };

    self.transport.send(self, message, headers, ident);
  });
};

proto.captureMessage = function captureMessage(message, kwargs, cb) {
  if (!cb && typeof kwargs === 'function') {
    cb = kwargs;
    kwargs = {};
  } else {
    kwargs = kwargs || {};
  }
  var result = this.process(parsers.parseText(message, kwargs));
  cb && cb(result);
  return result;
};

proto.captureException = function captureError(err, kwargs, cb) {
  if (!(err instanceof Error)) {
    // This handles when someone does:
    //   throw "something awesome";
    // We synthesize an Error here so we can extract a (rough) stack trace.
    err = new Error(err);
  }

  var self = this;
  if (!cb && typeof kwargs === 'function') {
    cb = kwargs;
    kwargs = {};
  } else {
    kwargs = kwargs || {};
  }
  parsers.parseError(err, kwargs, function(kw) {
    var result = self.process(kw);
    cb && cb(result);
  });
};
proto.captureError = proto.captureException; // legacy alias

proto.captureQuery = function captureQuery(query, engine, kwargs, cb) {
  if (!cb && typeof kwargs === 'function') {
    cb = kwargs;
    kwargs = {};
  } else {
    kwargs = kwargs || {};
  }
  var result = this.process(parsers.parseQuery(query, engine, kwargs));
  cb && cb(result);
  return result;
};

/* captures a breadcrumb.  This function does nothing in case no local
 * context is available and will return `false`.  More commonly the global
 * `captureBreadcrumb` function would be called which directly routes to a
 * client.
 */
proto.captureBreadcrumb = function captureBreadcrumb(crumb) {
  var context = this.getLocalContext();
  if (context) {
    context.captureBreadcrumb(crumb);
    return true;
  }
  return false;
};

/*
 * Returns the local context.  In case the local context integration is
 * not configured this can return `null`.
 */
proto.getLocalContext = function getLocalContext() {
  return localContext.contextManager.getOrCreateContext(this);
};

/*
 * Runs the given function enclosed in a local context.  This means that
 * code enclosed by this can at any point call `Client.getCurrent()` to
 * get the current client and `client.getLocalContext()` to retrieve the
 * local context object.
 *
 * This is used for breadcrumbs support and similar functionality.
 */
proto.runWithLocalContext = function(fn) {
  return localContext.contextManager.runWithContext(this, fn);
}

/*
 * When the client's local context integration is used this returns the
 * current client.  In case the local context integration is not configured
 * this can return `null`.
 */
Client.getCurrent = function() {
  var rv = localContext.contextManager.getContext();
  return rv && rv.client || null;
}

/*
 * Set/clear a user to be sent along with the payload.
 *
 * @param {object} user An object representing user data [optional]
 * @return {Raven}
 */
proto.setUserContext = function setUserContext(user) {
  var ctx = this.getLocalContext() || this._globalContext;
  ctx.user = user;
};

/*
 * Merge extra attributes to be sent along with the payload.
 *
 * @param {object} extra An object representing extra data [optional]
 * @return {Raven}
 */
proto.setExtraContext = function setExtraContext(extra) {
  var ctx = this.getLocalContext() || this._globalContext;
  ctx.extra = extend({}, ctx.extra, extra);
  return this;
};

/*
 * Merge tags to be sent along with the payload.
 *
 * @param {object} tags An object representing tags [optional]
 * @return {Raven}
 */
proto.setTagsContext = function setTagsContext(tags) {
  var ctx = this.getLocalContext() || this._globalContext;
  ctx.tags = extend({}, ctx.tags, tags);
  return this;
};

proto.patchGlobal = function patchGlobal(cb) {
  module.exports.patchGlobal(this, cb);
  return this;
};

module.exports.patchGlobal = function patchGlobal(client, cb) {
  // handle when the first argument is the callback, with no client specified
  if (typeof client === 'function') {
    cb = client;
    client = new Client();
    // first argument is a string DSN
  } else if (typeof client === 'string') {
    client = new Client(client);
  }
  // at the end, if we still don't have a Client, let's make one!
  !(client instanceof Client) && (client = new Client());

  var called = false;
  process.on('uncaughtException', function(err) {
    if (cb) { // bind event listeners only if a callback was supplied
      var onLogged = function onLogged() {
        called = false;
        cb(true, err);
      };

      var onError = function onError() {
        called = false;
        cb(false, err);
      };

      if (called) {
        client.removeListener('logged', onLogged);
        client.removeListener('error', onError);
        return cb(false, err);
      }

      client.once('logged', onLogged);
      client.once('error', onError);
    }

    called = true;

    client.captureError(err, function(result) {
      node_util.log('uncaughtException: ' + client.getIdent(result));
    });
  });
};
