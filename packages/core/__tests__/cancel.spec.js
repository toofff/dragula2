/* eslint-disable */
import { dragula } from '../src';

describe('cancel', () => {
  describe('cancel does not throw when not dragging', () => {
    it('a single time', () => {
      const drake = dragula();

      expect(() => {
        drake.cancel();
      }).not.toThrow();
    });

    it('multiple times', () => {
      const drake = dragula();

      expect(() => {
        drake.cancel();
        drake.cancel();
        drake.cancel();
        drake.cancel();
      }).not.toThrow();
    });
  });

  it('when dragging and cancel gets called, nothing happens', () => {
    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.start(item);
    drake.cancel();

    expect(div.children).toHaveLength(1);
    expect(drake.dragging).toBeFalsy();
  });

  it('when dragging and cancel gets called, cancel event is emitted', () => {
    const stubCancel = jest.fn();
    const stubDragEnd = jest.fn();

    const div = document.createElement('div');
    const item = document.createElement('div');

    const drake = dragula([div]);
    div.appendChild(item);
    document.body.appendChild(div);
    drake.start(item);
    drake.on('cancel', stubCancel);
    drake.on('dragend', stubDragEnd);
    drake.cancel();

    expect(drake.dragging).toBeFalsy();
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });

  it('when dragging a copy and cancel gets called, default does not revert', () => {
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
    drake.cancel();

    expect(drake.dragging).toBeFalsy();
    expect(stubDrop).toHaveBeenCalledTimes(1);
    expect(stubDrop.mock.calls[0][0]).toEqual(item);
    expect(stubDrop.mock.calls[0][1]).toEqual(div2);
    expect(stubDrop.mock.calls[0][2]).toEqual(div);
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });

  it('when dragging a copy and cancel gets called, revert is executed', () => {
    const stubCancel = jest.fn();
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
    drake.on('cancel', stubCancel);
    drake.on('dragend', stubDragEnd);
    drake.cancel(true);

    expect(drake.dragging).toBeFalsy();
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item);
  });
});
