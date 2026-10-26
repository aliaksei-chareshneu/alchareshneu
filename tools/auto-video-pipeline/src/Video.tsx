import React from 'react';
import {AbsoluteFill, Composition, Img, Sequence, staticFile} from 'remotion';
import {Video} from '@remotion/media';
import rawEdit from './edit.json';

type EditPlan = {
  fps: number;
  width: number;
  height: number;
  frames: number;
  clips: Array<{at: number; start: number; frames: number}>;
  captions: Array<{start: number; end: number; text: string}>;
  broll: Array<{file: string; start: number; end: number}>;
};
const edit = rawEdit as EditPlan;

const AutoEdited: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: '#090909'}}>
    {edit.clips.map((clip, i) => (
      <Sequence key={`clip-${i}`} from={clip.at} durationInFrames={clip.frames}>
        <Video
          src={staticFile('source.mp4')}
          trimBefore={clip.start}
          durationInFrames={clip.frames}
          style={{width: '100%', height: '100%', objectFit: 'contain'}}
        />
      </Sequence>
    ))}
    {edit.broll.map((item, i) => (
      <Sequence key={`broll-${i}`} from={item.start} durationInFrames={item.end - item.start}>
        <Img src={staticFile(item.file)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </Sequence>
    ))}
    {edit.captions.map((cue, i) => (
      <Sequence key={`caption-${i}`} from={cue.start} durationInFrames={Math.max(1, cue.end - cue.start)}>
        <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', padding: '0 7% 11%'}}>
          <div style={{fontFamily: 'Arial, sans-serif', fontSize: Math.round(edit.width * 0.047),
            color: '#fff', fontWeight: 800, textAlign: 'center',
            textShadow: '1px 2px 5px #000, -1px -2px 5px #000',
            backgroundColor: '#0008', borderRadius: 10, padding: '6px 12px'}}>{cue.text}</div>
        </AbsoluteFill>
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const VideoRoot: React.FC = () => (
  <Composition
    id="AutoEdited"
    component={AutoEdited}
    durationInFrames={Math.max(1, edit.frames)}
    fps={edit.fps}
    width={edit.width}
    height={edit.height}
  />
);
