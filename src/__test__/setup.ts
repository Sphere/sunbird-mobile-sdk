import 'reflect-metadata';
import 'whatwg-fetch';

// jsdom does not expose the WHATWG stream classes. @zip.js/zip.js (pulled in by
// @capgo/capacitor-zip, which sdk.ts imports) extends TransformStream at module load,
// so without these every spec that transitively imports sdk.ts fails to run.
const streamWeb = require('stream/web');
['ReadableStream', 'WritableStream', 'TransformStream', 'CompressionStream', 'DecompressionStream']
    .forEach((name) => {
        if (typeof global[name] === 'undefined' && streamWeb[name]) {
            global[name] = streamWeb[name];
        }
    });
