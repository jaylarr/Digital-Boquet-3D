import {run} from './common.mjs';
for(const script of ['capture','audio','refine-media','render','finalize','qa','preview-verify'])await run(process.execPath,[`scripts/${script}.mjs`],{stdio:'inherit'});
