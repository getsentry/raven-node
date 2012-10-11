// sentry.interfaces.Http

// builtin
var url = require('url');

// vendor
var cookie = require('cookie');

module.exports = function(req) {
    // parse cookies if not already parsed
    var cookies = req.cookies || cookie.parse(req.headers.cookies || '');

    var host = req.headers.host || '<no host>';

    // create absolute url
    var full_url = (req.socket.encrypted ? 'https' : 'http') + '://' + host + req.url;

    return {
        method: req.method,
        query_string: url.parse(req.url).query,
        headers: req.headers,
        cookies: cookies,
        data: req.body || '<body unavailable>',
        url: full_url,
        env: process.env
    };
};
