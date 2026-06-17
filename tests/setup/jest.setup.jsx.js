// Phase 58 Plan 58-04: register @testing-library/jest-dom matchers globally for
// JSX component tests. Imported via jest.config.js `setupFilesAfterEach` is not a
// valid option — we wire this through a second `setupFiles` entry. `setupFiles`
// runs BEFORE each test file's module graph loads, which is safe for jest-dom.
import '@testing-library/jest-dom';
