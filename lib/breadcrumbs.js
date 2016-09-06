'use strict';

var BreadcrumbBuffer = function BreadcrumbBuffer(maxBreadcrumbs) {
  this._buffer = [];
  this._maxBreadcrums = maxBreadcrumbs;
};

BreadcrumbBuffer.prototype.add = function add(crumb) {
  this._buffer.push(crumb);
  if (this._buffer.length > this._globalOptions.maxBreadcrumbs) {
    this._buffer.shift();
  }
}

BreadcrumbBuffer.prototype.fetch = function fetch() {
  var rv = this._buffer;
  this._buffer = [];
  return rv;
}

module.exports.BreadcrumbBuffer = BreadcrumbBuffer;
