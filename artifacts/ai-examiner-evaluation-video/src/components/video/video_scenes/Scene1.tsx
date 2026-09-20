import { motion } from 'framer-motion';
import { FileText, ScanLine } from 'lucide-react';
import type { SceneProps } from '../../../video-types';

export function Scene1({ progress }: SceneProps) {
  const reveal = 1;
  return (
    <motion.section
      className="scene scene-upload"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.82, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="scene-caption">01 / INTAKE</div>
      <div className="scene-copy">
        <motion.div className="scene-kicker" initial={{ opacity: 0, y: 14 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.18, duration: 0.6 }}>
          <span className="yellow-rule" /> UPLOAD THE WORK
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 22 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.38, duration: 0.8 }}>
          Start with the<br /><em>student response.</em>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: reveal, y: 0 }} transition={{ delay: 0.7, duration: 0.7 }}>
          One answer sheet. The context to read it well.
        </motion.p>
      </div>

      <motion.div className="paper-sheet" initial={{ opacity: 0, x: 100, rotate: 5 }} animate={{ opacity: reveal, x: 0, rotate: -4 }} transition={{ delay: 0.44, duration: 1.05, ease: [0.16, 1, 0.3, 1] }}>
        <div className="paper-topline"><span>AI EXAMINER</span><small>ASSESSMENT DESK</small></div>
        <div className="paper-course">Applied Thermodynamics</div>
        <div className="paper-title">Thermodynamics<br />Midterm 02</div>
        <div className="paper-student"><span>STUDENT</span><strong>Ananya Rao</strong></div>
        <div className="paper-lines">
          <span /><span /><span /><span /><span /><span />
        </div>
        <div className="paper-footer"><small>ANSWER SHEET · 08 PAGES</small><b>PDF</b></div>
        <motion.div className="scan-line" animate={{ y: [0, 220, 0] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}><ScanLine size={13} /> DOCUMENT READY</motion.div>
      </motion.div>
      <motion.div className="file-chip" initial={{ opacity: 0, scale: 0.84, x: 22 }} animate={{ opacity: reveal, scale: 1, x: 0 }} transition={{ delay: 1.02, duration: 0.55 }}>
        <FileText size={15} /><span>ananya-rao-midterm.pdf</span><b>2.8 MB</b>
      </motion.div>
    </motion.section>
  );
}