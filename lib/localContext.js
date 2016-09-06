'use strict';

var createNamespace = require('continuation-local-storage').createNamespace;
var breadcrumbs = require('./breadcrumbs');

var ctxNamespace = createNamespace('ravenLocalContext');


var LocalContext = function LocalContext(client) {
  this.client = client;
  this.breadcrumbs = new breadcrumbs.BreadcrumbBuffer(
    client._globalContext.maxBreadcrumbs);

  // when we make the local context we copy over the global context.
  this.user = client._globalContext.user;
  this.extra = Object.assign({}, client._globalContext.extra || {});
  this.tags = Object.assign({}, client._globalContext.tags || {});
};

LocalContext.prototype.captureBreadcrumb = function captureBreadcrumb(crumb) {
  this.breadcrumbs.add(Object.assign({
    timestamp: +new Date() / 1000
  }, crumb));
};

var ContextManager = function ContextManager() {
};

ContextManager.prototype.getContext = function getContext(client) {
  return ctxNamespace.get('localContext') || null;
};

ContextManager.prototype.getOrCreateContext = function getOrCreateContext(client) {
  if (!ctxNamespace.active) {
    return null;
  }
  var rv = ctxNamespace.get('localContext');
  if (!rv) {
    rv = new LocalContext(client);
    ctxNamespace.set('localContext', rv);
  }
  return rv;
};

ContextManager.prototype.runWithContext = function(client, fn) {
  var rv;
  ctxNamespace.run(function() {
    // if we run this way we make sure we absolutely create a new
    // local context here because otherwise things like the
    // global `captureBreadcrumb` function would not be able to
    // find a client.
    ctxNamespace.set('localContext', new LocalContext(client));
    rv = fn();
  });
  return rv;
};

var contextManager = new ContextManager();

module.exports.LocalContext = LocalContext;
module.exports.contextManager = contextManager;
