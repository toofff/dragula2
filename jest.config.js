/* eslint-disable */
const config = {
  roots: ["<rootDir>/__tests__", "<rootDir>/src"],
  setupFilesAfterEnv: ["./jest.setup-after-env.js"],
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/__tests__/**/*.spec.js", "<rootDir>/src/**/*.spec.js"],
  verbose: true,
};

module.exports = config;
