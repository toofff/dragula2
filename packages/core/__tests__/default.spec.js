/* eslint-disable */
import {dragula} from '../src/dragula';

describe('default', () => {
  it('drake has sensible default options', () => {
    const { options } = dragula({});

    expect(typeof options.moves).toBe('function');
    expect(typeof options.accepts).toBe('function');
    expect(typeof options.invalid).toBe('function');
    expect(typeof options.isContainer).toBe('function');
    expect(options.copy()).toBeFalsy();
    expect(options.revertOnSpill).toBeFalsy();
    expect(options.removeOnSpill).toBeFalsy();
    expect(options.direction).toBe('vertical');
    expect(options.mirrorContainer).toEqual(document.body);
  });
});
