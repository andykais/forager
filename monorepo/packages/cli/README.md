# @forager/cli
[![JSR](https://jsr.io/badges/@forager/cli)](https://jsr.io/@forager/cli)
[![Checks](https://github.com/andykais/forager/actions/workflows/cli.yml/badge.svg)](https://github.com/andykais/forager/actions/workflows/cli.yml)
[![License](https://img.shields.io/github/license/andykais/forager)](https://github.com/andykais/forager/blob/main/LICENSE)

## Installation
```bash
deno install -A --unstable-ffi -n forager jsr:@forager/cli
```

## Usage
```bash
# initialize the forager config, database and pull down the web app assets
forager init
# add some media into the forager database
forager discover ~/Downloads
# launch the web app to view and edit media
forager gui
```


Use `forager --help` and `forager <subcommand> --help` for detailed cli documentation.
```
Usage:   forager
Version: 0.4.0

Description:

  A command line interface to @forager/core

Options:

  -h, --help                 - Show this help.
  -V, --version              - Show the version number for this program.
  --config         <config>  - The path to a config file. If not specified, forager will look in the default
                               config directory
  -l, --log-level  <level>   - The log level forager will output.                                             (Default: "INFO", Values: "DEBUG", "INFO", "ERROR",
                                                                                                              "SILENT")
  --json                     - Silence logs and print structured json after a command completes
  -q, --quiet                - Shorthand for --log-level=SILENT

Commands:

  init                  - set up a forager config file and initialize a the database
  search                - search for media in the forager database
  discover  <globpath>  - add media to the forager database with a provided file glob
  create    <filepath>  - add a file to the forager database
  delete                - delete a file from the forager database
  gui                   - launch the forager graphical web interface
```
