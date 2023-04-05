/* eslint-disable */
const raise = (el, type, options) => {
  const o = options || {};
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.keys(o).forEach(apply);
  el.dispatchEvent(e);
  function apply(key) {
    e[key] = o[key];
  }
};

module.exports = {
  raise,
};
