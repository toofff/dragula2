/* eslint-disable */
import {dragula} from '../src/dragula';
import {events} from './lib/events';

describe('events', () => {
  it('start() emits "cloned" for copies', () => {
    const stubCloned = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div], { copy: true });
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('cloned', stubCloned);
    drake.start(item);

    expect(stubCloned).toHaveBeenCalledTimes(1);
    expect(stubCloned.mock.calls[0][2]).toBe('copy');
    expect(stubCloned.mock.calls[0][0]).not.toBe(item);
    expect(stubCloned.mock.calls[0][0].nodeType).toEqual(item.nodeType);
    expect(stubCloned.mock.calls[0][1]).toEqual(item);
  });

  it('.start() emits "drag" for items', () => {
    const stubDrag = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('drag', stubDrag);
    drake.start(item);

    expect(stubDrag).toHaveBeenCalledTimes(1);
    expect(stubDrag.mock.calls[0][0]).toEqual(item);
    expect(stubDrag.mock.calls[0][1]).toEqual(div);
  });

  it.skip('.end() emits "cancel" when not moved', () => {
    const stubDragEnd = jest.fn();
    const stubCancel = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('dragend', stubDragEnd);
    drake.on('cancel', stubCancel);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    drake.end();

    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
  });

  it.skip('.end() emits "drop" when moved', () => {
    const stubDragEnd = jest.fn();
    const stubDrop = jest.fn();

    const div = document.createElement('div');
    const div2 = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div, div2]);
    div.appendChild(item);
    document.body.appendChild(div);
    document.body.appendChild(div2);
    drake.on('dragend', stubDragEnd);
    drake.on('drop', stubDrop);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    div2.appendChild(item);
    drake.end();

    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
    expect(stubDrop).toHaveBeenCalledTimes(1);
    expect(stubDrop.mock.calls[0][0]).toEqual(item);
    expect(stubDrop.mock.calls[0][1]).toEqual(div2);
    expect(stubDrop.mock.calls[0][2]).toEqual(div);
  });

  it.skip('.remove() emits "remove" for items', () => {
    const stubDragEnd = jest.fn();
    const stubRemove = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('dragend', stubDragEnd);
    drake.on('remove', stubRemove);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    drake.remove();

    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
    expect(stubRemove).toHaveBeenCalledTimes(1);
    expect(stubRemove.mock.calls[0][0]).toEqual(item);
    expect(stubRemove.mock.calls[0][1]).toEqual(div);
  });

  it.skip('.remove() emits "cancel" for copies', () => {
    const stubDragEnd = jest.fn();
    const stubCancel = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div], { copy: true });
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('dragend', stubDragEnd);
    drake.on('cancel', stubCancel);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    drake.remove();

    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).not.toEqual(item);
    expect(stubCancel.mock.calls[0][0].nodeType).toEqual(item.nodeType);
    expect(stubCancel.mock.calls[0][1]).toBeNull();
  });

  it.skip('.cancel() emits "cancel" when not moved', () => {
    const stubDragEnd = jest.fn();
    const stubCancel = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('dragend', stubDragEnd);
    drake.on('cancel', stubCancel);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    drake.cancel();

    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).not.toEqual(item);
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
  });

  it.skip('.cancel() emits "drop" when not reverted', () => {
    const stubDragEnd = jest.fn();
    const stubDrop = jest.fn();

    const div = document.createElement('div');
    const div2 = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    document.body.appendChild(div2);
    drake.on('dragend', stubDragEnd);
    drake.on('drop', stubDrop);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    div2.appendChild(item);
    drake.cancel();

    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).not.toEqual(item);
    expect(stubDrop).toHaveBeenCalledTimes(1);
    expect(stubDrop.mock.calls[0][0]).toEqual(item);
    expect(stubDrop.mock.calls[0][1]).toEqual(div2);
    expect(stubDrop.mock.calls[0][2]).toEqual(div);
  });

  it.skip('.cancel() emits "cancel" when reverts', () => {
    const stubDragEnd = jest.fn();
    const stubCancel = jest.fn();

    const div = document.createElement('div');
    const div2 = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div], { revertOnSpill: true });
    div.appendChild(item);
    document.body.appendChild(div);
    document.body.appendChild(div2);
    drake.on('dragend', stubDragEnd);
    drake.on('cancel', stubCancel);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    div2.appendChild(item);
    drake.cancel();

    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).not.toEqual(item);
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
  });

  it.skip('pointerdown emits "cloned" for mirrors', () => {
    const stubCloned = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('cloned', stubCloned);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(stubCloned).toHaveBeenCalledTimes(1);
    expect(stubCloned.mock.calls[0][2]).toBe('mirror');
    expect(stubCloned.mock.calls[0][0]).not.toBe(item);
    expect(stubCloned.mock.calls[0][0].nodeType).toEqual(item.nodeType);
    expect(stubCloned.mock.calls[0][1]).toEqual(item);
  });

  it.skip('pointerdown emits "cloned" for copies', () => {
    const stubCloned = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div], { copy: true });
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('cloned', stubCloned);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(stubCloned).toHaveBeenCalledTimes(1);
    expect(stubCloned.mock.calls[0][2]).toBe('copy');
    expect(stubCloned.mock.calls[0][0]).not.toBe(item);
    expect(stubCloned.mock.calls[0][0].nodeType).toEqual(item.nodeType);
    expect(stubCloned.mock.calls[0][1]).toEqual(item);
  });

  it.skip('pointerdown emits "drag" for items', () => {
    const stubDrag = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.on('drag', stubDrag);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });

    expect(stubDrag).toHaveBeenCalledTimes(1);
    expect(stubDrag.mock.calls[0][0]).toEqual(item);
    expect(stubDrag.mock.calls[0][1]).toEqual(div);
  });
});
