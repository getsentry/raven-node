// builtin
var dgram = require('dgram');

var k_default_port = 12345;

module.exports.send = function(client, auth, message, cb) {

    var dsn = client.dsn;

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

