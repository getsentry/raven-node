var utils = require('./utils');
var url = require('url');
var cookie = require('cookie');

var whiteList = module.exports.ENV_WHITE_LIST = ['REMOTE_ADDR', 'NODE_ENV'];

module.exports.parseText = function parseText(message, kwargs) {
    kwargs = kwargs || {};
    kwargs['message'] = message;
    return kwargs;
};

module.exports.parseError = function parseError(err, kwargs, cb) {
    utils.parseStack(err, function(frames) {
        kwargs['message'] = err.name + ': ' + (err.message || '<no message>');
        kwargs['sentry.interfaces.Exception'] = {
            type: err.name,
            value:err.message
        };
        kwargs['sentry.interfaces.Stacktrace'] = {frames: frames};

        // Save additional error properties to `extra` under the error type (e.g. `extra.AttributeError`)
        var extraErrorProps;
        for (var key in err) {
            if (err.hasOwnProperty(key)) {
                if (key !== 'name' && key !== 'message' && key !== 'stack') {
                    extraErrorProps = extraErrorProps || {};
                    extraErrorProps[key] = err[key];
                }
            }
        }
        if (extraErrorProps) {
            kwargs['extra'] = kwargs['extra'] || {};
            kwargs['extra'][err.name] = extraErrorProps;
        }

        for (var n = frames.length - 1; n >= 0; n--) {
            if (frames[n].in_app) {
                kwargs['culprit'] = utils.getCulprit(frames[n]);
                break;
            }
        }

        cb(kwargs);
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

    // create absolute url
    var host = req.headers.host || '<no host>';
    var full_url = (req.socket.encrypted || 'https' === req.headers['x-forwarded-proto'] ? 'https' : 'http') + '://' + host + req.url;

    var http = {
        method: req.method,
        query_string: url.parse(req.url).query,
        headers: req.headers,
        cookies: req.cookies || cookie.parse(req.headers.cookies || ''),
        data: req.body || '<unavailable>',
        url: full_url,
        env: {}
    };

    whiteList.forEach(function (key) {
        http.env[key] = process.env[key];
    });

    var ip = (req.headers['x-forwarded-for'] || '').split(',')[0] ||
             req.connection.remoteAddress;
    http.env.REMOTE_ADDR = ip;
    kwargs['sentry.interfaces.Http'] = http;
    return kwargs;
};
