/* eslint-disable */
const dragula = require("../src/dragula");

describe("public-api", () => {
  it("public api matches expectation", () => {
    expect(typeof dragula).toEqual("function");
  });
});
