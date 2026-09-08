module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.tsx'],
  moduleNameMapper: { '^@fintrack/client$': '<rootDir>/../packages/fintrack-client/index.ts' },
};
