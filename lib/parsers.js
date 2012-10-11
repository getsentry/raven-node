// builtin
var url = require('url');

// local
var runtime = require('./runtime');

module.exports.parseText = function parseText(message, kwargs) {
    kwargs = kwargs || {};
    kwargs.message = message;

    kwargs['sentry.interfaces.Message'] = {
        message: message,
        params: []
    };

    return kwargs;
};

module.exports.parseError = function parseError(err, kwargs, cb) {
    runtime.parseStack(err, function(e, frames) {
        if (e) {
            return cb(e);
        }

        kwargs['message'] = err.name+': '+(err.message || '<no message>');
        kwargs['sentry.interfaces.Exception'] = {type:err.name, value:err.message};

        if (frames) {
            kwargs['sentry.interfaces.Stacktrace'] = {frames:frames};
            kwargs['culprit'] = [
                (frames[0].filename || 'unknown file').replace(process.cwd()+'/', ''),
                (frames[0]['function'] || 'unknown function')
            ].join(':');
        }

        if (err) {
            kwargs['sentry.interfaces.Message'] = {
                message: err,
                params: []
            };
        }

        cb(null, kwargs);
    });
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

    // parse cookies if not already parsed
    var cookies = req.cookies || cookie.parse(req.headers.cookies);

    var host = req.headers.host || '<no host>';

    // create absolute url
    var full_url = (req.socket.encrypted ? 'https' : 'http') + '://' + host + req.url;

    kwargs['sentry.interfaces.Http'] = {
        method: req.method,
        query_string: url.parse(req.url).query,
        headers: req.headers,
        cookies: cookies,
        data: req.body || '<body unavailable>',
        url: full_url,
        env: process.env
    };

    return kwargs;
};
