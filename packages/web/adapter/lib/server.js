import {Server} from './build/server/index.js';
import {manifest} from './build/server/manifest.js';

export const kitServer = new Server(manifest);
