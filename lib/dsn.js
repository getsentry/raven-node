// builtin
var url = require('url');

// local
var transports = require('./transports');

// protocol -> port map
var protocolMap = {
    'http': 80,
    'https': 443
};

// http://sentry.readthedocs.org/en/latest/developer/client/index.html#parsing-the-dsn
module.exports.parse = function (dsn) {
    if(!dsn) {
        // Let a falsey value return false explicitly
        return false;
    }

    try {
        var parsed = url.parse(dsn);
        var response = {
              protocol: parsed.protocol.slice(0, -1),
              public_key: parsed.auth.split(':')[0],
              private_key: parsed.auth.split(':')[1],
              host: parsed.host.split(':')[0]
          };

        if(~response.protocol.indexOf('+')) {
            response.protocol = response.protocol.split('+')[1];
        }

        if(!transports.hasOwnProperty(response.protocol)) {
            throw new Error('Invalid transport');
        }

        var path = parsed.path.substr(1);
        var index = path.lastIndexOf('/');
        response.path = path.substr(0, index);
        response.project_id = ~~path.substr(index+1);
        response.port = ~~parsed.port || protocolMap[response.protocol] || 443;

        return response;
    } catch(e) {
        console.error(e);
        throw new Error('Invalid Sentry DSN: ' + dsn);
    }
};

