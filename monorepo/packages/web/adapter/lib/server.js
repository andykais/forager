import {Server} from './server/index.js';
import {manifest} from './server/manifest.js';

export const kitServer = new Server(manifest);
