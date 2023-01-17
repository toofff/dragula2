/* eslint-disable */
const dragula = require('../src/dragula');

describe('destroy', () => {
  describe('destroy does not throw when not dragging, destroyed, or whatever', () => {
    it('a single time', () => {
      const drake = dragula();

      expect(() => {
        drake.destroy();
      }).not.toThrow();
    });

    it('multiple times', () => {
      const drake = dragula();

      expect(() => {
        drake.destroy();
        drake.destroy();
        drake.destroy();
        drake.destroy();
      }).not.toThrow();
    });
  });

  it.skip('when dragging and destroy gets called, nothing happens', () => {
    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.start(item);
    drake.destroy();

    expect(div.children.length).toEqual(1);
    expect(drake.dragging).toBeFalsy();
  });

  it.skip('when dragging and destroy gets called, dragend event is emitted gracefully', () => {
    const stubDragEnd = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.start(item);
    drake.on('dragend', stubDragEnd);
    drake.destroy();

    expect(drake.dragging).toBeFalsy();
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });

  it.skip('when dragging a copy and destroy gets called, default does not revert', () => {
    const stubDrop = jest.fn();
    const stubDragEnd = jest.fn();

    const div = document.createElement('div');
    const div2 = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div, div2]);
    div.appendChild(item);
    document.body.appendChild(div);
    document.body.appendChild(div2);
    drake.start(item);
    div2.appendChild(item);
    drake.on('drop', stubDrop);
    drake.on('dragend', stubDragEnd);
    drake.destroy();

    expect(drake.dragging).toBeFalsy();
    expect(stubDrop).toHaveBeenCalledTimes(1);
    expect(stubDrop.mock.calls[0][0]).toEqual(item);
    expect(stubDrop.mock.calls[0][1]).toEqual(div2);
    expect(stubDrop.mock.calls[0][2]).toEqual(div);
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });

  it.skip('when dragging a copy and destroy gets called, revert is executed', () => {
    const stubCancel = jest.fn();
    const stubDragEnd = jest.fn();

    const div = document.createElement('div');
    const div2 = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div, div2], { revertOnSpill: true });
    div.appendChild(item);
    document.body.appendChild(div);
    document.body.appendChild(div2);
    drake.start(item);
    div2.appendChild(item);
    drake.on('cancel', stubCancel);
    drake.on('dragend', stubDragEnd);
    drake.destroy();

    expect(drake.dragging).toBeFalsy();
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });
});
