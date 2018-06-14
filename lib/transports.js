'use strict';

var events = require('events');
var util = require('util');
var timeoutReq = require('timed-out');

var http = require('http');
var https = require('https');
var tunnel = require('tunnel-agent');
var agentOptions = {
  keepAlive: true,
  maxSockets: 100
};
var httpAgent = new http.Agent(agentOptions);
var httpsAgent = new https.Agent(agentOptions);

function Transport() {}
util.inherits(Transport, events.EventEmitter);

function HTTPTransport(options) {
  this.defaultPort = 80;
  this.transport = http;
  this.options = options || {};
  this.agent = httpAgent;
}
util.inherits(HTTPTransport, Transport);
HTTPTransport.prototype.send = function(client, message, headers, eventId, cb) {
  var options = {
    hostname: client.dsn.host,
    path: client.dsn.path + 'api/' + client.dsn.project_id + '/store/',
    headers: headers,
    method: 'POST',
    port: client.dsn.port || this.defaultPort,
    ca: client.ca,
    agent: this.agent
  };

  // set path apprpriately when using http endpoint + proxy, set proxy headers appropriately when using https endpoint + proxy
  if (this.options.hasOwnProperty('proxyHost')) {
    if (client.dsn.protocol === 'http') {
      this.options.path =
        'http://' +
        client.dsn.host +
        ':' +
        client.dsn.port +
        client.dsn.path +
        'api/' +
        client.dsn.project_id +
        '/store/';
      delete options.hostname; // only 'host' should be set when using proxy

      if (this.options.proxyAuth) {
        // might be able to use httpOverHttp agent
        this.options.headers['Proxy-Authorization'] =
          'Basic ' + Buffer.from(this.options.proxyAuth).toString('base64');
      }
    } else {
      this.options.agent.proxyOptions.headers = {
        'Content-Type': 'application/octet-stream',
        host: client.dsn.host + ':' + client.dsn.port
      };
    }
  }

  for (var key in this.options) {
    if (this.options.hasOwnProperty(key)) {
      options[key] = this.options[key];
    }
  }

  // prevent off heap memory explosion
  var _name = this.agent.getName({
    host: client.dsn.host,
    port: client.dsn.port
  });
  var _requests = this.agent.requests[_name];
  if (_requests && Object.keys(_requests).length > client.maxReqQueueCount) {
    // other feedback strategy
    client.emit('error', new Error('client req queue is full..'));
    return;
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
  req.end(message);
};

function HTTPSTransport(options) {
  this.defaultPort = 443;
  this.transport = https;
  this.options = options || {};
  this.agent = httpsAgent;
}

function HTTPProxyTransport(options) {
  this.defaultPort = 80;
  this.transport = http;
  this.options = options || {};
  this.agent = httpAgent;
  this.options.host = options.proxyHost;
  this.options.port = options.proxyPort;

  if (options.proxyUser && options.proxyPassword) {
    this.options.proxyAuth = options.proxyUser + ':' + options.proxyPassword;
  }
}

function HTTPSProxyTransport(options) {
  this.transport = https;
  this.options = options || {};
  this.agent = httpsAgent;
  this.options.agent = tunnel.httpsOverHttp({
    proxy: {
      host: options.proxyHost,
      port: options.proxyPort,
      proxyAuth:
        options.proxyUser && options.proxyPassword
          ? options.proxyUser + ':' + options.proxyPassword
          : null
    },
    keepAlive: agentOptions.keepAlive,
    maxSockets: agentOptions.maxSockets
  });
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
