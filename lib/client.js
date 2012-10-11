// builtin
var zlib = require('zlib');
var node_util = require('util'); // node_util to avoid confusion with "utils"
var events = require('events');

// vendor
var uuid = require('node-uuid');

// local
var parsers = require('./parsers');
var transports = require('./transports');
var DSN = require('./dsn');
var utils = require('./utils');

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
    this.dsn = DSN.parse(dsn);

    this.name = options.name || process.env.SENTRY_NAME || require('os').hostname();
    this.site = options.site || process.env.SENTRY_SITE;
    this.root = options.root || process.cwd();

    this._enabled = !!this.dsn;

    if(!this._enabled && this.dsn !== false) {
        // we want to be silent only when FALSE is explicitly passed for a DSN value
        console.warn('Warning: Sentry logging is disabled, please set a valid DSN to enable');
    }

    // no transport if not enabled
    if (!this._enabled) {
        return;
    }

    this.transport = transports[this.dsn.protocol];
    if (!this.transport) {
        throw new Error('invalid transport');
    }
};

node_util.inherits(Client, events.EventEmitter);

module.exports.Client = Client;

// expose parse dsn
Client.parseDSN = DSN.parse;

Client.prototype.getIdent = function getIdent(result) {
    return result.id + '$' + result.checksum;
};

Client.prototype.process = function process(kwargs) {
    var event_id = uuid().replace(/-/g, '');
    var checksum = kwargs.checksum || utils.constructChecksum(kwargs);

    kwargs.modules = utils.getModules();
    kwargs.server_name = kwargs.server_name || this.name;
    kwargs.extra = kwargs.extra || {};
    kwargs.extra.node = process.version;
    kwargs.checksum = checksum;

    kwargs.event_id = event_id;
    kwargs.timestamp = new Date().toISOString().split('.')[0];
    kwargs.project = this.dsn.project_id;
    kwargs.site = kwargs.site || this.site;

    // this will happen asynchronously. We don't care about it's response.
    this._enabled && this.send(kwargs);

    // TODO if not enabled we still return? (shtylman)
    return {'id': event_id, 'checksum': checksum};
};

Client.prototype.send = function send(kwargs) {
    var self = this;

    zlib.deflate(JSON.stringify(kwargs), function(err, buff) {
        var message = buff.toString('base64');
        self.transport.send(self, message, function(err) {
            if (err) {
                return self.emit('error', err);
            }

            self.emit('logged');
        });
    });
};

Client.prototype.captureMessage = function captureMessage(message, kwargs, cb) {
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }

    var result = this.process(parsers.parseText(message, kwargs));
    cb && cb(result);
    return result;
};

Client.prototype.captureError = function captureError(err, kwargs, cb) {
    var self = this;
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }

    parsers.parseError(err, kwargs, function(err, kw) {
        if (err) {
            return self.emit('error', err);
        }

        var result = self.process(kw);
        cb && cb(result);
    });
};

Client.prototype.captureQuery = function captureQuery(query, engine, kwargs, cb) {
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }

    var result = this.process(parsers.parseQuery(query, engine, kwargs));
    cb && cb(result);
    return result;
};

