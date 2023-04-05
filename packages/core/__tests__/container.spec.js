/* eslint-disable */
const dragula = require('../src/dragula');

describe('container', () => {
  it('drake defaults to no containers', () => {
    const drake = dragula();

    expect(Array.isArray(drake.containers)).toBeTruthy();
    expect(drake.containers).toHaveLength(0);
  });

  it('drake reads containers from array argument', () => {
    const el = document.createElement('div');
    const containers = [el];
    const drake = dragula(containers);

    expect(drake.containers).toEqual(containers);
    expect(drake.containers).toHaveLength(1);
  });

  it('drake reads containers from array in options', () => {
    const el = document.createElement('div');
    const containers = [el];
    const drake = dragula({ containers });

    expect(drake.containers).toEqual(containers);
    expect(drake.containers).toHaveLength(1);
  });

  it('containers in options take precedent', () => {
    const el = document.createElement('div');
    const containers = [el];
    const drake = dragula([], { containers });

    expect(drake.containers).toEqual(containers);
    expect(drake.containers).toHaveLength(1);
  });
});
