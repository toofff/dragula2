const emitter = require('contra/emitter');

const doc = document;
const { documentElement } = doc;

function dragula(initialContainers, options) {
  const len = arguments.length;
  if (len === 1 && Array.isArray(initialContainers) === false) {
    options = initialContainers;
    initialContainers = [];
  }
  let _mirror; // mirror image
  let _source; // source container
  let _item; // item being dragged
  let _offsetX; // reference x
  let _offsetY; // reference y
  let _moveX; // reference move x
  let _moveY; // reference move y
  let _initialSibling; // reference sibling when grabbed
  let _currentSibling; // reference sibling now
  let _copy; // item used for copying
  let _renderTimer; // timer for setTimeout renderMirrorImage
  let _lastDropTarget = null; // last container item was over
  let _grabbed; // holds pointerdown context until first pointermove

  const o = options || {};
  if (o.moves === undefined) { o.moves = always; }
  if (o.accepts === undefined) { o.accepts = always; }
  if (o.invalid === undefined) { o.invalid = invalidTarget; }
  if (o.containers === undefined) { o.containers = initialContainers || []; }
  if (o.isContainer === undefined) { o.isContainer = never; }
  if (o.copy === undefined) { o.copy = false; }
  if (o.copySortSource === undefined) { o.copySortSource = false; }
  if (o.revertOnSpill === undefined) { o.revertOnSpill = false; }
  if (o.removeOnSpill === undefined) { o.removeOnSpill = false; }
  if (o.direction === undefined) { o.direction = 'vertical'; }
  if (o.ignoreInputTextSelection === undefined) { o.ignoreInputTextSelection = true; }
  if (o.mirrorContainer === undefined) { o.mirrorContainer = doc.body; }

  const drake = emitter({
    containers: o.containers,
    start: manualStart,
    end,
    cancel,
    remove,
    destroy,
    canMove,
    dragging: false,
  });

  if (o.removeOnSpill === true) {
    drake.on('over', spillOver).on('out', spillOut);
  }

  events();

  return drake;

  function isContainer(el) {
    return drake.containers.indexOf(el) !== -1 || o.isContainer(el);
  }

  function events(isRemove) {
    const op = isRemove ? 'remove' : 'add';
    documentElement[`${op}EventListener`]('pointerdown', grab);
    documentElement[`${op}EventListener`]('pointerup', release);
  }

  function eventualMovements(isRemove) {
    const op = isRemove ? 'remove' : 'add';
    documentElement[`${op}EventListener`]('pointermove', startBecauseMouseMoved);
  }

  function movements(isRemove) {
    const op = isRemove ? 'remove' : 'add';
    documentElement[`${op}EventListener`]('selectstart', preventGrabbed); // IE8
    documentElement[`${op}EventListener`]('click', preventGrabbed);
  }

  function destroy() {
    events(true);
    release({});
  }

  function preventGrabbed(e) {
    if (_grabbed) {
      e.preventDefault();
    }
  }

  function grab(e) {
    _moveX = e.clientX;
    _moveY = e.clientY;

    const ignore = whichMouseButton(e) !== 1 || e.metaKey || e.ctrlKey;
    if (ignore) {
      return; // we only care about honest-to-god left clicks and touch events
    }
    const item = e.target;
    const context = canStart(item);
    if (!context) {
      return;
    }
    _grabbed = context;
    eventualMovements();
    if (e.type === 'pointerdown') {
      if (isInput(item)) { // see also: https://github.com/bevacqua/dragula/issues/208
        item.focus(); // fixes https://github.com/bevacqua/dragula/issues/176
      } else {
        e.preventDefault(); // fixes https://github.com/bevacqua/dragula/issues/155
      }
    }
  }

  function startBecauseMouseMoved(e) {
    if (!_grabbed) {
      return;
    }
    if (whichMouseButton(e) === 0) {
      release({});
      // when text is selected on an input and then dragged, pointerup doesn't fire.
      // this is our only hope
      return;
    }

    // truthy check fixes #239, equality fixes #207, fixes #501
    if ((e.clientX !== undefined && Math.abs(e.clientX - _moveX) <= (o.slideFactorX || 0))
      && (e.clientY !== undefined && Math.abs(e.clientY - _moveY) <= (o.slideFactorY || 0))) {
      return;
    }

    if (o.ignoreInputTextSelection) {
      const clientX = getCoord('clientX', e) || 0;
      const clientY = getCoord('clientY', e) || 0;
      const elementBehindCursor = doc.elementFromPoint(clientX, clientY);
      if (isInput(elementBehindCursor)) {
        return;
      }
    }

    const grabbed = _grabbed; // call to end() unsets _grabbed
    eventualMovements(true);
    movements();
    end();
    start(grabbed);

    const offset = getOffset(_item);
    _offsetX = getCoord('pageX', e) - offset.left;
    _offsetY = getCoord('pageY', e) - offset.top;

    const inTransit = _copy || _item;
    if (inTransit) {
      inTransit.classList.add('gu-transit');
    }
    renderMirrorImage();
    drag(e);
  }

  function canStart(item) {
    if (drake.dragging && _mirror) {
      return;
    }
    if (isContainer(item)) {
      return; // don't drag container itself
    }
    const handle = item;
    while (getParent(item) && isContainer(getParent(item)) === false) {
      if (o.invalid(item, handle)) {
        return;
      }
      item = getParent(item); // drag target should be a top element
      if (!item) {
        return;
      }
    }
    const source = getParent(item);
    if (!source) {
      return;
    }
    if (o.invalid(item, handle)) {
      return;
    }

    const movable = o.moves(item, source, handle, nextEl(item));
    if (!movable) {
      return;
    }

    return {
      item,
      source,
    };
  }

  function canMove(item) {
    return !!canStart(item);
  }

  function manualStart(item) {
    const context = canStart(item);
    if (context) {
      start(context);
    }
  }

  function start(context) {
    if (isCopy(context.item, context.source)) {
      _copy = context.item.cloneNode(true);
      drake.emit('cloned', _copy, context.item, 'copy');
    }

    _source = context.source;
    _item = context.item;
    _initialSibling = _currentSibling = nextEl(context.item);

    drake.dragging = true;
    drake.emit('drag', _item, _source);
  }

  function invalidTarget() {
    return false;
  }

  function end() {
    if (!drake.dragging) {
      return;
    }
    const item = _copy || _item;
    drop(item, getParent(item));
  }

  function ungrab() {
    _grabbed = false;
    eventualMovements(true);
    movements(true);
  }

  function release(e) {
    ungrab();

    if (!drake.dragging) {
      return;
    }
    const item = _copy || _item;
    const clientX = getCoord('clientX', e) || 0;
    const clientY = getCoord('clientY', e) || 0;
    const elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
    const dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);
    if (dropTarget && ((_copy && o.copySortSource) || (!_copy || dropTarget !== _source))) {
      drop(item, dropTarget);
    } else if (o.removeOnSpill) {
      remove();
    } else {
      cancel();
    }
  }

  function drop(item, target) {
    const parent = getParent(item);
    if (_copy && o.copySortSource && target === _source) {
      parent.removeChild(_item);
    }
    if (isInitialPlacement(target)) {
      drake.emit('cancel', item, _source, _source);
    } else {
      drake.emit('drop', item, target, _source, _currentSibling);
    }
    cleanup();
  }

  function remove() {
    if (!drake.dragging) {
      return;
    }
    const item = _copy || _item;
    const parent = getParent(item);
    if (parent) {
      parent.removeChild(item);
    }
    drake.emit(_copy ? 'cancel' : 'remove', item, parent, _source);
    cleanup();
  }

  function cancel(revert) {
    if (!drake.dragging) {
      return;
    }
    const reverts = arguments.length > 0 ? revert : o.revertOnSpill;
    const item = _copy || _item;
    const parent = getParent(item);
    const initial = isInitialPlacement(parent);
    if (initial === false && reverts) {
      if (_copy) {
        if (parent) {
          parent.removeChild(_copy);
        }
      } else {
        _source.insertBefore(item, _initialSibling);
      }
    }
    if (initial || reverts) {
      drake.emit('cancel', item, _source, _source);
    } else {
      drake.emit('drop', item, parent, _source, _currentSibling);
    }
    cleanup();
  }

  function cleanup() {
    const item = _copy || _item;
    ungrab();
    removeMirrorImage();
    if (item) {
      item.classList.remove('gu-transit');
    }
    if (_renderTimer) {
      clearTimeout(_renderTimer);
    }
    drake.dragging = false;
    if (_lastDropTarget) {
      drake.emit('out', item, _lastDropTarget, _source);
    }
    drake.emit('dragend', item);
    _source = _item = _copy = _initialSibling = _currentSibling = _renderTimer = _lastDropTarget = null;
  }

  function isInitialPlacement(target, s) {
    let sibling;
    if (s !== undefined) {
      sibling = s;
    } else if (_mirror) {
      sibling = _currentSibling;
    } else {
      sibling = nextEl(_copy || _item);
    }
    return target === _source && sibling === _initialSibling;
  }

  function findDropTarget(elementBehindCursor, clientX, clientY) {
    let target = elementBehindCursor;
    while (target && !accepted()) {
      target = getParent(target);
    }
    return target;

    function accepted() {
      const droppable = isContainer(target);
      if (droppable === false) {
        return false;
      }

      const immediate = getImmediateChild(target, elementBehindCursor);
      const reference = getReference(target, immediate, clientX, clientY);
      const initial = isInitialPlacement(target, reference);
      if (initial) {
        return true; // should always be able to drop it right back where it was
      }
      return o.accepts(_item, target, _source, reference);
    }
  }

  function drag(e) {
    if (!_mirror) {
      return;
    }
    e.preventDefault();

    const clientX = getCoord('clientX', e) || 0;
    const clientY = getCoord('clientY', e) || 0;
    const x = clientX - _offsetX;
    const y = clientY - _offsetY;

    _mirror.style.left = `${x}px`;
    _mirror.style.top = `${y}px`;

    const item = _copy || _item;
    const elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
    let dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);
    const changed = dropTarget !== null && dropTarget !== _lastDropTarget;
    if (changed || dropTarget === null) {
      out();
      _lastDropTarget = dropTarget;
      over();
    }
    const parent = getParent(item);
    if (dropTarget === _source && _copy && !o.copySortSource) {
      if (parent) {
        parent.removeChild(item);
      }
      return;
    }
    let reference;
    const immediate = getImmediateChild(dropTarget, elementBehindCursor);
    if (immediate !== null) {
      reference = getReference(dropTarget, immediate, clientX, clientY);
    } else if (o.revertOnSpill === true && !_copy) {
      reference = _initialSibling;
      dropTarget = _source;
    } else {
      if (_copy && parent) {
        parent.removeChild(item);
      }
      return;
    }
    if (
      (reference === null && changed)
      || reference !== item
      && reference !== nextEl(item)
    ) {
      _currentSibling = reference;
      dropTarget.insertBefore(item, reference);
      drake.emit('shadow', item, dropTarget, _source);
    }
    function moved(type) { drake.emit(type, item, _lastDropTarget, _source); }
    function over() { if (changed) { moved('over'); } }
    function out() { if (_lastDropTarget) { moved('out'); } }
  }

  function spillOver(el) {
    if (el) {
      el.classList.remove('gu-hide');
    }
  }

  function spillOut(el) {
    if (el && drake.dragging) {
      el.classList.add('gu-hide');
    }
  }

  function renderMirrorImage() {
    if (_mirror) {
      return;
    }
    const rect = _item.getBoundingClientRect();
    _mirror = _item.cloneNode(true);
    _mirror.style.width = `${getRectWidth(rect)}px`;
    _mirror.style.height = `${getRectHeight(rect)}px`;
    _mirror.classList.remove('gu-transit');
    _mirror.classList.add('gu-mirror');
    o.mirrorContainer.appendChild(_mirror);
    documentElement.addEventListener('pointermove', drag);
    o.mirrorContainer.classList.add('gu-unselectable');
    drake.emit('cloned', _mirror, _item, 'mirror');
  }

  function removeMirrorImage() {
    if (_mirror) {
      o.mirrorContainer.classList.remove('gu-unselectable');
      documentElement.removeEventListener('pointermove', drag);
      getParent(_mirror).removeChild(_mirror);
      _mirror = null;
    }
  }

  function getImmediateChild(dropTarget, target) {
    let immediate = target;
    while (immediate !== dropTarget && getParent(immediate) !== dropTarget) {
      immediate = getParent(immediate);
    }
    if (immediate === documentElement) {
      return null;
    }
    return immediate;
  }

  function getReference(dropTarget, target, x, y) {
    const horizontal = o.direction === 'horizontal';
    const reference = target !== dropTarget ? inside() : outside();
    return reference;

    function outside() { // slower, but able to figure out any position
      const countChildren = dropTarget.children.length;
      let i;
      let el;
      let rect;
      for (i = 0; i < countChildren; i++) {
        el = dropTarget.children[i];
        rect = el.getBoundingClientRect();
        if (horizontal && (rect.left + rect.width / 2) > x) { return el; }
        if (!horizontal && (rect.top + rect.height / 2) > y) { return el; }
      }
      return null;
    }

    function inside() { // faster, but only available if dropped inside a child element
      const rect = target.getBoundingClientRect();
      if (horizontal) {
        return resolve(x > rect.left + getRectWidth(rect) / 2);
      }
      return resolve(y > rect.top + getRectHeight(rect) / 2);
    }

    function resolve(after) {
      return after ? nextEl(target) : target;
    }
  }

  function isCopy(item, container) {
    return typeof o.copy === 'boolean' ? o.copy : o.copy(item, container);
  }
}

function whichMouseButton(e) {
  if (e.touches !== undefined) { return e.touches.length; }
  if (e.which !== undefined && e.which !== 0) { return e.which; } // see https://github.com/bevacqua/dragula/issues/261
  if (e.buttons !== undefined) { return e.buttons; }
  const { button } = e;
  if (button !== undefined) { // see https://github.com/jquery/jquery/blob/99e8ff1baa7ae341e94bb89c3e84570c7c3ad9ea/src/event.js#L573-L575
    return button & 1 ? 1 : button & 2 ? 3 : (button & 4 ? 2 : 0);
  }
}

function getScroll(scrollProp, offsetProp) {
  if (typeof global[offsetProp] !== 'undefined') {
    return global[offsetProp];
  }
  if (documentElement.clientHeight) {
    return documentElement[scrollProp];
  }
  return doc.body[scrollProp];
}

function getOffset(el) {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left + getScroll('scrollLeft', 'pageXOffset'),
    top: rect.top + getScroll('scrollTop', 'pageYOffset'),
  };
}

function getElementBehindPoint(point, x, y) {
  point = point || {};
  const state = point.className || '';
  point.className += ' gu-hide';
  const el = doc.elementFromPoint(x, y);
  point.className = state;

  return el;
}

function never() { return false; }
function always() { return true; }
function getRectWidth(rect) { return rect.width || (rect.right - rect.left); }
function getRectHeight(rect) { return rect.height || (rect.bottom - rect.top); }
function getParent(el) { return el.parentNode === doc ? null : el.parentNode; }
function isInput(el) { return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || isEditable(el); }
function isEditable(el) {
  if (!el) { return false; } // no parents were editable
  if (el.contentEditable === 'false') { return false; } // stop the lookup
  if (el.contentEditable === 'true') { return true; } // found a contentEditable element in the chain
  return isEditable(getParent(el)); // contentEditable is set to 'inherit'
}

function nextEl(el) {
  function manually() {
    let sibling = el;
    do {
      sibling = sibling.nextSibling;
    } while (sibling && sibling.nodeType !== 1);
    return sibling;
  }

  return el.nextElementSibling || manually();
}

function getEventHost(e) {
  // on touchend event, we have to use `e.changedTouches`
  // see http://stackoverflow.com/questions/7192563/touchend-event-properties
  // see https://github.com/bevacqua/dragula/issues/34
  if (e.targetTouches && e.targetTouches.length) {
    return e.targetTouches[0];
  }
  if (e.changedTouches && e.changedTouches.length) {
    return e.changedTouches[0];
  }
  return e;
}

function getCoord(coord, e) {
  const host = getEventHost(e);
  const missMap = {
    pageX: 'clientX', // IE8
    pageY: 'clientY', // IE8
  };
  if (coord in missMap && !(coord in host) && missMap[coord] in host) {
    coord = missMap[coord];
  }
  return host[coord];
}

module.exports = dragula;
