module.exports = {
  preset: 'jest-expo',
  modulePaths: ['<rootDir>/node_modules'],
  testMatch: ['**/tests/**/*.test.tsx'],
  moduleNameMapper: { '^@fintrack/client$': '<rootDir>/../packages/fintrack-client/index.ts' },
};
