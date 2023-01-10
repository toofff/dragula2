/* eslint-disable */
const config = {
  preset: "jest-puppeteer",
  roots: ["<rootDir>/__tests__", "<rootDir>/src"],
  setupFilesAfterEnv: ["./jest.setup-after-env.js"],
  testMatch: ["<rootDir>/__tests__/**/*.spec.js", "<rootDir>/src/**/*.spec.js"],
  verbose: true,
};

module.exports = config;
