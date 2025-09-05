# Usage
Binaries of the cli interface can be downloaded under [Releases](https://github.com/andykais/forager/releases)
```
Usage:   forager
Version: 0.4.6  

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

## Project Structure
This repository is a monorepo containing three main projects
- `@forager/core` - typescript interface for the main logic of forager (`packages/core`)
- `@forager/web` - sveltekit web interface for adding/viewing/editing media in forager (`packages/web`)
- `@forager/cli` - a command line interface for common `@forager/core` workflows, and launching the `@forager/web` web interface (`packages/cli`)

  
