/* eslint-disable */
const dragula = require("../src/dragula");

describe("default", () => {
  it("drake has sensible default options", () => {
    const options = dragula({}).options;

    expect(typeof options.moves).toEqual("function");
    expect(typeof options.accepts).toEqual("function");
    expect(typeof options.invalid).toEqual("function");
    expect(typeof options.isContainer).toEqual("function");
    expect(options.copy()).toBeFalsy();
    expect(options.revertOnSpill).toBeFalsy();
    expect(options.removeOnSpill).toBeFalsy();
    expect(options.direction).toEqual("vertical");
    expect(options.mirrorContainer).toEqual(document.body);
  });
});
