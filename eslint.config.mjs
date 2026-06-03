// Flat config (ESM). eslint-config-next v16 ships native flat configs, so we
// import `core-web-vitals` directly. (FlatCompat is only needed for the older
// eslintrc-style config-next; on v16 it crashes the schema validator with a
// circular-JSON error, so the native import is the correct approach here.)
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  ...nextCoreWebVitals,
];

export default eslintConfig;
