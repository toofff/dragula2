/* eslint-disable */
import { dragula } from '../src/dragula';

describe('drake-api', () => {
  it('drake can be instantiated without throwing', () => {
    const drakeFactory = () => dragula();

    expect(drakeFactory).not.toThrow();
  });

  it('drake has expected api properties', () => {
    const drake = dragula();

    expect(drake).toBeTruthy();
    expect(typeof drake).toBe('object');
    expect(Array.isArray(drake.containers)).toBeTruthy();
    expect(typeof drake.start).toBe('function');
    expect(typeof drake.end).toBe('function');
    expect(typeof drake.cancel).toBe('function');
    expect(typeof drake.remove).toBe('function');
    expect(typeof drake.destroy).toBe('function');
    expect(typeof drake.dragging).toBe('boolean');
    expect(drake.dragging).toBeFalsy();
  });
});
