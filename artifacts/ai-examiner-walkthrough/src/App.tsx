import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Scene1 } from './components/video/video_scenes/Scene1';
import { Scene2 } from './components/video/video_scenes/Scene2';
import { Scene3 } from './components/video/video_scenes/Scene3';
import { Scene4 } from './components/video/video_scenes/Scene4';
import { Scene5 } from './components/video/video_scenes/Scene5';
import type { SceneId, SceneProps } from './video-types';

const SCENE_DURATIONS = [5200, 5700, 6100, 6200, 6000];
const SCENE_LABELS = ['UPLOAD', 'REVIEW', 'RESULT', 'FEEDBACK', 'HANDOFF'];

function Scene({ sceneIndex, progress }: SceneProps) {
  const props = { sceneIndex, progress };
  if (sceneIndex === 0) return <Scene1 {...props} />;
  if (sceneIndex === 1) return <Scene2 {...props} />;
  if (sceneIndex === 2) return <Scene3 {...props} />;
  if (sceneIndex === 3) return <Scene4 {...props} />;
  return <Scene5 {...props} />;
}

export default function App() {
  const [sceneIndex, setSceneIndex] = useState<SceneId>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const duration = SCENE_DURATIONS[sceneIndex];
    setProgress(0);
    const progressTimer = window.setInterval(() => {
      setProgress(Math.min(1, Math.max(0, (Date.now() - startedAt) / duration)));
    }, 40);
    const sceneTimer = window.setTimeout(() => {
      setSceneIndex((current) => ((current + 1) % SCENE_DURATIONS.length) as SceneId);
    }, duration);
    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(sceneTimer);
    };
  }, [sceneIndex]);

  const completedMs = SCENE_DURATIONS.slice(0, sceneIndex).reduce((sum, value) => sum + value, 0);
  const elapsedMs = completedMs + progress * SCENE_DURATIONS[sceneIndex];
  return (
    <main className="video-stage" aria-label="AI Examiner evaluation result walkthrough">
      <div className="video-frame">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="ambient ambient-three" />
        <div className="grain" />
        <header className="persistent-header">
          <div className="wordmark"><span className="wordmark-mark">AI</span><span>EXAMINER</span></div>
          <div className="wordmark-caption">ACADEMIC INTELLIGENCE <i /></div>
        </header>
        <div className="persistent-index"><span>ANANYA RAO</span><i /> APPLIED THERMODYNAMICS</div>
        <AnimatePresence mode="sync" initial={false}>
          <Scene key={sceneIndex} sceneIndex={sceneIndex} progress={progress} />
        </AnimatePresence>
        <footer className="timeline">
          <div className="timeline-label"><span>AI EXAMINER</span><b>·</b><strong>{SCENE_LABELS[sceneIndex]}</strong></div>
          <div className="timeline-track">
            {SCENE_DURATIONS.map((duration, index) => <span key={duration} className={index === sceneIndex ? 'active' : index < sceneIndex ? 'complete' : ''}><i style={index === sceneIndex ? { transform: `scaleX(${progress})` } : undefined} /></span>)}
          </div>
          <div className="timeline-time">00:{String(Math.floor(elapsedMs / 1000)).padStart(2, '0')} / 00:29</div>
        </footer>
      </div>
    </main>
  );
}