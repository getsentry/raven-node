'use strict';

var events = require('events');
var util = require('util');
var timeoutReq = require('timed-out');

var http = require('http');
var https = require('https');
var Tls = require('tls');

function Transport() {}
util.inherits(Transport, events.EventEmitter);

function HTTPTransport(options) {
  this.defaultPort = 80;
  this.transport = http;
  this.options = options || {};
}
util.inherits(HTTPTransport, Transport);
HTTPTransport.prototype.send = function(client, message, headers, eventId, cb) {

  var options = {
    hostname: client.dsn.host,
    path: client.dsn.path + 'api/' + client.dsn.project_id + '/store/',
    headers: headers,
    method: 'POST',
    port: client.dsn.port || this.defaultPort,
    ca: client.ca
  };

  // set path apprpriately when using proxy
  if (this.options.hasOwnProperty('host')) {
      if (client.dsn.protocol === 'http') {
        options.path = 'http://' + client.dsn.host + ':' + client.dsn.port + client.dsn.path + 'api/' + client.dsn.project_id + '/store/'
      } else {
        options.path = client.dsn.host + ':' + client.dsn.port;
      }
      delete options.hostname; // only 'host' should be set when using proxy
  }

  for (var key in this.options) {
    if (this.options.hasOwnProperty(key)) {
      options[key] = this.options[key];
    }
  }

  var req = this.transport.request(options, function(res) {
    res.setEncoding('utf8');
    if (res.statusCode >= 200 && res.statusCode < 300) {
      client.emit('logged', eventId);
      cb && cb(null, eventId);
    } else {
      var reason = res.headers['x-sentry-error'];
      var e = new Error('HTTP Error (' + res.statusCode + '): ' + reason);
      e.response = res;
      e.statusCode = res.statusCode;
      e.reason = reason;
      e.sendMessage = message;
      e.requestHeaders = headers;
      e.eventId = eventId;
      client.emit('error', e);
      cb && cb(e);
    }
    // force the socket to drain
    var noop = function() {};
    res.on('data', noop);
    res.on('end', noop);
  });

  timeoutReq(req, client.sendTimeout * 1000);

  var cbFired = false;
  req.on('error', function(e) {
    client.emit('error', e);
    if (!cbFired) {
      cb && cb(e);
      cbFired = true;
    }
  });

  // TLS connection for proxying to HTTPS endpoint
  /* req.on('connect', function (res, socket, head) {
      var cts = Tls.connect({
      host: client.dsn.host,
      socket: socket
      }, function () {
          cts.write('GET /welcome HTTP/1.1rnHost: sentry.iornrn');
      });

      cts.on('data', function (data) {
          // console.log(data.toString());
      });
  });
  req.end(); */
  
  req.end(message);
};

function HTTPSTransport(options) {
  this.defaultPort = 443;
  this.transport = https;
  this.options = options || {};
}

function HTTPProxyTransport(options) {
    // this.defaultPort = 80;
    this.transport = http;
    this.options = options || {};

    // set host and port for proxy
    this.options.host = options.proxyHost;
    this.options.port = options.proxyPort;
}

function HTTPSProxyTransport(options) {
    // Not working yet ):
    this.defaultPort = 443;
    this.transport = http;
    this.options = options || {};
    
    this.options.host = options.proxyHost;
    this.options.port = options.proxyPort;
    this.options.method = 'CONNECT';
}

util.inherits(HTTPSTransport, HTTPTransport);
util.inherits(HTTPProxyTransport, HTTPTransport);
util.inherits(HTTPSProxyTransport, HTTPTransport);

module.exports.http = new HTTPTransport();
module.exports.https = new HTTPSTransport();
module.exports.Transport = Transport;
module.exports.HTTPTransport = HTTPTransport;
module.exports.HTTPSTransport = HTTPSTransport;

module.exports.HTTPProxyTransport = HTTPProxyTransport;
module.exports.HTTPSProxyTransport = HTTPSProxyTransport;
