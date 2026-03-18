/** @type {import('jest').Config} */
const config = {
  testMatch: ['**/tests/**/*.test.js'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
export default config;
