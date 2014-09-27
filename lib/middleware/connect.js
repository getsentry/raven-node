var raven = require('../client');
var parsers = require('../parsers');

module.exports = function connectMiddleware(client, parseRequest) {
    client = (client instanceof raven.Client) ? client : new raven.Client(client);
    return function(err, req, res, next) {
        var status = err.status || err.statusCode || err.status_code || 500;

        // skip anything not marked as an internal server error
        if (status < 500) return next(err);

        var kwargs = parsers.parseRequest(req);
        if (parseRequest)
            kwargs = parseRequest(req, kwargs);
        client.captureError(err, kwargs, function(result) {
            res.sentry = client.getIdent(result);
            next(err, req, res);
        });
    };
};
