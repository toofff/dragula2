/* eslint-disable */
const dragula = require('../src/dragula');
const events = require('./lib/events');

describe('remove', () => {
  describe('remove does not throw when not dragging', () => {
    it('a single time', () => {
      const drake = dragula();

      expect(() => {
        drake.remove();
      }).not.toThrow();
    });

    it('multiple times', () => {
      const drake = dragula();

      expect(() => {
        drake.remove();
        drake.remove();
        drake.remove();
        drake.remove();
      }).not.toThrow();
    });
  });

  it('when dragging and remove gets called, element is removed', () => {
    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.start(item);
    drake.remove();

    expect(div.children).toHaveLength(0);
    expect(drake.dragging).toBeFalsy();
  });

  it('when dragging and remove gets called, remove event is emitted', () => {
    const stubRemove = jest.fn();
    const stubDragEnd = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.start(item);
    drake.on('remove', stubRemove);
    drake.on('dragend', stubDragEnd);
    drake.remove();

    expect(drake.dragging).toBeFalsy();
    expect(stubRemove).toHaveBeenCalledTimes(1);
    expect(stubRemove.mock.calls[0][0]).toEqual(item);
    expect(stubRemove.mock.calls[0][1]).toEqual(div);
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });

  it.skip('when dragging a copy and cancel gets called, revert is executed', () => {
    const stubCancel = jest.fn();
    const stubDragEnd = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div], { copy: true });
    div.appendChild(item);
    document.body.appendChild(div);
    events.raise(item, 'pointerdown', { which: 1 });
    events.raise(item, 'pointermove', { which: 1 });
    drake.on('cancel', stubCancel);
    drake.on('dragend', stubDragEnd);
    drake.remove();

    expect(drake.dragging).toBeFalsy();
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0].className).toBe('gu-transit');
    expect(stubCancel.mock.calls[0][0]).not.toEqual(item);
    expect(stubCancel.mock.calls[0][1]).toBeNull();
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });
});
