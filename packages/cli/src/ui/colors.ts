import chalk from 'chalk';

export const colors = {
  // Status colors
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,

  // UI elements
  dim: chalk.dim,
  bold: chalk.bold,
  underline: chalk.underline,

  // BrowserFlow brand
  primary: chalk.cyan,
  secondary: chalk.magenta,

  // Code and paths
  code: chalk.cyan,
  path: chalk.underline,

  // Semantic
  pass: chalk.green,
  fail: chalk.red,
  skip: chalk.yellow,
};

// Pre-rendered symbols for consistent output
export const symbols = {
  pass: chalk.green('✓'),
  fail: chalk.red('✗'),
  pending: chalk.yellow('○'),
  arrow: chalk.cyan('→'),
  bullet: chalk.dim('•'),
  info: chalk.blue('ℹ'),
  warn: chalk.yellow('⚠'),
};

export { chalk };
