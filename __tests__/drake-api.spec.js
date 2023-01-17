/* eslint-disable */
const dragula = require('../src/dragula');

describe('drake-api', () => {
  it('drake can be instantiated without throwing', () => {
    const drakeFactory = () => dragula();

    expect(drakeFactory).not.toThrow();
  });

  it('drake has expected api properties', () => {
    const drake = dragula();

    expect(drake).toBeTruthy();
    expect(typeof drake).toEqual('object');
    expect(Array.isArray(drake.containers)).toBeTruthy();
    expect(typeof drake.start).toEqual('function');
    expect(typeof drake.end).toEqual('function');
    expect(typeof drake.cancel).toEqual('function');
    expect(typeof drake.remove).toEqual('function');
    expect(typeof drake.destroy).toEqual('function');
    expect(typeof drake.dragging).toEqual('boolean');
    expect(drake.dragging).toBeFalsy();
  });
});
