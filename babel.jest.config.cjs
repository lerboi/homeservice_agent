// Jest-only Babel config. NOT picked up by Next.js (root-level `babel.config.js`
// would force Next off SWC — this file is referenced explicitly by Jest's
// `transform` entry in jest.config.js so Next's build pipeline stays on SWC.
//
// Phase 58 POLISH-01/04/05 (Plan 58-04): Jest needs JSX + ESM transform so
// `tests/components/*.test.jsx` can exercise the new UI primitives.

module.exports = {
  presets: [
    // `modules: false` preserves ESM import/export syntax so babel-jest output
    // stays compatible with the rest of the project's native ESM graph under
    // `--experimental-vm-modules`. Only JSX gets transformed; module system
    // untouched.
    ['@babel/preset-env', { targets: { node: 'current' }, modules: false }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
};
