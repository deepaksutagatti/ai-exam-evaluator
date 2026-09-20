import { motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, MessageSquareText } from 'lucide-react';
import type { SceneProps } from '../../../video-types';

export function Scene5({ progress }: SceneProps) {
  const reveal = 1;
  return (
    <motion.section className="scene scene-payoff" initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0 0 0)' }} exit={{ clipPath: 'inset(0 0 0 100%)' }} transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}>
      <div className="payoff-grid" />
      <div className="scene-caption">05 / HANDOFF</div>
      <motion.div className="payoff-copy" initial={{ opacity: 0, y: 24 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.28, duration: 0.8 }}>
        <div className="scene-kicker"><span className="yellow-rule" /> TEACHER-APPROVED</div>
        <h2>A score is useful<br /><em>when it moves learning.</em></h2>
        <p>From uploaded page to clear next step — Ananya leaves with feedback she can act on.</p>
      </motion.div>
      <motion.div className="feedback-note-card" initial={{ opacity: 0, x: 38, rotate: 3 }} animate={{ opacity: reveal, x: 0, rotate: -3 }} transition={{ delay: 0.58, duration: 0.95, ease: [0.16, 1, 0.3, 1] }}>
        <div className="note-card-top"><span><MessageSquareText size={15} /> STUDENT FEEDBACK</span><span>14 MAY 2025</span></div>
        <h3>Ananya, you’re close.</h3>
        <p>Your cycle analysis is strong. Next, revisit how entropy changes across an irreversible process.</p>
        <div className="note-card-footer"><span><CheckCircle2 size={13} /> Reviewed by Prof. Mira Sen</span><ArrowUpRight size={16} /></div>
      </motion.div>
      <motion.div className="payoff-stamp" initial={{ opacity: 0, scale: 0.6, rotate: -16 }} animate={{ opacity: reveal, scale: 1, rotate: -7 }} transition={{ delay: 1.05, duration: 0.7, type: 'spring', stiffness: 260, damping: 18 }}><CheckCircle2 size={20} /><span>APPROVED<br /><b>82 · B+</b></span></motion.div>
      <motion.div className="payoff-footer" initial={{ opacity: 0 }} animate={{ opacity: reveal }} transition={{ delay: 1.22, duration: 0.6 }}>AI EXAMINER <span>·</span> assessment with evidence</motion.div>
    </motion.section>
  );
}