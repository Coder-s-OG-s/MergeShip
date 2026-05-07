const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
};

module.exports = createJestConfig(customConfig);
