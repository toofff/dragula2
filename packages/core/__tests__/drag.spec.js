/* eslint-disable */
import { dragula } from '../src/dragula';
import { events } from './lib/events';

describe('drag', () => {
  describe.skip('drag event gets emitted when clicking an item', () => {
    const testCase = (description, eventOptions, options) => {
      const o = options || {};
      const passes = o.passes !== false;
      const choiceMethod = passes ? it : it.failing;

      choiceMethod(description, () => {
        const stubDrag = jest.fn();

        const div = document.createElement('div');
        const item = document.createElement(o.tag || 'div');

        const drake = dragula([div], o.dragulaOpts);
        div.appendChild(item);
        document.body.appendChild(div);
        drake.on('drag', stubDrag);
        events.raise(o.containerClick ? div : item, 'pointerdown', eventOptions);
        events.raise(o.containerClick ? div : item, 'pointermove');
        expect(drake.dragging).toEqual(passes);
        expect(stubDrag).toHaveBeenCalledTimes(1);
        expect(stubDrag.mock.calls[0][0]).toEqual(item);
        expect(stubDrag.mock.calls[0][1]).toEqual(div);
      });
    };

    testCase('works for left clicks', { which: 1 });
    testCase('works for wheel clicks', { which: 1 });
    testCase('works when clicking buttons by default', { which: 1 }, { tag: 'button', passes: true });
    testCase('works when clicking anchors by default', { which: 1 }, { tag: 'a', passes: true });
    testCase('fails for right clicks', { which: 2 }, { passes: false });
    testCase('fails for meta-clicks', { which: 1, metaKey: true }, { passes: false });
    testCase('fails for ctrl-clicks', { which: 1, ctrlKey: true }, { passes: false });
    testCase('fails when clicking containers', { which: 1 }, { containerClick: true, passes: false });
    testCase(
      'fails whenever invalid returns true',
      { which: 1 },
      { passes: false, dragulaOpts: { invalid: jest.fn(() => true) } },
    );
    testCase(
      'fails whenever moves returns false',
      { which: 1 },
      { passes: false, dragulaOpts: { moves: jest.fn(() => false) } },
    );
  });

  it.skip('when already dragging, pointerdown/pointermove ends (cancels) previous drag', () => {
    const stubDragEnd = jest.fn();
    const stubCancel = jest.fn();
    const stubDrag = jest.fn();

    const div = document.createElement('div');
    const item1 = document.createElement('div');
    const item2 = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item1);
    div.appendChild(item2);
    document.body.appendChild(div);
    drake.start(item1);
    drake.on('dragend', stubDragEnd);
    drake.on('cancel', stubCancel);
    drake.on('drag');
    events.raise(item2, 'pointerdown', { which: 1 });
    events.raise(item2, 'pointermove', { which: 1 });

    expect(drake.dragging).toBeTruthy();
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item1);
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item1);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
    expect(stubDrag).toHaveBeenCalledTimes(1);
    expect(stubDrag.mock.calls[0][0]).toEqual(item2);
    expect(stubDrag.mock.calls[0][1]).toEqual(div);
  });

  it.skip('when already dragged, ends (drops) previous drag', () => {
    const stubDragEnd = jest.fn();
    const stubDrop = jest.fn();
    const stubDrag = jest.fn();

    const div = document.createElement('div');
    const div2 = document.createElement('div');
    const item1 = document.createElement('div');
    const item2 = document.createElement('div');

    const drake = dragula([div, div2]);
    div.appendChild(item1);
    div.appendChild(item2);
    document.body.appendChild(div);
    document.body.appendChild(div2);
    drake.start(item1);
    div2.appendChild(item1);
    drake.on('dragend', stubDragEnd);
    drake.on('drop', stubDrop);
    drake.on('drag', stubDrag);
    events.raise(item2, 'pointerdown', { which: 1 });
    events.raise(item2, 'pointermove', { which: 1 });

    expect(drake.dragging).toBeTruthy();
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item1);
    expect(stubDrop).toHaveBeenCalledTimes(1);
    expect(stubDrop.mock.calls[0][0]).toEqual(item1);
    expect(stubDrop.mock.calls[0][1]).toEqual(div);
    expect(stubDrop.mock.calls[0][2]).toEqual(div2);
    expect(stubDrag).toHaveBeenCalledTimes(1);
    expect(stubDrag.mock.calls[0][0]).toEqual(item2);
    expect(stubDrag.mock.calls[0][1]).toEqual(div);
  });

  it.skip('when copying, emits cloned with the copy', () => {
    const stubCloned = jest.fn();
    const stubDrag = jest.fn();

    const div = document.createElement('div');
    const item1 = document.createElement('div');
    const item2 = document.createElement('span');

    const drake = dragula([div], { copy: true });
    item2.innerHTML = '<em>the force is <strong>with this one</strong></em>';
    div.appendChild(item1);
    div.appendChild(item2);
    document.body.appendChild(div);
    drake.start(item1);
    drake.on('cloned', stubCloned);
    drake.on('drag', stubDrag);
    events.raise(item2, 'pointerdown', { which: 1 });
    events.raise(item2, 'pointermove', { which: 1 });

    expect(drake.dragging).toBeTruthy();
    expect(stubCloned).toHaveBeenCalledTimes(1);
    expect(stubCloned.mock.calls[0][0]).not.toEqual(item2);
    expect(stubCloned.mock.calls[0][0].tagName).toEqual(item2.tagName);
    expect(stubCloned.mock.calls[0][0].innerHTML).toEqual(item2.innerHTML);
    expect(stubCloned.mock.calls[0][1]).toEqual(item2);
    expect(stubDrag).toHaveBeenCalledTimes(1);
    expect(stubDrag.mock.calls[0][0]).toEqual(item2);
    expect(stubDrag.mock.calls[0][1]).toEqual(div);
  });

  it.skip('when dragging, element gets gu-transit class', () => {
    const div = document.createElement('div');
    const item = document.createElement('div');
    dragula([div]);

    div.appendChild(item);
    document.body.appendChild(div);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(item.className).toBe('gu-transit');
  });

  it.skip('when dragging, body gets gu-unselectable class', () => {
    const div = document.createElement('div');
    const item = document.createElement('div');
    dragula([div]);

    div.appendChild(item);
    document.body.appendChild(div);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(document.body.className).toBe('gu-unselectable');
  });

  it.skip('when dragging, element gets a mirror image for show', () => {
    const stubCloned = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    item.innerHTML = '<em>the force is <strong>with this one</strong></em>';
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('cloned', stubCloned);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(item.className).toBe('gu-transit');
    expect(stubCloned).toHaveBeenCalledTimes(1);
    expect(stubCloned.mock.calls[0][0].className).toBe('gu-mirror');
    expect(stubCloned.mock.calls[0][0].innerHTML).toEqual(item.innerHTML);
    expect(stubCloned.mock.calls[0][1]).toEqual(item);
  });

  it.skip('when dragging, mirror element gets appended to configured mirrorContainer', () => {
    const stubCloned = jest.fn();

    const mirrorContainer = document.createElement('div');
    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div], { mirrorContainer });
    item.innerHTML = '<em>the force is <strong>with this one</strong></em>';
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('cloned', stubCloned);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(stubCloned).toHaveBeenCalledTimes(1);
    expect(stubCloned.mock.calls[0][0].parentNode).toEqual(mirrorContainer);
  });

  it.skip('when dragging stops, element gets gu-transit class removed', () => {
    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(item.className).toBe('gu-transit');

    drake.end();

    expect(item.className).toBe('');
  });

  it.skip('when dragging stops, body becomes selectable again', () => {
    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(document.body.className).toBe('gu-unselectable');

    drake.end();

    expect(document.body.className).toBe('');
  });

  it.skip('when drag begins, check for copy option', () => {
    const stubCopy = jest.fn(() => true);

    const div = document.createElement('div');
    div.className = 'contains';
    const item = document.createElement('div');
    item.className = 'copyable';

    const drake = dragula([div], { copy: stubCopy });
    item.innerHTML = '<em>the force is <strong>with this one</strong></em>';
    div.appendChild(item);
    document.body.appendChild(div);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 }); // ensure the copy method condition is only asserted once

    expect(stubCopy).toHaveBeenCalledTimes(1);
    expect(stubCopy.mock.calls[0][0].className).toBe('copyable');
    expect(stubCopy.mock.calls[0][1].className).toBe('contains');

    drake.end();
  });
});
