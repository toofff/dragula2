const { documentElement } = document;

class Dragula extends EventTarget {
  constructor(initialContainers, options) {
    super();

    const len = arguments.length;
    if (len === 1 && Array.isArray(initialContainers) === false) {
      [options, initialContainers] = [initialContainers, []];
    }

    const o = this.options = { ...Dragula.defaultOptions, ...options };
    this.containers = o.containers = o.containers || initialContainers || [];

    if (typeof o.copy !== 'function') {
      const { copy } = o;
      o.copy = () => copy;
    }

    this.dragging = false;

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
    const drake = this;

    if (drake.options.removeOnSpill === true) {
      drake.on('over', spillOver).on('out', spillOut);
    }

    events();

    Object.assign(this, {
      start: manualStart,
      end,
      cancel,
      remove,
      destroy,
      canMove,
    });

    function isContainer(el) {
      return drake.containers.includes(el) || drake.options.isContainer(el);
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
      if ((e.clientX !== undefined && Math.abs(e.clientX - _moveX) <= (drake.options.slideFactorX || 0))
        && (e.clientY !== undefined && Math.abs(e.clientY - _moveY) <= (drake.options.slideFactorY || 0))) {
        return;
      }

      if (drake.options.ignoreInputTextSelection) {
        const clientX = e.clientX || 0;
        const clientY = e.clientY || 0;
        const elementBehindCursor = document.elementFromPoint(clientX, clientY);

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
      _offsetX = e.pageX - offset.left;
      _offsetY = e.pageY - offset.top;

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
        if (drake.options.invalid(item, handle)) {
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
      if (drake.options.invalid(item, handle)) {
        return;
      }

      const movable = drake.options.moves(item, source, handle, item.nextElementSibling);
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
      if (drake.options.copy(context.item, context.source)) {
        _copy = context.item.cloneNode(true);
        drake.emit('cloned', {
          clone: _copy,
          original: context.item,
          type: 'copy',
        });
      }

      _source = context.source;
      _item = context.item;
      _initialSibling = _currentSibling = context.item.nextElementSibling;

      drake.dragging = true;
      drake.emit('drag', _item, _source);
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
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
      const elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
      const dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);

      if (dropTarget && ((_copy && drake.options.copySortSource) || (!_copy || dropTarget !== _source))) {
        drop(item, dropTarget);
      } else if (drake.options.removeOnSpill) {
        remove();
      } else {
        cancel();
      }
    }

    function drop(item, target) {
      if (_copy && drake.options.copySortSource && target === _source) {
        _item.remove();
      }
      if (isInitialPlacement(target)) {
        drake.emit('cancel', {
          element: item,
          container: _source,
          source: _source,
        });
      } else {
        drake.emit('drop', {
          element: item,
          target,
          source: _source,
          sibling: _currentSibling,
        });
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
        item.remove();
      }
      drake.emit(_copy ? 'cancel' : 'remove', {
        element: item,
        container: parent,
        source: _source,
      });

      cleanup();
    }

    function cancel(revert) {
      if (!drake.dragging) {
        return;
      }
      const reverts = arguments.length > 0 ? revert : drake.options.revertOnSpill;
      const item = _copy || _item;
      const parent = getParent(item);
      const initial = isInitialPlacement(parent);
      if (initial === false && reverts) {
        if (_copy) {
          if (parent) {
            _copy.remove();
          }
        } else {
          _source.insertBefore(item, _initialSibling);
        }
      }
      if (initial || reverts) {
        drake.emit('cancel', {
          element: item,
          container: _source,
          source: _source,
        });
      } else {
        drake.emit('drop', {
          element: item,
          target: parent,
          source: _source,
          sibling: _currentSibling,
        });
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
        drake.emit('out', {
          element: item,
          container: _lastDropTarget,
          source: _source,
        });
      }
      drake.emit('dragend', { element: item });
      _source = _item = _copy = _initialSibling = _currentSibling = _renderTimer = _lastDropTarget = null;
    }

    function isInitialPlacement(target, s) {
      let sibling;
      if (s !== undefined) {
        sibling = s;
      } else if (_mirror) {
        sibling = _currentSibling;
      } else {
        sibling = (_copy || _item).nextElementSibling;
      }
      return target === _source && sibling === _initialSibling;
    }

    function findDropTarget(elementBehindCursor, clientX, clientY) {
      let target = elementBehindCursor;

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

        return drake.options.accepts(_item, target, _source, reference);
      }

      while (target && !accepted()) {
        target = getParent(target);
      }

      return target;
    }

    function drag(e) {
      if (!_mirror) {
        return;
      }
      e.preventDefault();

      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
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
      if (dropTarget === _source && _copy && !drake.options.copySortSource) {
        if (parent) {
          item.remove();
        }

        return;
      }

      let reference;
      const immediate = getImmediateChild(dropTarget, elementBehindCursor);
      if (immediate !== null) {
        reference = getReference(dropTarget, immediate, clientX, clientY);
      } else if (drake.options.revertOnSpill === true && !_copy) {
        reference = _initialSibling;
        dropTarget = _source;
      } else {
        if (_copy && parent) {
          item.remove();
        }

        return;
      }

      if (
        (reference === null && changed)
        || reference !== item
        && reference !== item.nextElementSibling
      ) {
        _currentSibling = reference;
        dropTarget.insertBefore(item, reference);
        drake.emit('shadow', {
          element: item,
          container: dropTarget,
          source: _source,
        });
      }

      function moved(type) {
        drake.emit(type, {
          element: item,
          container: _lastDropTarget,
          source: _source,
        });
      }
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
      _mirror.style.width = `${rect.width}px`;
      _mirror.style.height = `${rect.height}px`;
      _mirror.classList.remove('gu-transit');
      _mirror.classList.add('gu-mirror');
      drake.options.mirrorContainer.appendChild(_mirror);
      documentElement.addEventListener('pointermove', drag);
      drake.options.mirrorContainer.classList.add('gu-unselectable');
      drake.emit('cloned', {
        clone: _mirror,
        original: _item,
        type: 'mirror',
      });
    }

    function removeMirrorImage() {
      if (_mirror) {
        drake.options.mirrorContainer.classList.remove('gu-unselectable');
        documentElement.removeEventListener('pointermove', drag);
        _mirror.remove();
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
      const horizontal = drake.options.direction === 'horizontal';

      function resolve(after) {
        return after ? target.nextElementSibling : target;
      }

      function inside() { // faster, but only available if dropped inside a child element
        const rect = target.getBoundingClientRect();
        if (horizontal) {
          return resolve(x > rect.left + rect.width / 2);
        }

        return resolve(y > rect.top + rect.height / 2);
      }

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

      return target !== dropTarget ? inside() : outside();
    }
  } // End constructor

  on(eventType, callback) {
    this.addEventListener(eventType, (evt) => {
      callback.call(this, ...Object.values(evt.detail));
    });

    return this;
  }

  off(eventType, callback) {
    this.removeEventListener(eventType, callback);

    return this;
  }

  emit(eventType, detail, ...args) {
    if (detail instanceof Node) {
      // Old syntax with positional arguments
      detail = [detail, ...args];
    }
    const evt = new CustomEvent(eventType, { detail });
    this.dispatchEvent(evt);
    return this;
  }

  static defaultOptions = {
    moves: () => true,
    accepts: () => true,
    invalid: () => false,
    isContainer: () => false,
    copy: false,
    copySortSource: false,
    revertOnSpill: false,
    removeOnSpill: false,
    direction: 'vertical',
    ignoreInputTextSelection: true,
    mirrorContainer: document.body,
  };
}

function dragula(...args) {
  return new Dragula(...args);
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

function getOffset(el) {
  const rect = el.getBoundingClientRect();
  return {
    left: rect.left + window.scrollX,
    top: rect.top + window.scrollY,
  };
}

function getElementBehindPoint(point, x, y) {
  point = point || {};
  const state = point.className || '';
  point.className += ' gu-hide';
  const el = document.elementFromPoint(x, y);
  point.className = state;

  return el;
}

function getParent(el) {
  return el.parentNode === document ? null : el.parentNode;
}

function isEditable(el) {
  if (!el) { return false; } // no parents were editable
  if (el.contentEditable === 'false') { return false; } // stop the lookup
  if (el.contentEditable === 'true') { return true; } // found a contentEditable element in the chain

  return isEditable(getParent(el)); // contentEditable is set to 'inherit'
}

function isInput(el) {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || isEditable(el);
}

module.exports = dragula;
