import { motion } from 'framer-motion';
import { CheckCircle2, ShieldCheck, Target } from 'lucide-react';
import type { SceneProps } from '../../../video-types';

export function Scene3({ progress }: SceneProps) {
  const reveal = 1;
  return (
    <motion.section
      className="scene scene-result"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(100% 0 0 0)' }}
      transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="scene-caption">03 / RESULT</div>
      <motion.div className="result-topline" initial={{ opacity: 0, y: -14 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.22, duration: 0.55 }}>
        <div><span className="scene-kicker"><span className="yellow-rule" /> EVALUATION COMPLETE</span><h2>Thermodynamics Midterm 02</h2><p>Ananya Rao · Applied Thermodynamics</p></div>
        <div className="approved-badge"><CheckCircle2 size={15} /> Teacher-approved result</div>
      </motion.div>
      <div className="result-grid">
        <motion.div className="score-panel" initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: reveal, scale: 1 }} transition={{ delay: 0.4, duration: 0.78, ease: [0.16, 1, 0.3, 1] }}>
          <div className="score-label">Overall score</div>
          <div className="big-score">82<span>/100</span></div>
          <div className="grade-row"><b>B+</b><span>Strong understanding</span></div>
          <div className="score-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="49" /><motion.circle cx="60" cy="60" r="49" pathLength="1" initial={{ pathLength: 0 }} animate={{ pathLength: 0.82 }} transition={{ delay: 0.65, duration: 1.1, ease: 'easeOut' }} /></svg><strong>82%</strong></div>
        </motion.div>
        <motion.div className="summary-panel" initial={{ opacity: 0, x: 26 }} animate={{ opacity: reveal, x: 0 }} transition={{ delay: 0.55, duration: 0.72 }}>
          <div className="panel-eyebrow">Assessment summary</div>
          <p>“A confident response with clear command of core cycles. A little more precision in entropy reasoning would make this excellent.”</p>
          <div className="confidence-bar"><div><span>Evaluation confidence</span><strong>94%</strong></div><span className="bar-track"><i /></span></div>
        </motion.div>
        <motion.div className="stat-tile stat-green" initial={{ opacity: 0, y: 16 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.78, duration: 0.55 }}><CheckCircle2 size={17} /><span>Strengths found</span><strong>3</strong></motion.div>
        <motion.div className="stat-tile stat-yellow" initial={{ opacity: 0, y: 16 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.9, duration: 0.55 }}><Target size={17} /><span>Focus areas</span><strong>2</strong></motion.div>
      </div>
      <motion.div className="teacher-line" initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: reveal, scaleX: 1 }} transition={{ delay: 1.15, duration: 0.8 }}><ShieldCheck size={14} /> Reviewed and approved by Prof. Mira Sen <span>·</span> 14 May 2025</motion.div>
    </motion.section>
  );
}