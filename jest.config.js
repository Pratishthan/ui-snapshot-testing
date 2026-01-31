export default {
  transform: {},
  testEnvironment: "node",
  collectCoverageFrom: [
    "lib/**/*.js",
    "config-loader.js",
    "cli/**/*.js",
    "!**/node_modules/**",
  ],
  testMatch: ["**/__tests__/**/*.test.js"],
};
