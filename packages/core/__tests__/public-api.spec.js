/* eslint-disable */
import {dragula} from '../src/dragula';

describe('public-api', () => {
  it('public api matches expectation', () => {
    expect(typeof dragula).toBe('function');
  });
});
