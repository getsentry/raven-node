var parsers = require('./parsers');
var zlib = require('zlib');
var utils = require('./utils');
var parseUrl = require('url').parse;
var uuid = require('node-uuid');
var transports = require('./transports');
var node_util = require('util'); // node_util to avoid confusion with "utils"
var events = require('events');

module.exports.version = require('../package.json').version;

var Client = function Client(dsn, options) {
    if(arguments.length === 0) {
        // no arguments, use default from environment
        dsn = process.env.SENTRY_DSN;
        options = {};
    }
    if(typeof dsn === 'object') {
        // They must only be passing through options
        options = dsn;
        dsn = process.env.SENTRY_DSN;
    }
    options = options || {};

    this.raw_dsn = dsn;
    this.dsn = utils.parseDSN(dsn);
    this.name = options.name || process.env.SENTRY_NAME || require('os').hostname();
    this.site = options.site || process.env.SENTRY_SITE;
    this.root = options.root || process.cwd();
    this.transport = options.transport || transports[this.dsn.protocol];

    this.loggerName = options.logger || '';

    // enabled if a dsn is set
    this._enabled = !!this.dsn;


    this.on('error', function(e) {});  // noop
};
node_util.inherits(Client, events.EventEmitter);
var _ = Client.prototype;

module.exports.Client = Client;

_.getIdent =
_.get_ident = function getIdent(result) {
    return result.id;
};

_.process = function process(kwargs, cb) {
    kwargs['server_name'] = kwargs['server_name'] || this.name;
    kwargs['extra'] = kwargs['extra'] || {};
    kwargs['extra']['node'] = process.version;
    kwargs['logger'] = kwargs['logger'] || this.loggerName;
    kwargs['event_id'] = uuid().replace(/-/g, '');
    kwargs['timestamp'] = new Date().toISOString().split('.')[0];
    kwargs['project'] = this.dsn.project_id;
    kwargs['site'] = kwargs['site'] || this.site;
    kwargs['platform'] = 'node';

    var ident = {'id': kwargs['event_id']};
    var self = this;

    utils.getModules(function(err, pkgs) {
        kwargs['modules'] = pkgs || {};

        // this will happen asynchronously. We don't care about it's response.
        self._enabled && self.send(kwargs, ident);

        cb && cb(ident);
    });
};

_.send = function send(kwargs, ident) {
    var self = this;

    // stringify, but don't choke on circular references, see: http://stackoverflow.com/questions/11616630/json-stringify-avoid-typeerror-converting-circular-structure-to-json
    var cache = [];
    var skwargs = JSON.stringify(kwargs, function(k, v) {
        if (typeof v === 'object' && v !== null) {
            if (cache.indexOf(v) !== -1) return;
            cache.push(v);
        }
        return v;
    });

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

_.captureMessage = function captureMessage(message, kwargs, cb) {
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }
    this.process(parsers.parseText(message, kwargs), cb);
};

_.captureError =
_.captureException = function captureError(err, kwargs, cb) {
    if(!(err instanceof Error)) {
        // This handles when someone does:
        //   throw "something awesome";
        // We just send the "Error" as a normal message
        // since there is no way to compute a stack trace
        // See: https://github.com/mattrobenolt/raven-node/issues/18
        return this.captureMessage('Error: ' + err, kwargs, cb);
    }

    var self = this;
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }
    parsers.parseError(err, kwargs, function(kw) {
        self.process(kw, cb);
    });
};

_.captureQuery = function captureQuery(query, engine, kwargs, cb) {
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }
    this.process(parsers.parseQuery(query, engine, kwargs), cb);
};

_.patchGlobal = function patchGlobal(cb) {
    module.exports.patchGlobal(this, cb);
};

module.exports.patchGlobal = function patchGlobal(client, cb) {
    // handle when the first argument is the callback, with no client specified
    if(typeof client === 'function') {
        cb = client;
        client = new Client();
    // first argument is a string DSN
    } else if(typeof client === 'string') {
        client = new Client(client);
    }
    // at the end, if we still don't have a Client, let's make one!
    !(client instanceof Client) && (client = new Client());

    process.on('uncaughtException', function(err) {
        if(cb) {  // bind event listeners only if a callback was supplied
            client.once('logged', function() {
                cb(true, err);
            });
            client.once('error', function() {
                cb(false, err);
            });
        }
        client.captureError(err, function(result) {
            node_util.log('uncaughtException: '+client.getIdent(result));
        });
    });
};
