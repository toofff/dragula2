'use strict';

function raise (el, type, options) {
  var o = options || {};
  var e = new Event(type, {bubbles: true, cancelable: true});
  Object.keys(o).forEach(apply);
  el.dispatchEvent(e);
  function apply (key) {
    e[key] = o[key];
  }
}

module.exports = {
  raise: raise
};
