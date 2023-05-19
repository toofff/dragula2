const dragula = require('@dragula2/core');

const sortable = $('sortable');

dragula([$('left-defaults'), $('right-defaults')]);
dragula([$('left-copy'), $('right-copy')], { copy: true });
dragula([$('left-events'), $('right-events')])
  .on('drag', (el) => {
    el.className = el.className.replace('ex-moved', '');
  })
  .on('drop', (el) => {
    el.className += ' ex-moved';
  })
  .on('over', (el, container) => {
    container.className += ' ex-over';
  })
  .on('out', (el, container) => {
    container.className = container.className.replace('ex-over', '');
  });
dragula([$('left-rollbacks'), $('right-rollbacks')], { revertOnSpill: true });
dragula([$('left-lovehandles'), $('right-lovehandles')], {
  moves(el, container, handle) {
    return handle.classList.contains('handle');
  },
});

dragula([$('left-rm-spill'), $('right-rm-spill')], { removeOnSpill: true });
dragula([$('left-copy-1tomany'), $('right-copy-1tomany')], {
  copy(el, source) {
    return source === $('left-copy-1tomany');
  },
  accepts(el, target) {
    return target !== $('left-copy-1tomany');
  },
});

dragula([sortable]);

sortable.addEventListener('click', clickHandler);

function clickHandler(e) {
  const { target } = e;
  if (target === sortable) {
    return;
  }
  target.innerHTML += ' [click!]';

  setTimeout(() => {
    target.innerHTML = target.innerHTML.replace(/ \[click!\]/g, '');
  }, 500);
}

function $(id) {
  return document.getElementById(id);
}
