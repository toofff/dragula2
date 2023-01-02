(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.dragula = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const { documentElement } = document;

class Dragula extends EventTarget {
  constructor(initialContainers, options) {
    super();

    const len = arguments.length;
    if (len === 1 && Array.isArray(initialContainers) === false) {
      [options, initialContainers] = [initialContainers, []];
    }

    const o = (this.options = { ...Dragula.defaultOptions, ...options });
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
        if (isInput(item)) {
          // see also: https://github.com/bevacqua/dragula/issues/208
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
      if (
        e.clientX !== undefined
        && Math.abs(e.clientX - _moveX) <= (drake.options.slideFactorX || 0)
        && e.clientY !== undefined
        && Math.abs(e.clientY - _moveY) <= (drake.options.slideFactorY || 0)
      ) {
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

      if (dropTarget && ((_copy && drake.options.copySortSource) || !_copy || dropTarget !== _source)) {
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
        const reference = getReference(target, immediate, clientX, clientY, drake.options.direction);
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
        reference = getReference(dropTarget, immediate, clientX, clientY, drake.options.direction);
      } else if (drake.options.revertOnSpill === true && !_copy) {
        reference = _initialSibling;
        dropTarget = _source;
      } else {
        if (_copy && parent) {
          item.remove();
        }

        return;
      }

      if ((reference === null && changed) || (reference !== item && reference !== item.nextElementSibling)) {
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
      function over() {
        if (changed) {
          moved('over');
        }
      }
      function out() {
        if (_lastDropTarget) {
          moved('out');
        }
      }
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
  if (e.touches !== undefined) {
    return e.touches.length;
  }
  if (e.which !== undefined && e.which !== 0) {
    return e.which;
  } // see https://github.com/bevacqua/dragula/issues/261
  if (e.buttons !== undefined) {
    return e.buttons;
  }

  const { button } = e;
  if (button !== undefined) {
    // see https://github.com/jquery/jquery/blob/99e8ff1baa7ae341e94bb89c3e84570c7c3ad9ea/src/event.js#L573-L575
    return button & 1 ? 1 : button & 2 ? 3 : button & 4 ? 2 : 0;
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
  if (!el) {
    return false;
  } // no parents were editable
  if (el.contentEditable === 'false') {
    return false;
  } // stop the lookup
  if (el.contentEditable === 'true') {
    return true;
  } // found a contentEditable element in the chain

  return isEditable(getParent(el)); // contentEditable is set to 'inherit'
}

function isInput(el) {
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || isEditable(el);
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

function getReference(dropTarget, target, x, y, direction) {
  const horizontal = direction === 'horizontal';

  function resolve(after) {
    return after ? target.nextElementSibling : target;
  }

  function inside() {
    // faster, but only available if dropped inside a child element
    const rect = target.getBoundingClientRect();
    if (horizontal) {
      return resolve(x > rect.left + rect.width / 2);
    }

    return resolve(y > rect.top + rect.height / 2);
  }

  function outside() {
    // slower, but able to figure out any position
    const countChildren = dropTarget.children.length;
    let i;
    let el;
    let rect;
    for (i = 0; i < countChildren; i++) {
      el = dropTarget.children[i];
      rect = el.getBoundingClientRect();
      if (horizontal && rect.left + rect.width / 2 > x) {
        return el;
      }
      if (!horizontal && rect.top + rect.height / 2 > y) {
        return el;
      }
    }

    return null;
  }

  return target !== dropTarget ? inside() : outside();
}

module.exports = dragula;

},{}]},{},[1])(1)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy5sb2NhbC9zaGFyZS9wbnBtL3N0b3JlL3YzL3RtcC9kbHgtMjE3NDMvbm9kZV9tb2R1bGVzLy5wbnBtL2Jyb3dzZXItcGFja0A2LjEuMC9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwic3JjL2RyYWd1bGEuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiY29uc3QgeyBkb2N1bWVudEVsZW1lbnQgfSA9IGRvY3VtZW50O1xuXG5jbGFzcyBEcmFndWxhIGV4dGVuZHMgRXZlbnRUYXJnZXQge1xuICBjb25zdHJ1Y3Rvcihpbml0aWFsQ29udGFpbmVycywgb3B0aW9ucykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBjb25zdCBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGlmIChsZW4gPT09IDEgJiYgQXJyYXkuaXNBcnJheShpbml0aWFsQ29udGFpbmVycykgPT09IGZhbHNlKSB7XG4gICAgICBbb3B0aW9ucywgaW5pdGlhbENvbnRhaW5lcnNdID0gW2luaXRpYWxDb250YWluZXJzLCBbXV07XG4gICAgfVxuXG4gICAgY29uc3QgbyA9ICh0aGlzLm9wdGlvbnMgPSB7IC4uLkRyYWd1bGEuZGVmYXVsdE9wdGlvbnMsIC4uLm9wdGlvbnMgfSk7XG4gICAgdGhpcy5jb250YWluZXJzID0gby5jb250YWluZXJzID0gby5jb250YWluZXJzIHx8IGluaXRpYWxDb250YWluZXJzIHx8IFtdO1xuXG4gICAgaWYgKHR5cGVvZiBvLmNvcHkgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNvbnN0IHsgY29weSB9ID0gbztcbiAgICAgIG8uY29weSA9ICgpID0+IGNvcHk7XG4gICAgfVxuXG4gICAgdGhpcy5kcmFnZ2luZyA9IGZhbHNlO1xuXG4gICAgbGV0IF9taXJyb3I7IC8vIG1pcnJvciBpbWFnZVxuICAgIGxldCBfc291cmNlOyAvLyBzb3VyY2UgY29udGFpbmVyXG4gICAgbGV0IF9pdGVtOyAvLyBpdGVtIGJlaW5nIGRyYWdnZWRcbiAgICBsZXQgX29mZnNldFg7IC8vIHJlZmVyZW5jZSB4XG4gICAgbGV0IF9vZmZzZXRZOyAvLyByZWZlcmVuY2UgeVxuICAgIGxldCBfbW92ZVg7IC8vIHJlZmVyZW5jZSBtb3ZlIHhcbiAgICBsZXQgX21vdmVZOyAvLyByZWZlcmVuY2UgbW92ZSB5XG4gICAgbGV0IF9pbml0aWFsU2libGluZzsgLy8gcmVmZXJlbmNlIHNpYmxpbmcgd2hlbiBncmFiYmVkXG4gICAgbGV0IF9jdXJyZW50U2libGluZzsgLy8gcmVmZXJlbmNlIHNpYmxpbmcgbm93XG4gICAgbGV0IF9jb3B5OyAvLyBpdGVtIHVzZWQgZm9yIGNvcHlpbmdcbiAgICBsZXQgX3JlbmRlclRpbWVyOyAvLyB0aW1lciBmb3Igc2V0VGltZW91dCByZW5kZXJNaXJyb3JJbWFnZVxuICAgIGxldCBfbGFzdERyb3BUYXJnZXQgPSBudWxsOyAvLyBsYXN0IGNvbnRhaW5lciBpdGVtIHdhcyBvdmVyXG4gICAgbGV0IF9ncmFiYmVkOyAvLyBob2xkcyBwb2ludGVyZG93biBjb250ZXh0IHVudGlsIGZpcnN0IHBvaW50ZXJtb3ZlXG4gICAgY29uc3QgZHJha2UgPSB0aGlzO1xuXG4gICAgaWYgKGRyYWtlLm9wdGlvbnMucmVtb3ZlT25TcGlsbCA9PT0gdHJ1ZSkge1xuICAgICAgZHJha2Uub24oJ292ZXInLCBzcGlsbE92ZXIpLm9uKCdvdXQnLCBzcGlsbE91dCk7XG4gICAgfVxuXG4gICAgZXZlbnRzKCk7XG5cbiAgICBPYmplY3QuYXNzaWduKHRoaXMsIHtcbiAgICAgIHN0YXJ0OiBtYW51YWxTdGFydCxcbiAgICAgIGVuZCxcbiAgICAgIGNhbmNlbCxcbiAgICAgIHJlbW92ZSxcbiAgICAgIGRlc3Ryb3ksXG4gICAgICBjYW5Nb3ZlLFxuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gaXNDb250YWluZXIoZWwpIHtcbiAgICAgIHJldHVybiBkcmFrZS5jb250YWluZXJzLmluY2x1ZGVzKGVsKSB8fCBkcmFrZS5vcHRpb25zLmlzQ29udGFpbmVyKGVsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBldmVudHMoaXNSZW1vdmUpIHtcbiAgICAgIGNvbnN0IG9wID0gaXNSZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgICAgZG9jdW1lbnRFbGVtZW50W2Ake29wfUV2ZW50TGlzdGVuZXJgXSgncG9pbnRlcmRvd24nLCBncmFiKTtcbiAgICAgIGRvY3VtZW50RWxlbWVudFtgJHtvcH1FdmVudExpc3RlbmVyYF0oJ3BvaW50ZXJ1cCcsIHJlbGVhc2UpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV2ZW50dWFsTW92ZW1lbnRzKGlzUmVtb3ZlKSB7XG4gICAgICBjb25zdCBvcCA9IGlzUmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICAgIGRvY3VtZW50RWxlbWVudFtgJHtvcH1FdmVudExpc3RlbmVyYF0oJ3BvaW50ZXJtb3ZlJywgc3RhcnRCZWNhdXNlTW91c2VNb3ZlZCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbW92ZW1lbnRzKGlzUmVtb3ZlKSB7XG4gICAgICBjb25zdCBvcCA9IGlzUmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICAgIGRvY3VtZW50RWxlbWVudFtgJHtvcH1FdmVudExpc3RlbmVyYF0oJ3NlbGVjdHN0YXJ0JywgcHJldmVudEdyYWJiZWQpOyAvLyBJRThcbiAgICAgIGRvY3VtZW50RWxlbWVudFtgJHtvcH1FdmVudExpc3RlbmVyYF0oJ2NsaWNrJywgcHJldmVudEdyYWJiZWQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgICBldmVudHModHJ1ZSk7XG4gICAgICByZWxlYXNlKHt9KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcmV2ZW50R3JhYmJlZChlKSB7XG4gICAgICBpZiAoX2dyYWJiZWQpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdyYWIoZSkge1xuICAgICAgX21vdmVYID0gZS5jbGllbnRYO1xuICAgICAgX21vdmVZID0gZS5jbGllbnRZO1xuXG4gICAgICBjb25zdCBpZ25vcmUgPSB3aGljaE1vdXNlQnV0dG9uKGUpICE9PSAxIHx8IGUubWV0YUtleSB8fCBlLmN0cmxLZXk7XG4gICAgICBpZiAoaWdub3JlKSB7XG4gICAgICAgIHJldHVybjsgLy8gd2Ugb25seSBjYXJlIGFib3V0IGhvbmVzdC10by1nb2QgbGVmdCBjbGlja3MgYW5kIHRvdWNoIGV2ZW50c1xuICAgICAgfVxuICAgICAgY29uc3QgaXRlbSA9IGUudGFyZ2V0O1xuICAgICAgY29uc3QgY29udGV4dCA9IGNhblN0YXJ0KGl0ZW0pO1xuICAgICAgaWYgKCFjb250ZXh0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIF9ncmFiYmVkID0gY29udGV4dDtcbiAgICAgIGV2ZW50dWFsTW92ZW1lbnRzKCk7XG4gICAgICBpZiAoZS50eXBlID09PSAncG9pbnRlcmRvd24nKSB7XG4gICAgICAgIGlmIChpc0lucHV0KGl0ZW0pKSB7XG4gICAgICAgICAgLy8gc2VlIGFsc286IGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8yMDhcbiAgICAgICAgICBpdGVtLmZvY3VzKCk7IC8vIGZpeGVzIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8xNzZcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7IC8vIGZpeGVzIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8xNTVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0YXJ0QmVjYXVzZU1vdXNlTW92ZWQoZSkge1xuICAgICAgaWYgKCFfZ3JhYmJlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAod2hpY2hNb3VzZUJ1dHRvbihlKSA9PT0gMCkge1xuICAgICAgICByZWxlYXNlKHt9KTtcbiAgICAgICAgLy8gd2hlbiB0ZXh0IGlzIHNlbGVjdGVkIG9uIGFuIGlucHV0IGFuZCB0aGVuIGRyYWdnZWQsIHBvaW50ZXJ1cCBkb2Vzbid0IGZpcmUuXG4gICAgICAgIC8vIHRoaXMgaXMgb3VyIG9ubHkgaG9wZVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIHRydXRoeSBjaGVjayBmaXhlcyAjMjM5LCBlcXVhbGl0eSBmaXhlcyAjMjA3LCBmaXhlcyAjNTAxXG4gICAgICBpZiAoXG4gICAgICAgIGUuY2xpZW50WCAhPT0gdW5kZWZpbmVkXG4gICAgICAgICYmIE1hdGguYWJzKGUuY2xpZW50WCAtIF9tb3ZlWCkgPD0gKGRyYWtlLm9wdGlvbnMuc2xpZGVGYWN0b3JYIHx8IDApXG4gICAgICAgICYmIGUuY2xpZW50WSAhPT0gdW5kZWZpbmVkXG4gICAgICAgICYmIE1hdGguYWJzKGUuY2xpZW50WSAtIF9tb3ZlWSkgPD0gKGRyYWtlLm9wdGlvbnMuc2xpZGVGYWN0b3JZIHx8IDApXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoZHJha2Uub3B0aW9ucy5pZ25vcmVJbnB1dFRleHRTZWxlY3Rpb24pIHtcbiAgICAgICAgY29uc3QgY2xpZW50WCA9IGUuY2xpZW50WCB8fCAwO1xuICAgICAgICBjb25zdCBjbGllbnRZID0gZS5jbGllbnRZIHx8IDA7XG4gICAgICAgIGNvbnN0IGVsZW1lbnRCZWhpbmRDdXJzb3IgPSBkb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KGNsaWVudFgsIGNsaWVudFkpO1xuXG4gICAgICAgIGlmIChpc0lucHV0KGVsZW1lbnRCZWhpbmRDdXJzb3IpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGdyYWJiZWQgPSBfZ3JhYmJlZDsgLy8gY2FsbCB0byBlbmQoKSB1bnNldHMgX2dyYWJiZWRcbiAgICAgIGV2ZW50dWFsTW92ZW1lbnRzKHRydWUpO1xuICAgICAgbW92ZW1lbnRzKCk7XG4gICAgICBlbmQoKTtcbiAgICAgIHN0YXJ0KGdyYWJiZWQpO1xuXG4gICAgICBjb25zdCBvZmZzZXQgPSBnZXRPZmZzZXQoX2l0ZW0pO1xuICAgICAgX29mZnNldFggPSBlLnBhZ2VYIC0gb2Zmc2V0LmxlZnQ7XG4gICAgICBfb2Zmc2V0WSA9IGUucGFnZVkgLSBvZmZzZXQudG9wO1xuXG4gICAgICBjb25zdCBpblRyYW5zaXQgPSBfY29weSB8fCBfaXRlbTtcbiAgICAgIGlmIChpblRyYW5zaXQpIHtcbiAgICAgICAgaW5UcmFuc2l0LmNsYXNzTGlzdC5hZGQoJ2d1LXRyYW5zaXQnKTtcbiAgICAgIH1cbiAgICAgIHJlbmRlck1pcnJvckltYWdlKCk7XG4gICAgICBkcmFnKGUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhblN0YXJ0KGl0ZW0pIHtcbiAgICAgIGlmIChkcmFrZS5kcmFnZ2luZyAmJiBfbWlycm9yKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChpc0NvbnRhaW5lcihpdGVtKSkge1xuICAgICAgICByZXR1cm47IC8vIGRvbid0IGRyYWcgY29udGFpbmVyIGl0c2VsZlxuICAgICAgfVxuICAgICAgY29uc3QgaGFuZGxlID0gaXRlbTtcbiAgICAgIHdoaWxlIChnZXRQYXJlbnQoaXRlbSkgJiYgaXNDb250YWluZXIoZ2V0UGFyZW50KGl0ZW0pKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgaWYgKGRyYWtlLm9wdGlvbnMuaW52YWxpZChpdGVtLCBoYW5kbGUpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGl0ZW0gPSBnZXRQYXJlbnQoaXRlbSk7IC8vIGRyYWcgdGFyZ2V0IHNob3VsZCBiZSBhIHRvcCBlbGVtZW50XG4gICAgICAgIGlmICghaXRlbSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3Qgc291cmNlID0gZ2V0UGFyZW50KGl0ZW0pO1xuICAgICAgaWYgKCFzb3VyY2UpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGRyYWtlLm9wdGlvbnMuaW52YWxpZChpdGVtLCBoYW5kbGUpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgbW92YWJsZSA9IGRyYWtlLm9wdGlvbnMubW92ZXMoaXRlbSwgc291cmNlLCBoYW5kbGUsIGl0ZW0ubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgIGlmICghbW92YWJsZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGl0ZW0sXG4gICAgICAgIHNvdXJjZSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FuTW92ZShpdGVtKSB7XG4gICAgICByZXR1cm4gISFjYW5TdGFydChpdGVtKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYW51YWxTdGFydChpdGVtKSB7XG4gICAgICBjb25zdCBjb250ZXh0ID0gY2FuU3RhcnQoaXRlbSk7XG4gICAgICBpZiAoY29udGV4dCkge1xuICAgICAgICBzdGFydChjb250ZXh0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdGFydChjb250ZXh0KSB7XG4gICAgICBpZiAoZHJha2Uub3B0aW9ucy5jb3B5KGNvbnRleHQuaXRlbSwgY29udGV4dC5zb3VyY2UpKSB7XG4gICAgICAgIF9jb3B5ID0gY29udGV4dC5pdGVtLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgZHJha2UuZW1pdCgnY2xvbmVkJywge1xuICAgICAgICAgIGNsb25lOiBfY29weSxcbiAgICAgICAgICBvcmlnaW5hbDogY29udGV4dC5pdGVtLFxuICAgICAgICAgIHR5cGU6ICdjb3B5JyxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIF9zb3VyY2UgPSBjb250ZXh0LnNvdXJjZTtcbiAgICAgIF9pdGVtID0gY29udGV4dC5pdGVtO1xuICAgICAgX2luaXRpYWxTaWJsaW5nID0gX2N1cnJlbnRTaWJsaW5nID0gY29udGV4dC5pdGVtLm5leHRFbGVtZW50U2libGluZztcblxuICAgICAgZHJha2UuZHJhZ2dpbmcgPSB0cnVlO1xuICAgICAgZHJha2UuZW1pdCgnZHJhZycsIF9pdGVtLCBfc291cmNlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlbmQoKSB7XG4gICAgICBpZiAoIWRyYWtlLmRyYWdnaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGl0ZW0gPSBfY29weSB8fCBfaXRlbTtcbiAgICAgIGRyb3AoaXRlbSwgZ2V0UGFyZW50KGl0ZW0pKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1bmdyYWIoKSB7XG4gICAgICBfZ3JhYmJlZCA9IGZhbHNlO1xuICAgICAgZXZlbnR1YWxNb3ZlbWVudHModHJ1ZSk7XG4gICAgICBtb3ZlbWVudHModHJ1ZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVsZWFzZShlKSB7XG4gICAgICB1bmdyYWIoKTtcblxuICAgICAgaWYgKCFkcmFrZS5kcmFnZ2luZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBpdGVtID0gX2NvcHkgfHwgX2l0ZW07XG4gICAgICBjb25zdCBjbGllbnRYID0gZS5jbGllbnRYIHx8IDA7XG4gICAgICBjb25zdCBjbGllbnRZID0gZS5jbGllbnRZIHx8IDA7XG4gICAgICBjb25zdCBlbGVtZW50QmVoaW5kQ3Vyc29yID0gZ2V0RWxlbWVudEJlaGluZFBvaW50KF9taXJyb3IsIGNsaWVudFgsIGNsaWVudFkpO1xuICAgICAgY29uc3QgZHJvcFRhcmdldCA9IGZpbmREcm9wVGFyZ2V0KGVsZW1lbnRCZWhpbmRDdXJzb3IsIGNsaWVudFgsIGNsaWVudFkpO1xuXG4gICAgICBpZiAoZHJvcFRhcmdldCAmJiAoKF9jb3B5ICYmIGRyYWtlLm9wdGlvbnMuY29weVNvcnRTb3VyY2UpIHx8ICFfY29weSB8fCBkcm9wVGFyZ2V0ICE9PSBfc291cmNlKSkge1xuICAgICAgICBkcm9wKGl0ZW0sIGRyb3BUYXJnZXQpO1xuICAgICAgfSBlbHNlIGlmIChkcmFrZS5vcHRpb25zLnJlbW92ZU9uU3BpbGwpIHtcbiAgICAgICAgcmVtb3ZlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYW5jZWwoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkcm9wKGl0ZW0sIHRhcmdldCkge1xuICAgICAgaWYgKF9jb3B5ICYmIGRyYWtlLm9wdGlvbnMuY29weVNvcnRTb3VyY2UgJiYgdGFyZ2V0ID09PSBfc291cmNlKSB7XG4gICAgICAgIF9pdGVtLnJlbW92ZSgpO1xuICAgICAgfVxuICAgICAgaWYgKGlzSW5pdGlhbFBsYWNlbWVudCh0YXJnZXQpKSB7XG4gICAgICAgIGRyYWtlLmVtaXQoJ2NhbmNlbCcsIHtcbiAgICAgICAgICBlbGVtZW50OiBpdGVtLFxuICAgICAgICAgIGNvbnRhaW5lcjogX3NvdXJjZSxcbiAgICAgICAgICBzb3VyY2U6IF9zb3VyY2UsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZHJha2UuZW1pdCgnZHJvcCcsIHtcbiAgICAgICAgICBlbGVtZW50OiBpdGVtLFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICBzb3VyY2U6IF9zb3VyY2UsXG4gICAgICAgICAgc2libGluZzogX2N1cnJlbnRTaWJsaW5nLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY2xlYW51cCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbW92ZSgpIHtcbiAgICAgIGlmICghZHJha2UuZHJhZ2dpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgaXRlbSA9IF9jb3B5IHx8IF9pdGVtO1xuICAgICAgY29uc3QgcGFyZW50ID0gZ2V0UGFyZW50KGl0ZW0pO1xuICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICBpdGVtLnJlbW92ZSgpO1xuICAgICAgfVxuICAgICAgZHJha2UuZW1pdChfY29weSA/ICdjYW5jZWwnIDogJ3JlbW92ZScsIHtcbiAgICAgICAgZWxlbWVudDogaXRlbSxcbiAgICAgICAgY29udGFpbmVyOiBwYXJlbnQsXG4gICAgICAgIHNvdXJjZTogX3NvdXJjZSxcbiAgICAgIH0pO1xuXG4gICAgICBjbGVhbnVwKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FuY2VsKHJldmVydCkge1xuICAgICAgaWYgKCFkcmFrZS5kcmFnZ2luZykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCByZXZlcnRzID0gYXJndW1lbnRzLmxlbmd0aCA+IDAgPyByZXZlcnQgOiBkcmFrZS5vcHRpb25zLnJldmVydE9uU3BpbGw7XG4gICAgICBjb25zdCBpdGVtID0gX2NvcHkgfHwgX2l0ZW07XG4gICAgICBjb25zdCBwYXJlbnQgPSBnZXRQYXJlbnQoaXRlbSk7XG4gICAgICBjb25zdCBpbml0aWFsID0gaXNJbml0aWFsUGxhY2VtZW50KHBhcmVudCk7XG4gICAgICBpZiAoaW5pdGlhbCA9PT0gZmFsc2UgJiYgcmV2ZXJ0cykge1xuICAgICAgICBpZiAoX2NvcHkpIHtcbiAgICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICBfY29weS5yZW1vdmUoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX3NvdXJjZS5pbnNlcnRCZWZvcmUoaXRlbSwgX2luaXRpYWxTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGluaXRpYWwgfHwgcmV2ZXJ0cykge1xuICAgICAgICBkcmFrZS5lbWl0KCdjYW5jZWwnLCB7XG4gICAgICAgICAgZWxlbWVudDogaXRlbSxcbiAgICAgICAgICBjb250YWluZXI6IF9zb3VyY2UsXG4gICAgICAgICAgc291cmNlOiBfc291cmNlLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRyYWtlLmVtaXQoJ2Ryb3AnLCB7XG4gICAgICAgICAgZWxlbWVudDogaXRlbSxcbiAgICAgICAgICB0YXJnZXQ6IHBhcmVudCxcbiAgICAgICAgICBzb3VyY2U6IF9zb3VyY2UsXG4gICAgICAgICAgc2libGluZzogX2N1cnJlbnRTaWJsaW5nLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY2xlYW51cCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgICBjb25zdCBpdGVtID0gX2NvcHkgfHwgX2l0ZW07XG4gICAgICB1bmdyYWIoKTtcbiAgICAgIHJlbW92ZU1pcnJvckltYWdlKCk7XG4gICAgICBpZiAoaXRlbSkge1xuICAgICAgICBpdGVtLmNsYXNzTGlzdC5yZW1vdmUoJ2d1LXRyYW5zaXQnKTtcbiAgICAgIH1cbiAgICAgIGlmIChfcmVuZGVyVGltZXIpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KF9yZW5kZXJUaW1lcik7XG4gICAgICB9XG4gICAgICBkcmFrZS5kcmFnZ2luZyA9IGZhbHNlO1xuICAgICAgaWYgKF9sYXN0RHJvcFRhcmdldCkge1xuICAgICAgICBkcmFrZS5lbWl0KCdvdXQnLCB7XG4gICAgICAgICAgZWxlbWVudDogaXRlbSxcbiAgICAgICAgICBjb250YWluZXI6IF9sYXN0RHJvcFRhcmdldCxcbiAgICAgICAgICBzb3VyY2U6IF9zb3VyY2UsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgZHJha2UuZW1pdCgnZHJhZ2VuZCcsIHsgZWxlbWVudDogaXRlbSB9KTtcbiAgICAgIF9zb3VyY2UgPSBfaXRlbSA9IF9jb3B5ID0gX2luaXRpYWxTaWJsaW5nID0gX2N1cnJlbnRTaWJsaW5nID0gX3JlbmRlclRpbWVyID0gX2xhc3REcm9wVGFyZ2V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpc0luaXRpYWxQbGFjZW1lbnQodGFyZ2V0LCBzKSB7XG4gICAgICBsZXQgc2libGluZztcbiAgICAgIGlmIChzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgc2libGluZyA9IHM7XG4gICAgICB9IGVsc2UgaWYgKF9taXJyb3IpIHtcbiAgICAgICAgc2libGluZyA9IF9jdXJyZW50U2libGluZztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNpYmxpbmcgPSAoX2NvcHkgfHwgX2l0ZW0pLm5leHRFbGVtZW50U2libGluZztcbiAgICAgIH1cbiAgICAgIHJldHVybiB0YXJnZXQgPT09IF9zb3VyY2UgJiYgc2libGluZyA9PT0gX2luaXRpYWxTaWJsaW5nO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGZpbmREcm9wVGFyZ2V0KGVsZW1lbnRCZWhpbmRDdXJzb3IsIGNsaWVudFgsIGNsaWVudFkpIHtcbiAgICAgIGxldCB0YXJnZXQgPSBlbGVtZW50QmVoaW5kQ3Vyc29yO1xuXG4gICAgICBmdW5jdGlvbiBhY2NlcHRlZCgpIHtcbiAgICAgICAgY29uc3QgZHJvcHBhYmxlID0gaXNDb250YWluZXIodGFyZ2V0KTtcbiAgICAgICAgaWYgKGRyb3BwYWJsZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbW1lZGlhdGUgPSBnZXRJbW1lZGlhdGVDaGlsZCh0YXJnZXQsIGVsZW1lbnRCZWhpbmRDdXJzb3IpO1xuICAgICAgICBjb25zdCByZWZlcmVuY2UgPSBnZXRSZWZlcmVuY2UodGFyZ2V0LCBpbW1lZGlhdGUsIGNsaWVudFgsIGNsaWVudFksIGRyYWtlLm9wdGlvbnMuZGlyZWN0aW9uKTtcbiAgICAgICAgY29uc3QgaW5pdGlhbCA9IGlzSW5pdGlhbFBsYWNlbWVudCh0YXJnZXQsIHJlZmVyZW5jZSk7XG4gICAgICAgIGlmIChpbml0aWFsKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7IC8vIHNob3VsZCBhbHdheXMgYmUgYWJsZSB0byBkcm9wIGl0IHJpZ2h0IGJhY2sgd2hlcmUgaXQgd2FzXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZHJha2Uub3B0aW9ucy5hY2NlcHRzKF9pdGVtLCB0YXJnZXQsIF9zb3VyY2UsIHJlZmVyZW5jZSk7XG4gICAgICB9XG5cbiAgICAgIHdoaWxlICh0YXJnZXQgJiYgIWFjY2VwdGVkKCkpIHtcbiAgICAgICAgdGFyZ2V0ID0gZ2V0UGFyZW50KHRhcmdldCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZHJhZyhlKSB7XG4gICAgICBpZiAoIV9taXJyb3IpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICBjb25zdCBjbGllbnRYID0gZS5jbGllbnRYIHx8IDA7XG4gICAgICBjb25zdCBjbGllbnRZID0gZS5jbGllbnRZIHx8IDA7XG4gICAgICBjb25zdCB4ID0gY2xpZW50WCAtIF9vZmZzZXRYO1xuICAgICAgY29uc3QgeSA9IGNsaWVudFkgLSBfb2Zmc2V0WTtcblxuICAgICAgX21pcnJvci5zdHlsZS5sZWZ0ID0gYCR7eH1weGA7XG4gICAgICBfbWlycm9yLnN0eWxlLnRvcCA9IGAke3l9cHhgO1xuXG4gICAgICBjb25zdCBpdGVtID0gX2NvcHkgfHwgX2l0ZW07XG4gICAgICBjb25zdCBlbGVtZW50QmVoaW5kQ3Vyc29yID0gZ2V0RWxlbWVudEJlaGluZFBvaW50KF9taXJyb3IsIGNsaWVudFgsIGNsaWVudFkpO1xuICAgICAgbGV0IGRyb3BUYXJnZXQgPSBmaW5kRHJvcFRhcmdldChlbGVtZW50QmVoaW5kQ3Vyc29yLCBjbGllbnRYLCBjbGllbnRZKTtcbiAgICAgIGNvbnN0IGNoYW5nZWQgPSBkcm9wVGFyZ2V0ICE9PSBudWxsICYmIGRyb3BUYXJnZXQgIT09IF9sYXN0RHJvcFRhcmdldDtcbiAgICAgIGlmIChjaGFuZ2VkIHx8IGRyb3BUYXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgb3V0KCk7XG4gICAgICAgIF9sYXN0RHJvcFRhcmdldCA9IGRyb3BUYXJnZXQ7XG4gICAgICAgIG92ZXIoKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcGFyZW50ID0gZ2V0UGFyZW50KGl0ZW0pO1xuICAgICAgaWYgKGRyb3BUYXJnZXQgPT09IF9zb3VyY2UgJiYgX2NvcHkgJiYgIWRyYWtlLm9wdGlvbnMuY29weVNvcnRTb3VyY2UpIHtcbiAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgIGl0ZW0ucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGxldCByZWZlcmVuY2U7XG4gICAgICBjb25zdCBpbW1lZGlhdGUgPSBnZXRJbW1lZGlhdGVDaGlsZChkcm9wVGFyZ2V0LCBlbGVtZW50QmVoaW5kQ3Vyc29yKTtcbiAgICAgIGlmIChpbW1lZGlhdGUgIT09IG51bGwpIHtcbiAgICAgICAgcmVmZXJlbmNlID0gZ2V0UmVmZXJlbmNlKGRyb3BUYXJnZXQsIGltbWVkaWF0ZSwgY2xpZW50WCwgY2xpZW50WSwgZHJha2Uub3B0aW9ucy5kaXJlY3Rpb24pO1xuICAgICAgfSBlbHNlIGlmIChkcmFrZS5vcHRpb25zLnJldmVydE9uU3BpbGwgPT09IHRydWUgJiYgIV9jb3B5KSB7XG4gICAgICAgIHJlZmVyZW5jZSA9IF9pbml0aWFsU2libGluZztcbiAgICAgICAgZHJvcFRhcmdldCA9IF9zb3VyY2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoX2NvcHkgJiYgcGFyZW50KSB7XG4gICAgICAgICAgaXRlbS5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKChyZWZlcmVuY2UgPT09IG51bGwgJiYgY2hhbmdlZCkgfHwgKHJlZmVyZW5jZSAhPT0gaXRlbSAmJiByZWZlcmVuY2UgIT09IGl0ZW0ubmV4dEVsZW1lbnRTaWJsaW5nKSkge1xuICAgICAgICBfY3VycmVudFNpYmxpbmcgPSByZWZlcmVuY2U7XG4gICAgICAgIGRyb3BUYXJnZXQuaW5zZXJ0QmVmb3JlKGl0ZW0sIHJlZmVyZW5jZSk7XG4gICAgICAgIGRyYWtlLmVtaXQoJ3NoYWRvdycsIHtcbiAgICAgICAgICBlbGVtZW50OiBpdGVtLFxuICAgICAgICAgIGNvbnRhaW5lcjogZHJvcFRhcmdldCxcbiAgICAgICAgICBzb3VyY2U6IF9zb3VyY2UsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBtb3ZlZCh0eXBlKSB7XG4gICAgICAgIGRyYWtlLmVtaXQodHlwZSwge1xuICAgICAgICAgIGVsZW1lbnQ6IGl0ZW0sXG4gICAgICAgICAgY29udGFpbmVyOiBfbGFzdERyb3BUYXJnZXQsXG4gICAgICAgICAgc291cmNlOiBfc291cmNlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIG92ZXIoKSB7XG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgbW92ZWQoJ292ZXInKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZnVuY3Rpb24gb3V0KCkge1xuICAgICAgICBpZiAoX2xhc3REcm9wVGFyZ2V0KSB7XG4gICAgICAgICAgbW92ZWQoJ291dCcpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc3BpbGxPdmVyKGVsKSB7XG4gICAgICBpZiAoZWwpIHtcbiAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZ3UtaGlkZScpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNwaWxsT3V0KGVsKSB7XG4gICAgICBpZiAoZWwgJiYgZHJha2UuZHJhZ2dpbmcpIHtcbiAgICAgICAgZWwuY2xhc3NMaXN0LmFkZCgnZ3UtaGlkZScpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlbmRlck1pcnJvckltYWdlKCkge1xuICAgICAgaWYgKF9taXJyb3IpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCByZWN0ID0gX2l0ZW0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBfbWlycm9yID0gX2l0ZW0uY2xvbmVOb2RlKHRydWUpO1xuICAgICAgX21pcnJvci5zdHlsZS53aWR0aCA9IGAke3JlY3Qud2lkdGh9cHhgO1xuICAgICAgX21pcnJvci5zdHlsZS5oZWlnaHQgPSBgJHtyZWN0LmhlaWdodH1weGA7XG4gICAgICBfbWlycm9yLmNsYXNzTGlzdC5yZW1vdmUoJ2d1LXRyYW5zaXQnKTtcbiAgICAgIF9taXJyb3IuY2xhc3NMaXN0LmFkZCgnZ3UtbWlycm9yJyk7XG4gICAgICBkcmFrZS5vcHRpb25zLm1pcnJvckNvbnRhaW5lci5hcHBlbmRDaGlsZChfbWlycm9yKTtcbiAgICAgIGRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdwb2ludGVybW92ZScsIGRyYWcpO1xuICAgICAgZHJha2Uub3B0aW9ucy5taXJyb3JDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZ3UtdW5zZWxlY3RhYmxlJyk7XG4gICAgICBkcmFrZS5lbWl0KCdjbG9uZWQnLCB7XG4gICAgICAgIGNsb25lOiBfbWlycm9yLFxuICAgICAgICBvcmlnaW5hbDogX2l0ZW0sXG4gICAgICAgIHR5cGU6ICdtaXJyb3InLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVtb3ZlTWlycm9ySW1hZ2UoKSB7XG4gICAgICBpZiAoX21pcnJvcikge1xuICAgICAgICBkcmFrZS5vcHRpb25zLm1pcnJvckNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdndS11bnNlbGVjdGFibGUnKTtcbiAgICAgICAgZG9jdW1lbnRFbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvaW50ZXJtb3ZlJywgZHJhZyk7XG4gICAgICAgIF9taXJyb3IucmVtb3ZlKCk7XG4gICAgICAgIF9taXJyb3IgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgfSAvLyBFbmQgY29uc3RydWN0b3JcblxuICBvbihldmVudFR5cGUsIGNhbGxiYWNrKSB7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgKGV2dCkgPT4ge1xuICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCAuLi5PYmplY3QudmFsdWVzKGV2dC5kZXRhaWwpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgb2ZmKGV2ZW50VHlwZSwgY2FsbGJhY2spIHtcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnRUeXBlLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGVtaXQoZXZlbnRUeXBlLCBkZXRhaWwsIC4uLmFyZ3MpIHtcbiAgICBpZiAoZGV0YWlsIGluc3RhbmNlb2YgTm9kZSkge1xuICAgICAgLy8gT2xkIHN5bnRheCB3aXRoIHBvc2l0aW9uYWwgYXJndW1lbnRzXG4gICAgICBkZXRhaWwgPSBbZGV0YWlsLCAuLi5hcmdzXTtcbiAgICB9XG4gICAgY29uc3QgZXZ0ID0gbmV3IEN1c3RvbUV2ZW50KGV2ZW50VHlwZSwgeyBkZXRhaWwgfSk7XG4gICAgdGhpcy5kaXNwYXRjaEV2ZW50KGV2dCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzdGF0aWMgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgbW92ZXM6ICgpID0+IHRydWUsXG4gICAgYWNjZXB0czogKCkgPT4gdHJ1ZSxcbiAgICBpbnZhbGlkOiAoKSA9PiBmYWxzZSxcbiAgICBpc0NvbnRhaW5lcjogKCkgPT4gZmFsc2UsXG4gICAgY29weTogZmFsc2UsXG4gICAgY29weVNvcnRTb3VyY2U6IGZhbHNlLFxuICAgIHJldmVydE9uU3BpbGw6IGZhbHNlLFxuICAgIHJlbW92ZU9uU3BpbGw6IGZhbHNlLFxuICAgIGRpcmVjdGlvbjogJ3ZlcnRpY2FsJyxcbiAgICBpZ25vcmVJbnB1dFRleHRTZWxlY3Rpb246IHRydWUsXG4gICAgbWlycm9yQ29udGFpbmVyOiBkb2N1bWVudC5ib2R5LFxuICB9O1xufVxuXG5mdW5jdGlvbiBkcmFndWxhKC4uLmFyZ3MpIHtcbiAgcmV0dXJuIG5ldyBEcmFndWxhKC4uLmFyZ3MpO1xufVxuXG5mdW5jdGlvbiB3aGljaE1vdXNlQnV0dG9uKGUpIHtcbiAgaWYgKGUudG91Y2hlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGUudG91Y2hlcy5sZW5ndGg7XG4gIH1cbiAgaWYgKGUud2hpY2ggIT09IHVuZGVmaW5lZCAmJiBlLndoaWNoICE9PSAwKSB7XG4gICAgcmV0dXJuIGUud2hpY2g7XG4gIH0gLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8yNjFcbiAgaWYgKGUuYnV0dG9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGUuYnV0dG9ucztcbiAgfVxuXG4gIGNvbnN0IHsgYnV0dG9uIH0gPSBlO1xuICBpZiAoYnV0dG9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2pxdWVyeS9qcXVlcnkvYmxvYi85OWU4ZmYxYmFhN2FlMzQxZTk0YmI4OWMzZTg0NTcwYzdjM2FkOWVhL3NyYy9ldmVudC5qcyNMNTczLUw1NzVcbiAgICByZXR1cm4gYnV0dG9uICYgMSA/IDEgOiBidXR0b24gJiAyID8gMyA6IGJ1dHRvbiAmIDQgPyAyIDogMDtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRPZmZzZXQoZWwpIHtcbiAgY29uc3QgcmVjdCA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICByZXR1cm4ge1xuICAgIGxlZnQ6IHJlY3QubGVmdCArIHdpbmRvdy5zY3JvbGxYLFxuICAgIHRvcDogcmVjdC50b3AgKyB3aW5kb3cuc2Nyb2xsWSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0RWxlbWVudEJlaGluZFBvaW50KHBvaW50LCB4LCB5KSB7XG4gIHBvaW50ID0gcG9pbnQgfHwge307XG4gIGNvbnN0IHN0YXRlID0gcG9pbnQuY2xhc3NOYW1lIHx8ICcnO1xuICBwb2ludC5jbGFzc05hbWUgKz0gJyBndS1oaWRlJztcbiAgY29uc3QgZWwgPSBkb2N1bWVudC5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuICBwb2ludC5jbGFzc05hbWUgPSBzdGF0ZTtcblxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIGdldFBhcmVudChlbCkge1xuICByZXR1cm4gZWwucGFyZW50Tm9kZSA9PT0gZG9jdW1lbnQgPyBudWxsIDogZWwucGFyZW50Tm9kZTtcbn1cblxuZnVuY3Rpb24gaXNFZGl0YWJsZShlbCkge1xuICBpZiAoIWVsKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IC8vIG5vIHBhcmVudHMgd2VyZSBlZGl0YWJsZVxuICBpZiAoZWwuY29udGVudEVkaXRhYmxlID09PSAnZmFsc2UnKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IC8vIHN0b3AgdGhlIGxvb2t1cFxuICBpZiAoZWwuY29udGVudEVkaXRhYmxlID09PSAndHJ1ZScpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSAvLyBmb3VuZCBhIGNvbnRlbnRFZGl0YWJsZSBlbGVtZW50IGluIHRoZSBjaGFpblxuXG4gIHJldHVybiBpc0VkaXRhYmxlKGdldFBhcmVudChlbCkpOyAvLyBjb250ZW50RWRpdGFibGUgaXMgc2V0IHRvICdpbmhlcml0J1xufVxuXG5mdW5jdGlvbiBpc0lucHV0KGVsKSB7XG4gIHJldHVybiBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgZWwudGFnTmFtZSA9PT0gJ1NFTEVDVCcgfHwgaXNFZGl0YWJsZShlbCk7XG59XG5cbmZ1bmN0aW9uIGdldEltbWVkaWF0ZUNoaWxkKGRyb3BUYXJnZXQsIHRhcmdldCkge1xuICBsZXQgaW1tZWRpYXRlID0gdGFyZ2V0O1xuICB3aGlsZSAoaW1tZWRpYXRlICE9PSBkcm9wVGFyZ2V0ICYmIGdldFBhcmVudChpbW1lZGlhdGUpICE9PSBkcm9wVGFyZ2V0KSB7XG4gICAgaW1tZWRpYXRlID0gZ2V0UGFyZW50KGltbWVkaWF0ZSk7XG4gIH1cblxuICBpZiAoaW1tZWRpYXRlID09PSBkb2N1bWVudEVsZW1lbnQpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHJldHVybiBpbW1lZGlhdGU7XG59XG5cbmZ1bmN0aW9uIGdldFJlZmVyZW5jZShkcm9wVGFyZ2V0LCB0YXJnZXQsIHgsIHksIGRpcmVjdGlvbikge1xuICBjb25zdCBob3Jpem9udGFsID0gZGlyZWN0aW9uID09PSAnaG9yaXpvbnRhbCc7XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZShhZnRlcikge1xuICAgIHJldHVybiBhZnRlciA/IHRhcmdldC5uZXh0RWxlbWVudFNpYmxpbmcgOiB0YXJnZXQ7XG4gIH1cblxuICBmdW5jdGlvbiBpbnNpZGUoKSB7XG4gICAgLy8gZmFzdGVyLCBidXQgb25seSBhdmFpbGFibGUgaWYgZHJvcHBlZCBpbnNpZGUgYSBjaGlsZCBlbGVtZW50XG4gICAgY29uc3QgcmVjdCA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICBpZiAoaG9yaXpvbnRhbCkge1xuICAgICAgcmV0dXJuIHJlc29sdmUoeCA+IHJlY3QubGVmdCArIHJlY3Qud2lkdGggLyAyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzb2x2ZSh5ID4gcmVjdC50b3AgKyByZWN0LmhlaWdodCAvIDIpO1xuICB9XG5cbiAgZnVuY3Rpb24gb3V0c2lkZSgpIHtcbiAgICAvLyBzbG93ZXIsIGJ1dCBhYmxlIHRvIGZpZ3VyZSBvdXQgYW55IHBvc2l0aW9uXG4gICAgY29uc3QgY291bnRDaGlsZHJlbiA9IGRyb3BUYXJnZXQuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGxldCBpO1xuICAgIGxldCBlbDtcbiAgICBsZXQgcmVjdDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY291bnRDaGlsZHJlbjsgaSsrKSB7XG4gICAgICBlbCA9IGRyb3BUYXJnZXQuY2hpbGRyZW5baV07XG4gICAgICByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICBpZiAoaG9yaXpvbnRhbCAmJiByZWN0LmxlZnQgKyByZWN0LndpZHRoIC8gMiA+IHgpIHtcbiAgICAgICAgcmV0dXJuIGVsO1xuICAgICAgfVxuICAgICAgaWYgKCFob3Jpem9udGFsICYmIHJlY3QudG9wICsgcmVjdC5oZWlnaHQgLyAyID4geSkge1xuICAgICAgICByZXR1cm4gZWw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0ICE9PSBkcm9wVGFyZ2V0ID8gaW5zaWRlKCkgOiBvdXRzaWRlKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZHJhZ3VsYTtcbiJdfQ==
