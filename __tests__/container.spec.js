/* eslint-disable */
const dragula = require("../src/dragula");

describe("container", () => {
  /**
   * @jest-environment jsdom
   */
  it("drake defaults to no containers", () => {
    const drake = dragula();

    expect(Array.isArray(drake.containers)).toBeTruthy();
    expect(drake.containers.length).toEqual(0);
  });

  /**
   * @jest-environment jsdom
   */
  it("drake reads containers from array argument", () => {
    const el = document.createElement("div");
    const containers = [el];
    const drake = dragula(containers);

    expect(drake.containers).toEqual(containers);
    expect(drake.containers.length).toEqual(1);
  });

  /**
   * @jest-environment jsdom
   */
  it("drake reads containers from array in options", () => {
    const el = document.createElement("div");
    const containers = [el];
    const drake = dragula({ containers });

    expect(drake.containers).toEqual(containers);
    expect(drake.containers.length).toEqual(1);
  });

  /**
   * @jest-environment jsdom
   */
  it("containers in options take precedent", () => {
    const el = document.createElement("div");
    const containers = [el];
    const drake = dragula([], { containers });

    expect(drake.containers).toEqual(containers);
    expect(drake.containers.length).toEqual(1);
  });
});
