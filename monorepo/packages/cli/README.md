# @forager/cli
[![JSR](https://jsr.io/badges/@forager/cli)](https://jsr.io/@forager/cli)
[![Checks](https://github.com/andykais/forager/actions/workflows/cli.yml/badge.svg)](https://github.com/andykais/forager/actions/workflows/cli.yml)
[![License](https://img.shields.io/github/license/andykais/forager)](https://github.com/andykais/forager/blob/main/LICENSE)

## Installation
```bash
deno install -A --unstable-ffi -n forager jsr:@forager/cli
```

## Usage
Use `forager --help` and `forager <subcommand> --help` for detailed cli documentation.
```
Usage:   forager
Version: 0.2.0

Description:

  A command line interface to @forager/core

Options:

  -h, --help                 - Show this help.
  -V, --version              - Show the version number for this program.
  --config         <config>  - The path to a config file. If not specified, forager will look in the default
                               config directory
  -l, --log-level  <level>   - The log level forager will output.                                             (Default: "info", Values: "debug", "info", "error", "json")
  -q, --quiet                - Shorthand for --log-level=error

Commands:

  init                  - Initialize a forager database and set up a config file
  search                - search for media in the forager database
  discover  <globpath>  - Discover media with a provided glob to the forager database
  create    <filepath>  - add a file to the forager database
```
