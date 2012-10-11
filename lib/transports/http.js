var http = require('http');
var https = require('https');

var utils = require('../utils');

// default port for protocols
var k_default_port = {
    http: 80,
    https: 443,
};

module.exports.send = function(client, message, cb) {
    var self = this;

    var dsn = client.dsn;

    var timestamp = new Date().getTime();
    var signature = utils.getSignature(dsn.private_key, message, timestamp);
    var auth = utils.getAuthHeader(signature, timestamp, dsn.public_key, dsn.project_id);

    var proto = (client.dsn.protocol === 'http') ? http : https;
    var host = client.dsn.host;
    var port = client.dsn.port || k_default_port[client.dsn.protocol];

    var options = {
        host: host,
        path: client.dsn.path + '/api/store/',
        headers: {
            'X-Sentry-Auth': auth,
            'Content-Type': 'application/octet-stream',
            'Content-Length': message.length
        },
        method: 'POST',
        port: port
    };

    var req = proto.request(options, function(res){
        // NOTE: we need the data so we don't capture

        res.on('end', function(){
            if (res.statusCode != 200) {
                return cb(new Error('http response not OK: ' + res.statusCode));
            }

            return cb();
        });

        res.on('error', function(err) {
            cb(err);
        });
    });

    req.on('error', function(err){
        cb(err);
    });

    req.end(message);
}

