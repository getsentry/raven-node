// builtin
var dgram = require('dgram');

var utils = require('../utils');

var k_default_port = 12345;

module.exports.send = function(client, message, cb) {

    var dsn = client.dsn;

    var timestamp = new Date().getTime();
    var signature = utils.getSignature(dsn.private_key, message, timestamp);
    var auth = utils.getAuthHeader(signature, timestamp, dsn.public_key, dsn.project_id);

    var host = dsn.host;
    var port = dsn.port || k_default_port;

    var buff = new Buffer(auth + '\n\n' + message);

    var udp = dgram.createSocket('udp4');
    udp.send(buff, 0, buff.length, port, host, function(err, bytes) {
        if (err) {
            return cb(err);
        }

        udp.close();
        return cb();
    });
}

