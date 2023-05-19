/* eslint-disable */
import { dragula } from '../src/dragula';

describe('end', () => {
  describe('end does not throw when not dragging', () => {
    it('a single time', () => {
      const drake = dragula();

      expect(() => {
        drake.end();
      }).not.toThrow();
    });

    it('multiple times', () => {
      const drake = dragula();

      expect(() => {
        drake.end();
        drake.end();
        drake.end();
        drake.end();
      }).not.toThrow();
    });
  });

  it('when already dragging, .end() ends (cancels) previous drag', () => {
    const stubDragEnd = jest.fn();
    const stubCancel = jest.fn();

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
    drake.end();

    expect(drake.dragging).toBeFalsy();
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item1);
    expect(stubCancel).toHaveBeenCalledTimes(1);
    expect(stubCancel.mock.calls[0][0]).toEqual(item1);
    expect(stubCancel.mock.calls[0][1]).toEqual(div);
  });

  it('when already dragged, ends (drops) previous drag', () => {
    const stubDragEnd = jest.fn();
    const stubDrop = jest.fn();

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
    drake.end();

    expect(drake.dragging).toBeFalsy();
    expect(stubDragEnd).toHaveBeenCalledTimes(1);
    expect(stubDragEnd.mock.calls[0][0]).toEqual(item1);
    expect(stubDrop).toHaveBeenCalledTimes(1);
    expect(stubDrop.mock.calls[0][0]).toEqual(item1);
    expect(stubDrop.mock.calls[0][1]).toEqual(div);
    expect(stubDrop.mock.calls[0][2]).toEqual(div2);
  });
});
