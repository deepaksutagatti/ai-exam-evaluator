import { motion } from 'framer-motion';
import { Check, FileSearch, Sparkles } from 'lucide-react';
import type { SceneProps } from '../../../video-types';

const checks = ['Reading the response', 'Comparing evidence', 'Building feedback'];

export function Scene2({ progress }: SceneProps) {
  const reveal = 1;
  return (
    <motion.section
      className="scene scene-evaluate"
      initial={{ clipPath: 'circle(0% at 72% 48%)' }}
      animate={{ clipPath: 'circle(150% at 72% 48%)' }}
      exit={{ clipPath: 'circle(0% at 18% 55%)' }}
      transition={{ duration: 0.92, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="scene-caption">02 / REVIEW</div>
      <div className="evaluate-copy">
        <motion.div className="scene-kicker" initial={{ opacity: 0, y: 14 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <span className="yellow-rule" /> AI-ASSISTED EVALUATION
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.45, duration: 0.72 }}>
          A second reader<br /><em>for every answer.</em>
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.75, duration: 0.65 }}>
          Evidence is surfaced question by question, so review stays transparent.
        </motion.p>
        <div className="check-list">
          {checks.map((item, index) => (
            <motion.div key={item} initial={{ opacity: 0, x: -14 }} animate={{ opacity: reveal, x: 0 }} transition={{ delay: 0.98 + index * 0.18, duration: 0.45 }}>
              <span className={index < 2 ? 'check-dot complete' : 'check-dot'}>{index < 2 ? <Check size={10} /> : ''}</span>{item}
              {index === 1 && <b>done</b>}
              {index === 2 && <i className="typing-dots">···</i>}
            </motion.div>
          ))}
        </div>
      </div>
      <motion.div className="evaluation-card" initial={{ opacity: 0, x: 80, rotateY: 18 }} animate={{ opacity: reveal, x: 0, rotateY: 0 }} transition={{ delay: 0.4, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}>
        <div className="eval-card-head"><span className="mini-mark">AI</span><span>Evaluation in progress</span><span className="live-pip" /></div>
        <div className="answer-preview">
          <div className="answer-number">Q04</div>
          <div className="answer-content"><strong>Explain the second law in terms of entropy.</strong><span className="answer-scribble">Entropy measures the unavailable energy...</span><span className="answer-scribble short">for a process to occur.</span></div>
          <div className="ai-callout"><Sparkles size={13} /><span>Strong definition<br /><b>+ reasoning evidence</b></span></div>
        </div>
        <div className="eval-metric-row"><div><FileSearch size={16} /><span>Questions mapped</span><strong>06 / 08</strong></div><div><Sparkles size={16} /><span>Confidence</span><strong>94%</strong></div></div>
        <div className="eval-progress"><span style={{ width: '76%' }} /></div>
      </motion.div>
    </motion.section>
  );
}