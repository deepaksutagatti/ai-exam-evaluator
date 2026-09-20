import { motion } from 'framer-motion';
import { Check, ChevronRight, Sparkles, Target } from 'lucide-react';
import type { SceneProps } from '../../../video-types';

const questions = [
  ['01', 'First law & control volumes', 'Correct', '18 / 20', 'green'],
  ['02', 'Entropy and reversibility', 'Partial', '14 / 20', 'yellow'],
  ['03', 'Rankine cycle analysis', 'Correct', '20 / 20', 'green'],
  ['04', 'Second law explanation', 'Partial', '15 / 20', 'yellow'],
];

export function Scene4({ progress }: SceneProps) {
  const reveal = 1;
  return (
    <motion.section className="scene scene-feedback" initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }} animate={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }} exit={{ clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' }} transition={{ duration: 0.82, ease: [0.76, 0, 0.24, 1] }}>
      <div className="scene-caption">04 / FEEDBACK</div>
      <div className="feedback-head">
        <motion.div className="scene-kicker" initial={{ opacity: 0, y: 12 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.22, duration: 0.55 }}><span className="yellow-rule" /> QUESTION-LEVEL EVIDENCE</motion.div>
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.42, duration: 0.62 }}>Every mark has<br /><em>a next step.</em></motion.h2>
      </div>
      <div className="feedback-layout">
        <motion.div className="question-panel" initial={{ opacity: 0, y: 28 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.48, duration: 0.72 }}>
          <div className="question-panel-head"><span>Question breakdown</span><b>08 questions</b></div>
          {questions.map(([number, title, verdict, score, tone], index) => (
            <motion.div key={number} className={`question-row ${index === 1 ? 'question-active' : ''}`} initial={{ opacity: 0, x: -16 }} animate={{ opacity: reveal, x: 0 }} transition={{ delay: 0.7 + index * 0.11, duration: 0.4 }}>
              <span className={`question-icon ${tone}`}>{tone === 'green' ? <Check size={12} /> : '·'}</span><div><strong>{number} <span>{title}</span></strong><small className={tone}>{verdict}</small></div><b className="question-points">{score}</b><ChevronRight size={14} />
            </motion.div>
          ))}
          <div className="question-more">+ 4 more questions <ChevronRight size={13} /></div>
        </motion.div>
        <motion.div className="insights-stack" initial={{ opacity: 0, x: 34 }} animate={{ opacity: reveal, x: 0 }} transition={{ delay: 0.72, duration: 0.72 }}>
          <div className="insight-card strengths-card"><div className="insight-card-title"><span><Check size={13} /></span><strong>What went well</strong></div><p>Clear use of first-law balance equations</p><p>Accurate cycle assumptions and units</p><p>Shows work before the final answer</p></div>
          <div className="insight-card focus-card"><div className="insight-card-title"><span><Target size={13} /></span><strong>Worth revisiting</strong></div><p>Be more precise when defining entropy</p><p>Label the direction of heat transfer</p></div>
          <div className="spark-note"><Sparkles size={15} /><span>Feedback is ready to share<br /><b>in a language students can use.</b></span></div>
        </motion.div>
      </div>
    </motion.section>
  );
}