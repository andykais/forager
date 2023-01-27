const { CustomConsole } = require('@jest/console');
// import { CustomConsole } from '@jest/console';

function formatter(type, message) {
  switch(type) {
    case 'error':
      return "\x1b[31m" + message + "\x1b[0m";
    case 'warn':
      return "\x1b[33m" + message + "\x1b[0m";
    case 'log':
    default:
      return message;
  }
}

global.console = new CustomConsole(
  process.stdout,
  process.stderr,
  formatter,
);
