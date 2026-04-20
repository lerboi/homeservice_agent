/** @type {import('jest').Config} */
const config = {
  // Phase 58 Plan 58-04 (POLISH-01/04/05): `.test.jsx` added so RTL+jsdom can
  // exercise the new `<EmptyState>`, `<ErrorState>`, `<AsyncButton>` primitives.
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.test.jsx'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/', '/tests/integration/'],
  // Default env stays `node` for existing API/lib tests. Component tests override via
  // the `@jest-environment jsdom` pragma already present in tests/components/*.test.jsx.
  testEnvironment: 'node',
  // `package.json` has "type": "module", so `.js` is already treated as ESM by
  // the experimental VM-modules runtime. Declare `.jsx` explicitly so the same
  // ESM loader path applies to the new component tests.
  extensionsToTreatAsEsm: ['.jsx'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.jsx.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    // JSX files use babel-jest with the Jest-only babel config so Next.js's SWC
    // pipeline is not perturbed (the repo has no root babel config).
    '^.+\\.jsx$': ['babel-jest', { configFile: './babel.jest.config.cjs' }],
  },
  transformIgnorePatterns: [
    // Allow lucide-react (ESM-only) to be transformed by babel-jest when imported
    // from .test.jsx files under the `node --experimental-vm-modules` flag.
    '/node_modules/(?!(lucide-react)/)',
  ],
};
export default config;
