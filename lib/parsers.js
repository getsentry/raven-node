var utils = require('./utils');
var compat = require('./compat');
var url = require('url');

module.exports.parseText = function parseText(message, kwargs) {
    kwargs = kwargs || {};
    kwargs['message'] = message;
    return kwargs;
};

module.exports.parseError = function parseError(err, kwargs, cb) {
    Error.prepareStackTrace = function(error, structuredStackTrace) {
        utils.parseStack(structuredStackTrace, function(frames) {
            kwargs['message'] = error.name + ': ' + (error.message || '<no message>');
            kwargs['sentry.interfaces.Exception'] = {
                type: error.name,
                value:error.message
            };

            kwargs['sentry.interfaces.Stacktrace'] = {frames: frames};

            cb(kwargs);
        });
        // Still return the formatted stack trace for anyone else who depends on it
        return compat.FormatStackTrace(error, structuredStackTrace);
    };
    // prepareStackTrace is triggered the first time .stack is accessed
    // so this is explicitly triggering it
    err.stack;
};

module.exports.parseQuery = function parseQuery(query, engine, kwargs) {
    kwargs = kwargs || {};
    kwargs['message'] = query;
    kwargs['sentry.interfaces.Query'] = {
        query: query,
        engine: engine
    };
    return kwargs;
};

module.exports.parseRequest = function parseRequest(req, kwargs) {
    kwargs = kwargs || {};
    kwargs['sentry.interfaces.Http'] = {
        method: req.method,
        query_string: url.parse(req.url).query,
        headers: req.headers,
        cookies: req.cookies || '<unavailable: use cookieParser middleware>',
        data: req.body || '<unavailable: use bodyParser middleware>',
        url: (function build_absolute_url() {
            var protocol = req.socket.encrypted ? 'https' : 'http',
                host = req.headers.host || '<no host>';
            return protocol+'://'+host+req.url;
        }()),
        env: process.env
    };
    return kwargs;
};
