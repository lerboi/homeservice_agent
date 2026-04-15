// Pure ESM helpers for the sidebar theme toggle — no React imports (node-env testable)

export function getNextTheme(current) {
  return current === 'dark' ? 'light' : 'dark';
}

export function getToggleLabel(current) {
  return current === 'dark' ? 'Light mode' : 'Dark mode';
}

export function getToggleAriaLabel(current) {
  return `Switch to ${getNextTheme(current)} mode`;
}
