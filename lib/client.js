// builtin
var zlib = require('zlib');
var util = require('util');
var events = require('events');

// vendor
var uuid = require('node-uuid');
var lsmod = require('lsmod');

// local
var transports = require('./transports');
var DSN = require('./dsn');
var interfaces = require('./interfaces');

var version = require('../package.json').version;

var Client = function Client(dsn, options) {
    if (arguments.length === 0) {
        // no arguments, use default from environment
        dsn = process.env.SENTRY_DSN;
        options = {};
    }

    if (typeof dsn === 'object') {
        // They must only be passing through options
        options = dsn;
        dsn = options.dsn || process.env.SENTRY_DSN;
    }

    options = options || {};

    this.dsn = DSN.parse(dsn);

    this.name = options.name || process.env.SENTRY_NAME || require('os').hostname();
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

util.inherits(Client, events.EventEmitter);

module.exports = Client;

// expose parse dsn
Client.parseDSN = DSN.parse;

Client.prototype.getIdent = function (result) {
    return result.id;
};

Client.prototype.send = function (packet) {
    var self = this;

    var event_id = uuid().replace(/-/g, '');

    packet.modules = lsmod();
    packet.server_name = packet.server_name || this.name;
    packet.extra = packet.extra || {};
    packet.extra.node = process.version;

    packet.event_id = event_id;
    packet.timestamp = new Date().toISOString().split('.')[0];
    packet.project = this.dsn.project_id;
    packet.site = packet.site || this.site;

    var timestamp = new Date().getTime();
    var auth = [
        'Sentry sentry_version=2.0',
        'sentry_timestamp=' + timestamp,
        'sentry_client=raven-node/' + version,
        'sentry_key=' + self.dsn.public_key,
        'project_id=' + self.dsn.project_id
    ].join(', ');

    if (this._enabled) {
        zlib.deflate(JSON.stringify(packet), function(err, buff) {
            var message = buff.toString('base64');
            self.transport.send(self, auth, message, function(err) {
                if (err) {
                    return self.emit('error', err);
                }

                self.emit('logged');
            });
        });
    };

    // TODO if not enabled we still return? (shtylman)
    return { id: event_id };
};

Client.prototype.captureMessage = function captureMessage(message, kwargs, cb) {
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }

    kwargs.message = message;
    kwargs[interfaces.message.key] = interfaces.message(message);

    var result = this.send(kwargs);
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

    kwargs.message = err.name + ': ' + (err.message || '<no message>');
    kwargs[interfaces.exception.key] = interfaces.exception(err);

    interfaces.stacktrace(err, function(e, res) {
        if (e) {
            return self.emit('error', err);
        }

        var frames = res.frames;
        if (frames) {
            kwargs[interfaces.stacktrace.key] = res;
            kwargs.culprit = [
                (frames[0].filename || 'unknown file').replace(process.cwd()+'/', ''),
                (frames[0].function || 'unknown function')
            ].join(':');
        }

        var result = self.send(kwargs);
        cb && cb(result);
    });
};

/// @deprecated
Client.prototype.captureQuery = function captureQuery(query, engine, kwargs, cb) {
    if(!cb && typeof kwargs === 'function') {
        cb = kwargs;
        kwargs = {};
    } else {
        kwargs = kwargs || {};
    }

    kwargs.message = query;
    kwargs[interfaces.query.key] = interfaces.query(query, engine);

    var result = this.send(kwargs);
    cb && cb(result);

    return result;
};

