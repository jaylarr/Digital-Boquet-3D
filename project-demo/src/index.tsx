import React from 'react';
import {registerRoot,Composition} from 'remotion';
import {PetalPopAd} from './PetalPopAd';
const Root=()=> <Composition id="PetalPopAd" component={PetalPopAd} durationInFrames={2700} fps={30} width={1080} height={1920}/>;
registerRoot(Root);
