'use strict';

var Raven = require('../client');

// Legacy support
var connectMiddleware = function (client) {
  return connectMiddleware.errorHandler(client);
};

var returnOrCreateClient = function (clientOrDSN) {
  // Use an existing client if an instance of a client, or configure a new one.
  // Note: the module returns a default instance of a Raven client.
  // `Raven.constructor` accesses its constructor in order to perform an
  // `instanceof` check on the `client` argument
  return clientOrDSN instanceof Raven.constructor ? clientOrDSN : Raven.config(clientOrDSN);
};

// Error handler. This should be the last item listed in middleware, but
// before any other error handlers.
connectMiddleware.errorHandler = function (clientOrDSN) {
  var client = returnOrCreateClient(clientOrDSN);
  return client.errorHandler();
};

// Ensures asynchronous exceptions are routed to the errorHandler. This
// should be the **first** item listed in middleware.
connectMiddleware.requestHandler = function (clientOrDSN) {
  var client = returnOrCreateClient(clientOrDSN);
  return client.requestHandler();
};

module.exports = connectMiddleware;
