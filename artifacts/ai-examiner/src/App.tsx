import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { useEvaluateAnswerSheet } from '@workspace/api-client-react';
import type { EvaluationResult, QuestionEvaluation } from '@workspace/api-client-react';
import {
  AlertCircle,
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CloudUpload,
  Download,
  FileDown,
  FileText,
  FileCheck2,
  FileSpreadsheet,
  Info,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  GraduationCap,
  Mail,
  MapPin,
  Settings2,
  UserRound,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useAuth,
  useClerk,
  useUser,
} from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { apiUrl, branches, semesters, portalApi, setPortalAuthTokenGetter, type Branch, type MeResponse, type Role, type Student, type StudentImportResult, type Subject } from '@/lib/portalApi';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

const queryClient = new QueryClient();

type TeacherSheet = {
  id: number;
  fileName: string;
  objectPath: string;
  createdAt: string;
  subject: Pick<Subject, 'id' | 'name' | 'code'>;
  student: Pick<Student, 'id' | 'fullName' | 'admissionNumber'>;
};

type TeacherModelAnswer = {
  id: number;
  fileName: string;
  subjectId: number | null;
  createdAt?: string;
};

function EvaluatorPage() {
  const evaluate = useEvaluateAnswerSheet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [answerKey, setAnswerKey] = useState('');
  const [rubric, setRubric] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [teacherContext, setTeacherContext] = useState<{
    sheets: TeacherSheet[];
    documents: TeacherModelAnswer[];
  } | null>(null);
  const [evaluationSheetId, setEvaluationSheetId] = useState('');
  const [evaluationModelId, setEvaluationModelId] = useState('');
  const [evaluationSubjectId, setEvaluationSubjectId] = useState('');

  const isPending = evaluate.isPending;
  const hasForm = Boolean(
    file &&
      examTitle.trim() &&
      Number(maxScore) > 0 &&
      (!teacherContext || (evaluationSheetId && evaluationSubjectId)),
  );

  useEffect(() => {
    portalApi
      .me()
      .then(async (me) => {
        if (me.profile?.role !== 'teacher') return;
        const [sheets, documents] = await Promise.all([
          portalApi.teacherStudentSheets(),
          portalApi.teacherDocuments(),
        ]);
        setTeacherContext({ sheets, documents });
      })
      .catch(() => {
        // The standalone evaluator can still be used when the portal profile
        // is unavailable; the API will enforce authenticated access.
      });
  }, []);

  const selectFile = (nextFile?: File) => {
    setFileError('');
    if (!nextFile) return;
    if (nextFile.type !== 'application/pdf') {
      setFileError('Please choose a PDF answer sheet.');
      return;
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setFileError('That file is larger than 20 MB. Try a smaller export.');
      return;
    }
    setFile(nextFile);
    setResult(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFileError('');
    if (!file) {
      setFileError('Add the student answer sheet to begin.');
      return;
    }
    if (!examTitle.trim()) {
      setFileError('Add an exam title so the evaluation is easy to identify.');
      return;
    }
    if (!Number(maxScore) || Number(maxScore) < 1) {
      setFileError('Maximum score must be at least 1.');
      return;
    }
    const base64 = await fileToBase64(file);
    evaluate.mutate(
      {
        data: {
          fileName: file.name,
          mimeType: 'application/pdf',
          pdfBase64: base64,
          examTitle: examTitle.trim(),
          subject: subject.trim() || undefined,
          maxScore: Number(maxScore),
          answerKey: answerKey.trim() || undefined,
          rubric: rubric.trim() || undefined,
           subjectId: evaluationSubjectId ? Number(evaluationSubjectId) : undefined,
           studentId: evaluationSheetId
             ? teacherContext?.sheets.find((sheet) => String(sheet.id) === evaluationSheetId)?.student.id
             : undefined,
           answerSheetDocumentId: evaluationSheetId ? Number(evaluationSheetId) : undefined,
           modelAnswerDocumentId: evaluationModelId ? Number(evaluationModelId) : undefined,
        },
      },
      { onSuccess: (evaluation) => setResult(evaluation) },
    );
  };

  const reset = () => {
    evaluate.reset();
    setResult(null);
    setFile(null);
    setFileError('');
    setExpandedQuestion(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="desk-app min-h-[100dvh]">
      <aside className="desk-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><ClipboardCheck size={21} strokeWidth={2.2} /></div>
          <div>
            <div className="brand-name">AI Examiner</div>
             <div className="brand-caption">Assessment desk</div>
           </div>
         </div>
        <div className="sidebar-rule" />
        <div className="sidebar-section-label">Workspace</div>
        <div className="sidebar-item sidebar-item-active">
          <Target size={17} />
          <span>New evaluation</span>
          <span className="sidebar-dot" />
        </div>
        <div className="sidebar-item sidebar-item-muted">
          <BookOpen size={17} />
          <span>Evaluation history</span>
          <span className="coming-soon">Soon</span>
        </div>
        <div className="sidebar-bottom">
          <div className="trust-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Designed for review</strong>
              <p>Every score includes evidence you can inspect.</p>
            </div>
          </div>
          <div className="sidebar-foot"><LockKeyhole size={13} /> Your documents stay private</div>
        </div>
      </aside>

      <main className="desk-main">
        <header className="topbar">
          <button className="mobile-menu" type="button" data-testid="button-mobile-menu" aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronDown size={13} /><strong>{result ? 'Evaluation result' : 'New evaluation'}</strong></div>
          <div className="topbar-meta"><span className="status-pip" /> Ready to assess</div>
        </header>

        <div className="workspace-content">
          {!result && !isPending && (
            <div className="intro-row reveal-up">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> INTAKE &amp; REVIEW</div>
                <h1>Bring a response.<br /><em>Get a clearer read.</em></h1>
                <p className="intro-copy">Upload an answer sheet and give AI Examiner the context it needs to return a score you can stand behind.</p>
              </div>
              <div className="intro-note">
                <span className="note-number">01</span>
                <p>Start with a PDF.<br />We'll take it from there.</p>
              </div>
            </div>
          )}

          {isPending && <LoadingState fileName={file?.name} />}

          {evaluate.isError && !isPending && (
            <div className="error-panel reveal-up" data-testid="status-evaluation-error">
              <div className="error-icon"><AlertCircle size={21} /></div>
              <div><strong>We couldn't complete this evaluation</strong><p>{getErrorMessage(evaluate.error)}</p></div>
              <button type="button" className="ghost-button error-retry" onClick={() => evaluate.reset()} data-testid="button-retry-evaluation"><RotateCcw size={15} /> Try again</button>
            </div>
          )}

          {!isPending && !result && (
            <form onSubmit={submit} className="intake-layout reveal-up" data-testid="form-evaluation">
              <section className="paper-card upload-card">
                <div className="section-kicker"><span>01</span> Answer sheet</div>
                <div
                  className={`drop-zone ${file ? 'drop-zone-filled' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }}
                  data-testid="dropzone-answer-sheet"
                >
                  <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(event) => selectFile(event.target.files?.[0])} hidden data-testid="input-answer-sheet" />
                  {file ? (
                    <div className="file-selected">
                      <div className="pdf-icon"><FileText size={23} /></div>
                      <div className="file-details"><strong data-testid="text-uploaded-filename">{file.name}</strong><span>{formatBytes(file.size)} · PDF ready for review</span></div>
                      <button type="button" className="remove-file" onClick={(event) => { event.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} data-testid="button-remove-file" aria-label="Remove uploaded file"><X size={17} /></button>
                    </div>
                  ) : (
                    <div className="upload-prompt">
                      <div className="upload-icon"><CloudUpload size={24} /></div>
                      <strong>Drop the answer sheet here</strong>
                      <span>or <u>choose a PDF</u> from your computer</span>
                      <small>Maximum file size: 20 MB</small>
                    </div>
                  )}
                </div>
                {fileError && <div className="form-alert" data-testid="status-form-error"><AlertCircle size={15} /> {fileError}</div>}
              </section>

              <section className="paper-card context-card">
                <div className="section-kicker"><span>02</span> Exam details</div>
                <div className="form-grid">
                  <label className="field field-wide"><span>Exam title <b>*</b></span><input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="e.g. Midterm · Cell Biology" data-testid="input-exam-title" /></label>
                  <label className="field"><span>Subject <small>Optional</small></span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Biology" data-testid="input-subject" /></label>
                  <label className="field"><span>Maximum score <b>*</b></span><div className="score-input"><input type="number" min="1" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} data-testid="input-max-score" /><span>points</span></div></label>
                </div>
                 {teacherContext && <div className="mt-5 grid gap-3 rounded-xl border border-[#e7dfce] bg-[#fbf7ed] p-4 sm:grid-cols-2">
                   <label className="field"><span>Student answer sheet <b>*</b></span><select className="portal-input" value={evaluationSheetId} onChange={(event) => {
                     const sheet = teacherContext.sheets.find((candidate) => String(candidate.id) === event.target.value);
                     setEvaluationSheetId(event.target.value);
                     setEvaluationSubjectId(sheet ? String(sheet.subject.id) : '');
                     const modelAnswer = sheet
                       ? teacherContext.documents
                           .filter((document) => document.subjectId === sheet.subject.id)
                           .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0]
                       : undefined;
                     setEvaluationModelId(modelAnswer ? String(modelAnswer.id) : '');
                   }}><option value="">Choose an approved scan</option>{teacherContext.sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.student.fullName} · {sheet.subject.code} · {sheet.fileName}</option>)}</select></label>
                   <label className="field"><span>Model answer <small>Auto-selected for the subject</small></span><select className="portal-input" value={evaluationModelId} onChange={(event) => setEvaluationModelId(event.target.value)}><option value="">Use pasted key or infer</option>{teacherContext.documents.filter((document) => document.subjectId === Number(evaluationSubjectId)).map((document) => <option key={document.id} value={document.id}>{document.fileName}</option>)}</select></label>
                 </div>}
                <button type="button" className={`context-toggle ${contextOpen ? 'context-toggle-open' : ''}`} onClick={() => setContextOpen(!contextOpen)} data-testid="button-toggle-context"><span><Sparkles size={16} /> Add answer key or rubric <small>Optional, but improves feedback</small></span><ChevronDown size={17} /></button>
                {contextOpen && <div className="context-fields reveal-up">
                  <label className="field"><span>Answer key <small>Paste text or marking notes</small></span><textarea value={answerKey} onChange={(event) => setAnswerKey(event.target.value)} placeholder="1. Mitochondria&#10;2. Osmosis is the movement of water..." rows={4} data-testid="textarea-answer-key" /></label>
                  <label className="field"><span>Rubric context <small>What should a strong answer demonstrate?</small></span><textarea value={rubric} onChange={(event) => setRubric(event.target.value)} placeholder="Award full credit for accurate terminology and clear reasoning..." rows={4} data-testid="textarea-rubric" /></label>
                </div>}
              </section>

              <div className="submit-row">
                <div className="privacy-note"><LockKeyhole size={14} /><span>Private by design.<br /><b>Your PDF is used only for this evaluation.</b></span></div>
                <button className="primary-button" type="submit" disabled={!hasForm} data-testid="button-evaluate"><span>Evaluate answer sheet</span><ArrowRight size={17} /></button>
              </div>
            </form>
          )}

          {result && !isPending && <ResultView result={result} expandedQuestion={expandedQuestion} setExpandedQuestion={setExpandedQuestion} onReset={reset} />}
        </div>
      </main>
    </div>
  );
}

function ManualEvaluatorPage() {
  const [, setLocation] = useLocation();
  const [sheets, setSheets] = useState<TeacherSheet[]>([]);
  const [sheetId, setSheetId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [finalScore, setFinalScore] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    portalApi.teacherStudentSheets()
      .then(setSheets)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load answer sheets.'));
  }, []);

  const selectedSheet = sheets.find((sheet) => String(sheet.id) === sheetId);
  const score = Number(finalScore);
  const maximum = Number(maxScore);
  const canSubmit = Boolean(
    selectedSheet &&
      examTitle.trim() &&
      summary.trim() &&
      Number.isInteger(maximum) &&
      maximum > 0 &&
      Number.isInteger(score) &&
      score >= 0 &&
      score <= maximum,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedSheet || !canSubmit) return;
    setSaving(true);
    setError('');
    try {
      await portalApi.createManualEvaluation({
        subjectId: selectedSheet.subject.id,
        studentId: selectedSheet.student.id,
        answerSheetDocumentId: selectedSheet.id,
        examTitle: examTitle.trim(),
        maxScore: maximum,
        finalScore: score,
        summary: summary.trim(),
      });
      setStatus('Manual evaluation saved and finalized for the student.');
      setSheetId('');
      setExamTitle('');
      setFinalScore('');
      setSummary('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the manual evaluation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="desk-app min-h-[100dvh]">
      <aside className="desk-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><ClipboardCheck size={21} strokeWidth={2.2} /></div>
          <div><div className="brand-name">AI Examiner</div><div className="brand-caption">Assessment desk</div></div>
        </div>
        <div className="sidebar-rule" />
        <div className="sidebar-section-label">Workspace</div>
        <button className="sidebar-item" type="button" onClick={() => setLocation('/evaluate')}><Sparkles size={17} /><span>AI evaluation</span></button>
        <div className="sidebar-item sidebar-item-active"><ClipboardCheck size={17} /><span>Manual evaluation</span><span className="sidebar-dot" /></div>
        <div className="sidebar-bottom"><div className="trust-card"><ShieldCheck size={18} /><div><strong>Teacher approval stays central</strong><p>Enter the mark and feedback you want the student to receive.</p></div></div><div className="sidebar-foot"><LockKeyhole size={13} /> Your documents stay private</div></div>
      </aside>
      <main className="desk-main">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronDown size={13} /><strong>Manual evaluation</strong></div><div className="topbar-meta"><span className="status-pip" /> Teacher review</div></header>
        <div className="workspace-content">
          <div className="intro-row reveal-up"><div><div className="eyebrow"><span className="eyebrow-line" /> TEACHER REVIEW</div><h1>Set the mark.<br /><em>Keep the context.</em></h1><p className="intro-copy">Choose an uploaded student answer sheet and record the final score and feedback directly, without using AI.</p></div><div className="intro-note"><span className="note-number">02</span><p>Human judgment<br />stays in control.</p></div></div>
          {status && <div className="portal-status" data-testid="status-manual-evaluation">{status}</div>}
          {error && <div className="error-panel reveal-up" data-testid="status-manual-evaluation-error"><div className="error-icon"><AlertCircle size={21} /></div><div><strong>Manual evaluation unavailable</strong><p>{error}</p></div></div>}
          <form onSubmit={submit} className="intake-layout reveal-up" data-testid="form-manual-evaluation">
            <section className="paper-card context-card">
              <div className="section-kicker"><span>01</span> Student work</div>
              <div className="form-grid">
                <label className="field field-wide"><span>Student answer sheet <b>*</b></span><select className="portal-input" value={sheetId} onChange={(event) => setSheetId(event.target.value)} data-testid="select-manual-answer-sheet"><option value="">Choose an approved scan</option>{sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.student.fullName} · {sheet.subject.code} · {sheet.fileName}</option>)}</select></label>
                <label className="field field-wide"><span>Exam title <b>*</b></span><input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="e.g. Midterm · Cell Biology" data-testid="input-manual-exam-title" /></label>
                <label className="field"><span>Subject</span><input value={selectedSheet?.subject.name || ''} readOnly placeholder="Selected from answer sheet" data-testid="input-manual-subject" /></label>
                <label className="field"><span>Maximum score <b>*</b></span><input type="number" min="1" step="1" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} data-testid="input-manual-max-score" /></label>
              </div>
            </section>
            <section className="paper-card context-card">
              <div className="section-kicker"><span>02</span> Teacher decision</div>
              <div className="form-grid">
                <label className="field field-wide"><span>Final score <b>*</b></span><div className="score-input"><input type="number" min="0" max={maximum || undefined} step="1" value={finalScore} onChange={(event) => setFinalScore(event.target.value)} placeholder="0" data-testid="input-manual-final-score" /><span>out of {maximum || '—'}</span></div></label>
                <label className="field field-wide"><span>Feedback for the student <b>*</b></span><textarea rows={7} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Explain what the student did well and what they should revisit." data-testid="textarea-manual-feedback" /></label>
              </div>
            </section>
            <div className="submit-row"><div className="privacy-note"><LockKeyhole size={14} /><span>Saved as a finalized result.<br /><b>The student will see it immediately.</b></span></div><button className="primary-button" type="submit" disabled={!canSubmit || saving} data-testid="button-save-manual-evaluation"><span>{saving ? 'Saving evaluation…' : 'Save manual evaluation'}</span><Check size={17} /></button></div>
          </form>
        </div>
      </main>
    </div>
  );
}

function LoadingState({ fileName }: { fileName?: string }) {
  return <div className="loading-state reveal-up" data-testid="status-evaluation-loading">
    <div className="loading-visual"><div className="loading-ring"><LoaderCircle size={31} /></div><div className="loading-orbit orbit-one" /><div className="loading-orbit orbit-two" /></div>
    <div className="eyebrow"><span className="eyebrow-line" /> EVALUATING</div>
    <h1>Reading the response<br /><em>with care.</em></h1>
    <p>Examining <strong>{fileName || 'your answer sheet'}</strong>, comparing responses against the provided context, and assembling evidence for each score.</p>
    <div className="progress-track"><div className="progress-fill" /></div>
    <div className="loading-steps"><span className="step-done"><Check size={13} /> Document received</span><span className="step-active"><span /> Reviewing answers</span><span>Building feedback</span></div>
  </div>;
}

function ResultView({ result, expandedQuestion, setExpandedQuestion, onReset }: { result: EvaluationResult; expandedQuestion: number | null; setExpandedQuestion: (value: number | null) => void; onReset: () => void }) {
  const scoreColor = result.percentage >= 70 ? 'score-positive' : result.percentage >= 50 ? 'score-mid' : 'score-low';
  const confidence = Math.round(result.confidence <= 1 ? result.confidence * 100 : result.confidence);
  return <div className="result-shell reveal-up" data-testid="section-evaluation-result">
    <div className="result-heading">
      <div><div className="eyebrow"><span className="eyebrow-line" /> EVALUATION COMPLETE</div><h1>{result.examTitle}</h1><p className="result-subtitle">A transparent read of this answer sheet, ready for your review.</p></div>
      <button className="secondary-button" type="button" onClick={onReset} data-testid="button-new-evaluation"><RotateCcw size={15} /> New evaluation</button>
    </div>
    <div className="result-overview">
      <div className={`score-hero ${scoreColor}`}><div className="score-label">Overall score</div><div className="score-number" data-testid="text-overall-score">{trimNumber(result.overallScore)}<span>/{trimNumber(result.maxScore)}</span></div><div className="score-grade"><span>{result.grade}</span><b>{trimNumber(result.percentage)}%</b></div></div>
      <div className="summary-block"><div className="section-kicker">Assessment summary</div><p data-testid="text-evaluation-summary">{result.summary}</p><div className="confidence-line"><span>Evaluation confidence</span><strong data-testid="text-evaluation-confidence">{confidence}%</strong><div className="confidence-track"><i style={{ width: `${Math.min(100, confidence)}%` }} /></div></div></div>
      <div className="result-stat"><CheckCircle2 size={20} /><span>Strengths found</span><strong>{result.strengths.length}</strong></div>
      <div className="result-stat result-stat-warm"><Target size={20} /><span>Focus areas</span><strong>{result.improvements.length}</strong></div>
    </div>
    <div className="result-columns">
      <div className="questions-panel"><div className="panel-header"><div><div className="section-kicker">Question breakdown</div><h2>Where the marks went</h2></div><span className="question-count">{result.questions.length} questions</span></div>
        <div className="question-list">{result.questions.map((question, index) => <QuestionRow key={`${question.question}-${index}`} question={question} index={index} expanded={expandedQuestion === index} onToggle={() => setExpandedQuestion(expandedQuestion === index ? null : index)} />)}</div>
      </div>
      <div className="insights-column">
        <InsightCard title="What went well" icon={<CheckCircle2 size={17} />} items={result.strengths} tone="positive" testId="card-strengths" />
        <InsightCard title="Worth revisiting" icon={<Target size={17} />} items={result.improvements} tone="warm" testId="card-improvements" />
        {result.integrityNotes.length > 0 && <InsightCard title="Review notes" icon={<Info size={17} />} items={result.integrityNotes} tone="neutral" testId="card-integrity-notes" />}
      </div>
    </div>
  </div>;
}

function QuestionRow({ question, index, expanded, onToggle }: { question: QuestionEvaluation; index: number; expanded: boolean; onToggle: () => void }) {
  const verdictLabels: Record<string, string> = { correct: 'Correct', partial: 'Partial', incorrect: 'Incorrect', unanswered: 'Unanswered', unclear: 'Unclear' };
  return <div className={`question-row ${expanded ? 'question-expanded' : ''}`} data-testid={`row-question-${index + 1}`}>
    <button type="button" className="question-summary" onClick={onToggle} data-testid={`button-expand-question-${index + 1}`}>
      <span className={`verdict-icon verdict-${question.verdict}`}>{question.verdict === 'correct' ? <Check size={15} /> : question.verdict === 'incorrect' ? <X size={15} /> : <span>·</span>}</span>
      <span className="question-copy"><strong>{question.question}</strong><small className={`verdict-label verdict-text-${question.verdict}`}>{verdictLabels[question.verdict]}</small></span>
      <span className="question-score">{trimNumber(question.score)}<small>/{trimNumber(question.maxScore)}</small></span><ChevronDown size={17} className="question-chevron" />
    </button>
    {expanded && <div className="question-detail reveal-up"><div><span>Your evidence</span><p>{question.evidence || 'No written evidence was returned for this response.'}</p></div><div><span>Expected answer</span><p>{question.expectedAnswer || 'No expected answer was provided.'}</p></div><div className="feedback-note"><Sparkles size={15} /><p>{question.feedback}</p></div></div>}
  </div>;
}

function InsightCard({ title, icon, items, tone, testId }: { title: string; icon: ReactNode; items: string[]; tone: string; testId: string }) {
  return <div className={`insight-card insight-${tone}`} data-testid={testId}><div className="insight-title">{icon}<h3>{title}</h3></div>{items.length ? <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="empty-insight">No notes were identified.</p>}</div>;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadBase64File(file: { fileName: string; contentType: string; base64: string }) {
  const binary = window.atob(file.base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function trimNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'error' in error) return String((error as { error: unknown }).error);
  return 'Please check the PDF and your context, then try submitting again.';
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL || undefined;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#0f766e',
    colorForeground: '#183c3b',
    colorMutedForeground: '#5e7772',
    colorDanger: '#b42318',
    colorBackground: '#fffdf7',
    colorInput: '#f7f4ed',
    colorInputForeground: '#183c3b',
    colorNeutral: '#d5e1dc',
    fontFamily: 'DM Sans',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#183c3b]',
    headerSubtitle: 'text-[#5e7772]',
    socialButtonsBlockButtonText: 'text-[#183c3b]',
    formFieldLabel: 'text-[#183c3b]',
    footerActionLink: 'text-[#0f766e]',
    footerActionText: 'text-[#5e7772]',
    dividerText: 'text-[#5e7772]',
    cardBox: 'bg-[#fffdf7] rounded-2xl w-[440px] max-w-full overflow-hidden',
    logoBox: 'h-12',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#d5e1dc] bg-white',
    formButtonPrimary: 'bg-[#0f766e] hover:bg-[#0b5f59]',
    formFieldInput: 'border-[#d5e1dc] bg-[#f7f4ed] text-[#183c3b]',
    footerAction: 'text-[#5e7772]',
    dividerLine: 'bg-[#d5e1dc]',
    alert: 'border-[#f3c7bd] bg-[#fff4f1]',
    alertText: 'text-[#8f2d22]',
    otpCodeFieldInput: 'border-[#d5e1dc]',
    formFieldRow: 'gap-1',
    main: 'bg-[#fffdf7]',
  },
};

function PublicHome() {
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = (path: string) => {
    setMenuOpen(false);
    setLocation(path);
  };
  return (
    <main className="college-site">
      <div className="college-topline">
        <div className="college-container college-topline-inner">
          <span>AI EXAMINER · ACADEMIC ASSESSMENT DESK</span>
          <div className="college-contact"><span><Mail size={13} /> academic-support@ai-examiner.app</span><span><MapPin size={13} /> Built for modern classrooms</span></div>
        </div>
      </div>
      <header className="college-header college-container">
        <a className="college-brand" href="#home" aria-label="AI Examiner home">
          <span className="college-seal">AI</span>
          <span><strong>AI EXAMINER<br /><b>ACADEMIC INTELLIGENCE</b></strong><small>Evidence-first assessment workflow</small></span>
        </a>
        <div className="college-header-actions">
          <span className="college-phone">For academic teams<br /><strong>Start a secure workspace</strong></span>
          <button className="college-gold-button" onClick={() => navigate('/sign-up')}>Create workspace <ArrowRight size={15} /></button>
        </div>
        <button className="college-menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}><Menu size={22} /></button>
      </header>
      <nav className={`college-nav ${menuOpen ? 'college-nav-open' : ''}`} aria-label="Main navigation">
        <div className="college-container college-nav-inner">
          <a href="#home" onClick={() => setMenuOpen(false)}>Home</a><a href="#about" onClick={() => setMenuOpen(false)}>About platform</a><a href="#programmes" onClick={() => setMenuOpen(false)}>Workflows</a><a href="#campus" onClick={() => setMenuOpen(false)}>Faculty tools</a><a href="#admissions" onClick={() => setMenuOpen(false)}>Get started</a><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
          <button className="college-nav-login" onClick={() => navigate('/sign-in')}>Staff / student login <ArrowRight size={14} /></button>
        </div>
      </nav>
      <section id="home" className="college-hero">
        <div className="college-hero-image" />
        <div className="college-hero-overlay" />
        <div className="college-container college-hero-content">
          <div className="college-hero-copy reveal-college">
            <span className="college-eyebrow">Measure · Review · Improve</span>
            <h1>Better assessment<br /><em>builds better outcomes.</em></h1>
            <p>AI Examiner gives engineering educators a clear, structured way to evaluate work, review evidence, and give students feedback they can use.</p>
            <div className="college-hero-actions"><button className="college-gold-button college-button-large" onClick={() => navigate('/sign-up')}>Build your workspace <ArrowRight size={17} /></button><a className="college-outline-button" href="#programmes">See the workflow</a></div>
          </div>
          <div className="college-hero-note reveal-college delay-2"><span>01</span><p>Evidence-led<br />decisions</p></div>
        </div>
      </section>
      <div className="college-accreditation"><div className="college-container college-accreditation-inner"><strong>AI</strong><span>Assisted review</span><i /> <strong>PDF</strong><span>Structured document workflow</span><i /><strong>100%</strong><span>Human approval stays in control</span></div></div>
      <section id="about" className="college-section college-container college-intro">
        <div className="college-section-label"><span>01</span><p>The platform</p></div>
        <div><span className="college-overline">A clearer way to review learning</span><h2>Where assessment becomes <em>insight.</em></h2><p className="college-lead">AI Examiner brings answer sheets, marking context, transparent evidence, and final feedback into one calm workspace for engineering and academic teams.</p><button className="college-text-link" onClick={() => navigate('/sign-up')}>Explore the workspace <ArrowRight size={15} /></button></div>
        <div className="college-stat-grid"><div><strong>01</strong><span>Secure workspace</span></div><div><strong>02</strong><span>AI-assisted review</span></div><div><strong>03</strong><span>Human approval</span></div><div><strong>∞</strong><span>Learning context</span></div></div>
      </section>
      <section id="programmes" className="college-programmes">
          <div className="college-container"><div className="college-section-heading"><div><span className="college-overline">02 · Academic operations</span><h2>One workflow.<br /><em>Every mark clearer.</em></h2></div><p>Purpose-built tools for the people who set standards, review work, and help students move forward.</p></div>
          <div className="college-programme-grid"><article><span className="college-programme-number">01</span><GraduationCap size={28} /><h3>Faculty<br />workspace</h3><p>Upload answer sheets, add marking context, and keep every evaluation in one place.</p><a href="#admissions">Explore faculty tools <ArrowRight size={14} /></a></article><article><span className="college-programme-number">02</span><BookOpen size={28} /><h3>Evidence-led<br />review</h3><p>Use AI assistance to surface question-level evidence without losing teacher judgment.</p><a href="#admissions">See the review flow <ArrowRight size={14} /></a></article><article><span className="college-programme-number">03</span><Sparkles size={28} /><h3>Student<br />feedback</h3><p>Turn finalized marks into useful feedback students can read, understand, and act on.</p><a href="#contact">See the student view <ArrowRight size={14} /></a></article></div>
        </div>
      </section>
      <section id="campus" className="college-container college-campus"><div className="college-campus-copy"><span className="college-overline">03 · The review culture</span><h2>More than a score.<br /><em>A useful conversation.</em></h2><p>Good assessment gives people a next step. AI Examiner helps teams move from a scanned page to an informed, teachable response.</p><div className="college-campus-points"><span><CheckCircle2 size={16} /> Transparent evidence</span><span><CheckCircle2 size={16} /> Human-in-the-loop</span><span><CheckCircle2 size={16} /> Private documents</span></div></div><div className="college-campus-card"><div><span>Assessment perspective</span><strong>Clarity lives<br />in context.</strong></div><span className="college-card-arrow"><ArrowRight size={21} /></span></div></section>
      <section id="admissions" className="college-cta"><div className="college-container college-cta-inner"><div><span className="college-eyebrow">Start with your team</span><h2>Make every mark<br /><em>more defensible.</em></h2></div><div><p>Bring your faculty, answer sheets, and review standards into one focused academic workspace.</p><button className="college-gold-button college-button-large" onClick={() => navigate('/sign-up')}>Create a workspace <ArrowRight size={17} /></button></div></div></section>
      <footer id="contact" className="college-footer"><div className="college-container college-footer-grid"><div className="college-brand college-brand-footer"><span className="college-seal">AI</span><span><strong>AI EXAMINER<br /><b>ACADEMIC INTELLIGENCE</b></strong><small>Evidence-first assessment</small></span></div><div><span className="college-footer-label">Explore</span><a href="#about">About platform</a><a href="#programmes">Workflows</a><a href="#campus">Faculty tools</a></div><div><span className="college-footer-label">Connect</span><a href="mailto:academic-support@ai-examiner.app">academic-support@ai-examiner.app</a><a href="#admissions">Create a workspace</a><span>Built for modern classrooms</span></div><div><span className="college-footer-label">Assessment desk</span><p>AI Examiner gives staff a secure place to review, finalize, and explain student assessments.</p><button className="college-footer-link" onClick={() => navigate('/sign-in')}>Open staff login <ArrowRight size={14} /></button></div></div><div className="college-container college-footer-bottom"><span>© 2026 AI Examiner</span><span>Clearer assessment for better learning.</span></div></footer>
    </main>
  );
}

function Brand() {
  return <div className="portal-brand"><div className="portal-brand-mark"><ClipboardCheck size={19} /></div><div><div className="portal-brand-name">AI Examiner</div><div className="portal-brand-caption">Evidence desk</div></div></div>;
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-[#dce6df] bg-[#fffdf7] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e0f1e8] text-[#0f766e]">{icon}</div><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#66817a]">{text}</p></div>;
}

function RoleChooser({ me, onSaved }: { me: MeResponse; onSaved: () => void }) {
  const { user } = useUser();
  const [role, setRole] = useState<Role>(me.canClaimAdmin ? 'admin' : 'teacher');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true); setError('');
    try {
      await portalApi.setRole(role, { displayName: user?.fullName || undefined, email: user?.primaryEmailAddress?.emailAddress || undefined });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your role.'); } finally { setBusy(false); }
  };
  return <div className="role-setup"><div className="role-setup-inner"><Brand /><div className="role-setup-grid"><div className="role-setup-copy"><div className="portal-eyebrow"><span /> ACCOUNT SETUP</div><h1>Choose the work you do here.</h1><p>This sets the workspace and permissions for your account. The first account can claim the administrator seat.</p><div className="setup-note"><ShieldCheck size={17} /><span><strong>Permission-led by design.</strong><br />Your role controls what can be viewed, changed, and finalized.</span></div></div><div className="role-chooser-card"><div className="portal-card-kicker">01 / Your workspace</div><div className="role-options">{(['admin', 'teacher', 'student'] as Role[]).map((candidate) => <button key={candidate} disabled={candidate === 'admin' && !me.canClaimAdmin} onClick={() => setRole(candidate)} className={`role-option ${role === candidate ? 'role-option-selected' : ''}`} data-testid={`button-role-${candidate}`}><span className="role-option-icon">{candidate === 'admin' ? <Settings2 size={18} /> : candidate === 'teacher' ? <GraduationCap size={18} /> : <UserRound size={18} />}</span><span><strong>{candidate}</strong><small>{candidate === 'admin' ? 'Manage subjects, students, approvals, and uploads.' : candidate === 'teacher' ? 'Review work with AI-assisted evidence.' : 'Read finalized marks and feedback.'}</small></span><span className="role-option-radio" /></button>)}</div>{error && <div className="portal-error" data-testid="status-role-error"><AlertCircle size={15} /> {error}</div>}<button className="portal-primary role-submit" disabled={busy} onClick={save} data-testid="button-save-role">{busy ? 'Saving role…' : 'Continue to workspace'} <ArrowRight size={15} /></button></div></div></div></div>;
}

function PortalPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState('');
  const load = () => portalApi.me().then(setMe).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load your profile.'));
  useEffect(() => { load(); }, []);
  if (error) return <div className="portal-state-screen"><div className="portal-state-card portal-state-error"><AlertCircle size={22} /><div><strong>Workspace unavailable</strong><p>{error}</p><button className="portal-secondary" onClick={() => { setError(''); load(); }} data-testid="button-retry-profile"><RefreshCw size={14} /> Try again</button></div></div></div>;
  if (!me) return <div className="portal-state-screen"><div className="portal-loading-card"><div className="portal-skeleton portal-skeleton-logo" /><div className="portal-skeleton portal-skeleton-line" /><div className="portal-skeleton portal-skeleton-block" /><span>Loading your workspace</span></div></div>;
  if (!me.profile?.role) return <RoleChooser me={me} onSaved={load} />;
  return <PortalShell profile={me.profile}><RoleWorkspace role={me.profile.role} /></PortalShell>;
}

function PortalShell({ profile, children }: { profile: NonNullable<MeResponse['profile']>; children: ReactNode }) {
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isEvaluator = currentPath.endsWith('/evaluate');
  const isManualEvaluator = currentPath.endsWith('/evaluate/manual');
  const roleLabel = profile.role === 'admin' ? 'Operations' : profile.role === 'teacher' ? 'Faculty' : profile.role === 'hod' ? 'HOD' : 'Student';
  return <div className="portal-shell"><header className="portal-topbar"><div className="portal-topbar-inner"><button className="portal-mobile-menu" type="button" onClick={() => document.body.classList.toggle('portal-nav-open')} aria-label="Toggle workspace navigation" data-testid="button-toggle-portal-nav"><Menu size={20} /></button><Brand /><div className="portal-user"><div className="portal-user-avatar">{profile.displayName.slice(0, 1).toUpperCase()}</div><div className="portal-user-copy"><strong data-testid="text-profile-name">{profile.displayName}</strong><span>{roleLabel} workspace</span></div><button className="portal-signout" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={15} /><span>Sign out</span></button></div></div></header><div className="portal-layout"><aside className="portal-sidebar"><div className="portal-side-label">Workspace / {roleLabel}</div><nav className="portal-nav" aria-label="Workspace navigation"><button className={`portal-nav-item ${!isEvaluator && !isManualEvaluator ? 'portal-nav-active' : ''}`} onClick={() => setLocation('/portal')} data-testid="link-portal-overview"><ClipboardCheck size={17} /><span>Overview</span><ArrowRight size={14} /></button>{profile.role !== 'student' && <button className={`portal-nav-item ${isEvaluator ? 'portal-nav-active' : ''}`} onClick={() => setLocation('/evaluate')} data-testid="link-ai-evaluation"><Sparkles size={17} /><span>AI evaluation</span><ArrowRight size={14} /></button>}{profile.role === 'teacher' && <button className={`portal-nav-item ${isManualEvaluator ? 'portal-nav-active' : ''}`} onClick={() => setLocation('/evaluate/manual')} data-testid="link-manual-evaluation"><ClipboardCheck size={17} /><span>Manual evaluation</span><ArrowRight size={14} /></button>}</nav><div className="portal-side-divider" /><div className="portal-side-context"><div className="portal-side-label">Working principles</div><div className="principle"><ShieldCheck size={16} /><span>Human approval stays in control.</span></div><div className="principle"><FileCheck2 size={16} /><span>Every outcome keeps its evidence.</span></div></div><div className="portal-sidebar-footer"><span className="portal-live-dot" /> System connected</div></aside><main className="portal-main">{children}</main></div></div>;
}

function RoleWorkspace({ role }: { role: Role }) {
  if (role === 'admin') return <AdminWorkspace />;
  if (role === 'teacher') return <TeacherWorkspace />;
  if (role === 'hod') return <HodWorkspace />;
  return <StudentWorkspace />;
}

function AdminWorkspace() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [registrations, setRegistrations] = useState<Array<{ id: number; teacherClerkUserId: string; status: string; subject: Pick<Subject, 'id' | 'name' | 'code'> }>>([]);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [admission, setAdmission] = useState('');
  const [email, setEmail] = useState('');
  const [studentBranch, setStudentBranch] = useState<Branch>('Computer Science');
  const [studentSemester, setStudentSemester] = useState(1);
  const [studentFilterBranch, setStudentFilterBranch] = useState<Branch | 'all'>('all');
  const [studentFilterSemester, setStudentFilterSemester] = useState<number | 'all'>('all');
  const [manualCredential, setManualCredential] = useState<{ password: string; fullName: string; email: string } | null>(null);
  const [hodName, setHodName] = useState('');
  const [hodEmail, setHodEmail] = useState('');
  const [hodBranch, setHodBranch] = useState<Branch>('Computer Science');
  const [hodCredential, setHodCredential] = useState<{ fullName: string; email: string; branch: Branch; password: string } | null>(null);
  const [studentId, setStudentId] = useState('');
  const [scanSubjectId, setScanSubjectId] = useState('');
  const [scan, setScan] = useState<File | null>(null);
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [credentialResult, setCredentialResult] = useState<StudentImportResult | null>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async () => {
    const [s, st, r] = await Promise.all([portalApi.adminSubjects(), portalApi.adminStudents(), portalApi.adminRegistrations()]);
    setSubjects(s); setStudents(st); setRegistrations(r);
  };
  useEffect(() => { load().catch((err) => setStatus(err.message)).finally(() => setLoading(false)); }, []);
  const addSubject = async (event: FormEvent) => {
    event.preventDefault();
    try { await portalApi.addSubject({ name: subjectName, code: subjectCode }); setSubjectName(''); setSubjectCode(''); setStatus('Subject created.'); await load(); }
    catch (err) { setStatus(err instanceof Error ? err.message : 'Could not create subject.'); }
  };
  const addStudent = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await portalApi.addStudent({ fullName: studentName, admissionNumber: admission, email, branch: studentBranch, semester: studentSemester });
      setManualCredential({ password: result.credential.Password, fullName: result.credential['Full name'], email: result.credential.Email });
      setStudentName(''); setAdmission(''); setEmail('');
      setStatus('Student account created. Save the generated password before leaving this page.');
      await load();
    }
    catch (err) { setStatus(err instanceof Error ? err.message : 'Could not add student.'); }
  };
  const addHod = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await portalApi.addHod({ fullName: hodName, email: hodEmail, branch: hodBranch });
      setHodCredential(result.credential);
      setHodName(''); setHodEmail('');
      setStatus('HOD login created. Save the generated password before leaving this page.');
    } catch (err) { setStatus(err instanceof Error ? err.message : 'Could not create the HOD login.'); }
  };
  const uploadScan = async (event: FormEvent) => {
    event.preventDefault();
    if (!scan || !studentId || !scanSubjectId) return setStatus('Choose a subject, student, and PDF first.');
    try { await portalApi.uploadDocument(scan, { kind: 'student_answer', subjectId: Number(scanSubjectId), studentId: Number(studentId) }); setScan(null); setStatus('Scanned answer sheet uploaded.'); }
    catch (err) { setStatus(err instanceof Error ? err.message : 'Upload failed.'); }
  };
  const importRoster = async (event: FormEvent) => {
    event.preventDefault();
    if (!rosterFile) return setStatus('Choose an Excel or CSV roster first.');
    setImporting(true);
    setCredentialResult(null);
    setStatus('');
    try {
      const result = await portalApi.importStudents({
        fileName: rosterFile.name,
        fileBase64: await fileToBase64(rosterFile),
      });
      setCredentialResult(result);
      setRosterFile(null);
      setStatus(
        result.errors.length
          ? `${result.imported.length} student accounts created. ${result.errors.length} row(s) need attention.`
          : `${result.imported.length} student accounts created. Download the credentials before leaving this page.`,
      );
      await load();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not import the student roster.');
    } finally {
      setImporting(false);
    }
  };
  return <WorkspaceIntro eyebrow="ADMIN CONSOLE" title="Keep the assessment desk in order." text="Create the people and subjects that make every later evaluation traceable." status={status} loading={loading}>
    <div className="workspace-metrics"><div><span>Subjects</span><strong>{subjects.length}</strong><small>active records</small></div><div><span>Students</span><strong>{students.length}</strong><small>in your system</small></div><div><span>Access requests</span><strong>{registrations.filter((item) => item.status === 'pending').length}</strong><small>need a decision</small></div></div>
    <div className="portal-grid portal-grid-admin">
      <Panel title="Subjects" eyebrow="CATALOGUE" icon={<BookOpen size={18} />}><form onSubmit={addSubject} className="portal-form-row"><input className="portal-input" placeholder="Subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} data-testid="input-subject-name" /><input className="portal-input portal-code-input" placeholder="Code" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} data-testid="input-subject-code" /><button className="portal-primary" data-testid="button-add-subject"><Plus size={15} /> Add</button></form><div className="portal-list">{subjects.map((subject) => <div className="portal-list-row" key={subject.id} data-testid={`row-subject-${subject.id}`}><span className="list-leading-icon"><BookOpen size={15} /></span><span className="list-main"><strong>{subject.name}</strong><small>{subject.description || 'No description added'}</small></span><span className="code-tag">{subject.code}</span></div>)}{!subjects.length && <Empty text="No subjects yet. Add the first assessment subject above." />}</div></Panel>
       <Panel title="Students" eyebrow="MANUAL REGISTRATION" icon={<UsersRound size={18} />}><form onSubmit={addStudent} className="portal-form-grid"><input className="portal-input" placeholder="Full name" value={studentName} onChange={(e) => setStudentName(e.target.value)} data-testid="input-student-name" /><input className="portal-input" placeholder="USN / admission number" value={admission} onChange={(e) => setAdmission(e.target.value)} data-testid="input-admission-number" /><input className="portal-input portal-span-2" placeholder="Student email (required for login)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-student-email" /><select className="portal-input" value={studentBranch} onChange={(e) => setStudentBranch(e.target.value as Branch)} data-testid="select-student-branch">{branches.map((branch) => <option key={branch}>{branch}</option>)}</select><select className="portal-input" value={studentSemester} onChange={(e) => setStudentSemester(Number(e.target.value))} data-testid="select-student-semester">{semesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}</select><button className="portal-primary portal-span-2" data-testid="button-add-student"><Plus size={15} /> Add student account</button></form>{manualCredential && <div className="one-time-credential"><strong>{manualCredential.fullName}</strong><span>{manualCredential.email}</span><code>{manualCredential.password}</code><small>Save this password now. It is not stored or shown again.</small></div>}<div className="roster-filters"><select className="portal-input" value={studentFilterBranch} onChange={(e) => setStudentFilterBranch(e.target.value as Branch | 'all')} data-testid="select-student-filter-branch"><option value="all">All branches</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</select><select className="portal-input" value={studentFilterSemester} onChange={(e) => setStudentFilterSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))} data-testid="select-student-filter-semester"><option value="all">All semesters</option>{semesters.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}</select></div><div className="portal-list">{students.filter((student) => (studentFilterBranch === 'all' || student.branch === studentFilterBranch) && (studentFilterSemester === 'all' || student.semester === studentFilterSemester)).map((student) => <div className="portal-list-row" key={student.id} data-testid={`row-student-${student.id}`}><span className="initial-avatar">{student.fullName.slice(0, 1).toUpperCase()}</span><span className="list-main"><strong>{student.fullName}</strong><small>{student.admissionNumber} · {student.branch || 'Branch unassigned'} · {student.semester ? `Semester ${student.semester}` : 'Semester unassigned'}{student.email ? ` · ${student.email}` : ''}</small></span><span className={`status-label ${student.clerkUserId ? 'status-good' : 'status-warm'}`}>{student.clerkUserId ? 'Linked' : 'Awaiting login'}</span></div>)}{!students.length && <Empty text="No students yet. Add the first student account above." />}</div></Panel>
       <Panel title="Create HOD login" eyebrow="DEPARTMENT ACCESS" icon={<GraduationCap size={18} />}><p className="panel-copy">Create a dedicated HOD account and assign one branch. That HOD will only see students in the assigned branch.</p><form onSubmit={addHod} className="portal-form-grid"><input className="portal-input" placeholder="HOD full name" value={hodName} onChange={(e) => setHodName(e.target.value)} data-testid="input-hod-name" /><input className="portal-input" placeholder="HOD email" type="email" value={hodEmail} onChange={(e) => setHodEmail(e.target.value)} data-testid="input-hod-email" /><select className="portal-input portal-span-2" value={hodBranch} onChange={(e) => setHodBranch(e.target.value as Branch)} data-testid="select-hod-branch">{branches.map((branch) => <option key={branch}>{branch}</option>)}</select><button className="portal-primary portal-span-2" data-testid="button-create-hod"><GraduationCap size={15} /> Create HOD login</button></form>{hodCredential && <div className="one-time-credential"><strong>{hodCredential.fullName} · {hodCredential.branch}</strong><span>{hodCredential.email}</span><code>{hodCredential.password}</code><small>Share this login securely. The HOD signs in from the same Staff / student login.</small></div>}</Panel>
      <Panel title="Upload answer sheets" eyebrow="DOCUMENT INTAKE" icon={<Upload size={18} />}><form onSubmit={uploadScan} className="portal-stack-form"><select className="portal-input" value={scanSubjectId} onChange={(e) => setScanSubjectId(e.target.value)} data-testid="select-scan-subject"><option value="">Choose subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.code}</option>)}</select><select className="portal-input" value={studentId} onChange={(e) => setStudentId(e.target.value)} data-testid="select-scan-student"><option value="">Choose student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.admissionNumber}</option>)}</select><label className="upload-drop" data-testid="dropzone-scan"><Upload size={18} /><span>{scan?.name || 'Choose a PDF scan'}</span><small>PDF only · stored privately</small><input type="file" accept="application/pdf" onChange={(e) => setScan(e.target.files?.[0] || null)} data-testid="input-scan-file" /></label><button className="portal-primary" disabled={!scan || !studentId || !scanSubjectId} data-testid="button-upload-scan"><Upload size={15} /> Store answer sheet</button></form></Panel>
      <Panel title="Teacher approvals" eyebrow="ACCESS CONTROL" icon={<ShieldCheck size={18} />}><div className="portal-list">{registrations.map((registration) => <div className="portal-list-row approval-row" key={registration.id} data-testid={`row-registration-${registration.id}`}><span className="list-leading-icon"><UserRound size={15} /></span><span className="list-main"><strong>{registration.subject.name}</strong><small>{registration.teacherClerkUserId}</small></span><span className={`status-label status-${registration.status}`}>{registration.status}</span>{registration.status === 'pending' && <span className="approval-actions"><button className="mini-button" onClick={async () => { await portalApi.reviewRegistration(registration.id, 'approved'); await load(); }} data-testid={`button-approve-registration-${registration.id}`}><Check size={13} /> Approve</button><button className="mini-button mini-button-danger" onClick={async () => { await portalApi.reviewRegistration(registration.id, 'rejected'); await load(); }} data-testid={`button-reject-registration-${registration.id}`}>Reject</button></span>}</div>)}{!registrations.length && <Empty text="No teacher access requests are waiting." />}</div></Panel>
       <Panel title="Register students from Excel" eyebrow="ACCOUNT PROVISIONING" icon={<FileSpreadsheet size={18} />}><p className="panel-copy">Upload a roster with Name, USN (or Admission Number), Email, Branch, and Semester columns. Each student gets a Clerk login and a unique 15-character password containing their USN.</p><form onSubmit={importRoster} className="portal-stack-form"><label className="upload-drop" data-testid="dropzone-student-roster"><FileSpreadsheet size={18} /><span>{rosterFile?.name || 'Choose an Excel or CSV roster'}</span><small>.xlsx, .xls, or .csv · up to 500 rows</small><input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => setRosterFile(e.target.files?.[0] || null)} data-testid="input-student-roster" /></label><button className="portal-primary" disabled={!rosterFile || importing} data-testid="button-import-students"><FileSpreadsheet size={15} /> {importing ? 'Registering students…' : 'Register students'}</button></form><div className="roster-help"><strong>Expected columns</strong><span>Name or Full Name</span><span>USN or Admission Number</span><span>Email or Email ID</span><span>Branch</span><span>Semester 1–8</span></div></Panel>
       {credentialResult && <Panel title="Credentials ready to download" eyebrow="PRIVATE EXPORT" icon={<KeyRound size={18} />}><div className="credential-summary"><div><strong>{credentialResult.imported.length}</strong><span>accounts created</span></div><div><strong>{credentialResult.errors.length}</strong><span>rows skipped</span></div><p>Passwords are shown only for this import. Download and store these files securely before leaving the page.</p></div><div className="portal-action-row credential-downloads"><button className="portal-primary" type="button" onClick={() => downloadBase64File(credentialResult.downloads.excel)} data-testid="button-download-credentials-excel"><FileDown size={15} /> Download Excel</button><button className="portal-secondary" type="button" onClick={() => downloadBase64File(credentialResult.downloads.pdf)} data-testid="button-download-credentials-pdf"><Download size={15} /> Download PDF</button></div><div className="credential-list">{credentialResult.credentialRows.map((credential) => <div className="credential-row" key={credential.USN}><span className="initial-avatar">{credential['Full name'].slice(0, 1).toUpperCase()}</span><span className="list-main"><strong>{credential['Full name']}</strong><small>{credential.USN} · {credential.Branch} · Semester {credential.Semester} · {credential.Email}</small></span><code>{credential.Password}</code></div>)}</div>{credentialResult.errors.length > 0 && <div className="import-errors"><strong>Rows needing attention</strong>{credentialResult.errors.map((item) => <span key={`${item.rowNumber}-${item.admissionNumber}`}>Row {item.rowNumber} · {item.admissionNumber || item.email}: {item.error}</span>)}</div>}</Panel>}
    </div>
  </WorkspaceIntro>;
}

function TeacherWorkspace() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [sheets, setSheets] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [finalScores, setFinalScores] = useState<Record<number, string>>({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const load = async () => {
    const [s, r, d, sh, ev] = await Promise.all([
      portalApi.subjects(), portalApi.teacherRegistrations(), portalApi.teacherDocuments(),
      portalApi.teacherStudentSheets(), portalApi.teacherEvaluations(),
    ]);
    setSubjects(s); setRegistrations(r); setDocuments(d); setSheets(sh); setEvaluations(ev);
  };
  useEffect(() => { load().catch((err) => setStatus(err.message)).finally(() => setLoading(false)); }, []);
  const register = async () => {
    if (!subjectId) return;
    try { await portalApi.registerTeacher(Number(subjectId)); setStatus('Registration sent for admin approval.'); await load(); }
    catch (err) { setStatus(err instanceof Error ? err.message : 'Could not register.'); }
  };
  const upload = async () => {
    if (!modelFile || !subjectId) return setStatus('Choose a subject and model-answer PDF.');
    try { await portalApi.uploadDocument(modelFile, { kind: 'model_answer', subjectId: Number(subjectId) }); setModelFile(null); setStatus('Model answer stored.'); await load(); }
    catch (err) { setStatus(err instanceof Error ? err.message : 'Upload failed.'); }
  };
  const finalize = async (evaluation: any) => {
    const score = Number(finalScores[evaluation.id] ?? evaluation.aiScore);
    if (!Number.isFinite(score) || score < 0 || score > evaluation.maxScore) return setStatus('Enter a valid final score within the maximum.');
    try { await portalApi.finalizeEvaluation(evaluation.id, score); setStatus('Evaluation finalized for the student.'); await load(); }
    catch (err) { setStatus(err instanceof Error ? err.message : 'Could not finalize evaluation.'); }
  };
  return <WorkspaceIntro eyebrow="TEACHER DESK" title="Grade with context, not guesswork." text="Request subject access, keep your model answers close, review AI drafts, and finalize marks before students can see them." status={status} loading={loading}><>
    <div className="workspace-metrics"><div><span>Subject access</span><strong>{registrations.filter((item) => item.status === 'approved').length}</strong><small>approved subjects</small></div><div><span>Answer sheets</span><strong>{sheets.length}</strong><small>ready to review</small></div><div><span>Needs finalization</span><strong>{evaluations.filter((item) => item.status !== 'final').length}</strong><small>AI drafts</small></div></div>
    <div className="portal-grid portal-grid-teacher">
      <Panel title="Subject access" eyebrow="PERMISSIONS" icon={<BookOpen size={18} />}><div className="portal-form-row"><select className="portal-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} data-testid="select-teacher-subject"><option value="">Choose available subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name} · {subject.code}</option>)}</select><button className="portal-primary" onClick={register} data-testid="button-request-subject">Request</button></div><div className="portal-list">{registrations.map((registration) => <div className="portal-list-row" key={registration.id} data-testid={`row-teacher-registration-${registration.id}`}><span className="list-leading-icon"><BookOpen size={15} /></span><span className="list-main"><strong>{registration.subject.name}</strong><small>{registration.subject.code}</small></span><span className={`status-label status-${registration.status}`}>{registration.status}</span></div>)}{!registrations.length && <Empty text="No subject registrations yet. Request access above." />}</div></Panel>
      <Panel title="Model-answer library" eyebrow="REFERENCE MATERIAL" icon={<FileText size={18} />}><select className="portal-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} data-testid="select-model-subject"><option value="">Choose subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><label className="upload-drop" data-testid="dropzone-model-answer"><Upload size={18} /><span>{modelFile?.name || 'Choose model-answer PDF'}</span><small>Reference material for AI review</small><input type="file" accept="application/pdf" onChange={(e) => setModelFile(e.target.files?.[0] || null)} data-testid="input-model-answer" /></label><button className="portal-primary" onClick={upload} disabled={!modelFile || !subjectId} data-testid="button-upload-model"><Upload size={15} /> Upload model answer</button><div className="portal-list">{documents.filter((document) => document.kind === 'model_answer').map((document) => <a className="portal-list-row portal-list-link" href={apiUrl(`/storage/objects/${document.objectPath.replace('/objects/', '')}`)} target="_blank" rel="noreferrer" key={document.id} data-testid={`link-model-document-${document.id}`}><span className="list-leading-icon"><FileText size={15} /></span><span className="list-main"><strong>{document.fileName}</strong><small>Model answer · {new Date(document.createdAt).toLocaleDateString()}</small></span><ArrowRight size={15} /></a>)}</div></Panel>
      <Panel title="Scanned answer sheets" eyebrow="READY FOR REVIEW" icon={<ClipboardCheck size={18} />}><div className="portal-list">{sheets.map((sheet) => <a className="portal-list-row portal-list-link" href={apiUrl(`/storage/objects/${sheet.objectPath.replace('/objects/', '')}`)} target="_blank" rel="noreferrer" key={sheet.id} data-testid={`link-answer-sheet-${sheet.id}`}><span className="list-leading-icon"><FileText size={15} /></span><span className="list-main"><strong>{sheet.student.fullName}</strong><small>{sheet.subject.code} · {sheet.fileName}</small></span><ArrowRight size={15} /></a>)}{!sheets.length && <Empty text="No approved-subject answer sheets are available yet." />}</div></Panel>
      <Panel title="Review and finalize" eyebrow="HUMAN APPROVAL" icon={<ShieldCheck size={18} />}><div className="evaluation-list">{evaluations.map((evaluation) => <div className="evaluation-row" key={evaluation.id} data-testid={`row-evaluation-${evaluation.id}`}><div className="evaluation-heading"><span className="initial-avatar">{evaluation.student.fullName.slice(0, 1).toUpperCase()}</span><div className="list-main"><strong>{evaluation.student.fullName}</strong><small>{evaluation.subject.name} · {evaluation.result?.examTitle || 'Evaluation'}</small></div><span className={`status-label ${evaluation.status === 'final' ? 'status-final' : 'status-draft'}`}>{evaluation.status === 'final' ? 'Final' : 'AI draft'}</span></div><div className="evaluation-controls"><input className="portal-input score-field" type="number" min="0" max={evaluation.maxScore} value={finalScores[evaluation.id] ?? String(evaluation.finalScore ?? evaluation.aiScore)} onChange={(e) => setFinalScores((current) => ({ ...current, [evaluation.id]: e.target.value }))} disabled={evaluation.status === 'final'} data-testid={`input-final-score-${evaluation.id}`} /><span>/ {evaluation.maxScore}</span>{evaluation.status !== 'final' && <button className="mini-button mini-button-finalize" onClick={() => finalize(evaluation)} data-testid={`button-finalize-evaluation-${evaluation.id}`}><Check size={13} /> Finalize</button>}</div>{evaluation.evaluatedPdfDocumentId && <div className="evaluation-footnote"><FileCheck2 size={13} /> Evaluated PDF saved to the student record.</div>}</div>)}{!evaluations.length && <Empty text="No saved evaluations yet. Select an approved scan in AI evaluation." />}</div></Panel>
     </div>
       <Panel title="Next step" eyebrow="REVIEW LOOP" icon={<Sparkles size={18} />}><p className="panel-copy">Choose AI-assisted review when you want evidence and question-level feedback, or record a teacher decision directly with manual evaluation.</p><div className="portal-action-row"><button className="portal-primary" onClick={() => setLocation('/evaluate')} data-testid="button-open-ai-evaluation">Open AI evaluation <ArrowRight size={15} /></button><button className="portal-secondary" onClick={() => setLocation('/evaluate/manual')} data-testid="button-open-manual-evaluation"><ClipboardCheck size={15} /> Manual evaluation</button></div></Panel>
   </>
  </WorkspaceIntro>;
}

function StudentWorkspace() {
  const [evaluations, setEvaluations] = useState<any[]>([]); const [status, setStatus] = useState('');
  useEffect(() => { portalApi.studentEvaluations().then(setEvaluations).catch((err: unknown) => setStatus(err instanceof Error ? err.message : 'Could not load evaluations.')); }, []);
  const finalized = evaluations.filter((evaluation) => evaluation.status === 'final');
  return <WorkspaceIntro eyebrow="STUDENT VIEW" title="Your feedback, in one place." text="Finalized evaluations are read-only here. Review the score, feedback, and teacher-approved outcome." status={status}><div className="workspace-metrics"><div><span>Finalized work</span><strong>{finalized.length}</strong><small>ready to read</small></div><div><span>Latest subject</span><strong className="metric-text">{finalized[0]?.subject.code || '—'}</strong><small>{finalized[0]?.subject.name || 'No results yet'}</small></div><div><span>Access</span><strong className="metric-text">Read only</strong><small>teacher approved</small></div></div><div className="student-results">{evaluations.map((evaluation) => <article className={`student-result-card ${evaluation.status !== 'final' ? 'student-result-draft' : ''}`} key={evaluation.id} data-testid={`card-student-evaluation-${evaluation.id}`}><div className="student-result-top"><div><div className="portal-card-kicker">{evaluation.subject.code} · {evaluation.subject.name}</div><h2>{evaluation.result?.examTitle || 'Evaluated answer sheet'}</h2><span className={`status-label ${evaluation.status === 'final' ? 'status-final' : 'status-draft'}`}>{evaluation.status === 'final' ? 'Finalized by teacher' : 'Awaiting teacher review'}</span></div><div className="student-score"><strong>{evaluation.finalScore ?? evaluation.result?.overallScore ?? 0}</strong><span>/ {evaluation.maxScore}</span></div></div><div className="student-result-divider" /><p>{evaluation.result?.summary || 'Feedback will appear when your teacher finalizes the evaluation.'}</p><div className="student-result-meta"><span><FileCheck2 size={14} /> Evidence-led result</span><span>{new Date(evaluation.createdAt).toLocaleDateString()}</span></div></article>)}{!evaluations.length && <div className="portal-empty-large"><div className="empty-mark"><FileCheck2 size={22} /></div><strong>No finalized evaluations yet</strong><p>Your teacher-approved marks and feedback will appear here when they are ready.</p></div>}</div></WorkspaceIntro>;
}

function HodWorkspace() {
  const [branch, setBranch] = useState<Branch | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [semester, setSemester] = useState<number | 'all'>('all');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    portalApi.hodStudents()
      .then((result) => { setBranch(result.branch); setStudents(result.students); })
      .catch((err: unknown) => setStatus(err instanceof Error ? err.message : 'Could not load the department roster.'))
      .finally(() => setLoading(false));
  }, []);
  const visibleStudents = students.filter((student) => semester === 'all' || student.semester === semester);
  return <WorkspaceIntro eyebrow="HOD DESK" title={`${branch || 'Department'} student list.`} text="Review the students assigned to your branch, segmented by semester. HOD accounts can view roster information but cannot change registration details." status={status} loading={loading}>
    <div className="workspace-metrics"><div><span>Department</span><strong className="metric-text">{branch || '—'}</strong><small>assigned branch</small></div><div><span>Total students</span><strong>{students.length}</strong><small>in this department</small></div><div><span>Semesters</span><strong>{new Set(students.map((student) => student.semester).filter(Boolean)).size}</strong><small>with registrations</small></div></div>
    <Panel title="Department roster" eyebrow="STUDENT DIRECTORY" icon={<UsersRound size={18} />}><div className="roster-filters"><select className="portal-input" value={semester} onChange={(e) => setSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))} data-testid="select-hod-semester"><option value="all">All semesters</option>{semesters.map((item) => <option key={item} value={item}>Semester {item}</option>)}</select></div><div className="semester-sections">{semesters.filter((item) => semester === 'all' || item === semester).map((item) => { const group = visibleStudents.filter((student) => student.semester === item); return group.length ? <section className="semester-section" key={item}><div className="semester-section-heading"><span>SEMESTER {item}</span><strong>{group.length} students</strong></div><div className="portal-list">{group.map((student) => <div className="portal-list-row" key={student.id} data-testid={`row-hod-student-${student.id}`}><span className="initial-avatar">{student.fullName.slice(0, 1).toUpperCase()}</span><span className="list-main"><strong>{student.fullName}</strong><small>{student.admissionNumber}{student.email ? ` · ${student.email}` : ''}</small></span><span className="status-label status-good">{student.clerkUserId ? 'Login linked' : 'No login'}</span></div>)}</div></section> : null })}{!visibleStudents.length && <Empty text="No students are registered for this branch and semester." />}</div></Panel>
  </WorkspaceIntro>;
}

function WorkspaceIntro({ eyebrow, title, text, status, children, loading = false }: { eyebrow: string; title: string; text: string; status: string; children: ReactNode; loading?: boolean }) {
  return <div className="workspace-page"><div className="workspace-heading"><div><div className="portal-eyebrow"><span /> {eyebrow}</div><h1>{title}</h1><p>{text}</p></div><div className="workspace-status"><span className="portal-live-dot" /><div><small>Workspace status</small><strong>Protected & connected</strong></div></div></div>{status && <div className="portal-status" data-testid="status-workspace"><Activity size={15} /> {status}</div>}{loading ? <div className="portal-loading-grid"><div /><div /><div /></div> : children}</div>;
}

function Panel({ title, eyebrow, icon, children }: { title: string; eyebrow?: string; icon: ReactNode; children: ReactNode }) {
  return <section className="portal-panel"><div className="panel-heading"><div className="panel-icon">{icon}</div><div><span>{eyebrow || 'WORKSPACE'}</span><h2>{title}</h2></div></div>{children}</section>;
}

function Empty({ text }: { text: string }) { return <div className="portal-empty"><Info size={16} /><span>{text}</span></div>; }

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f1e8] px-4"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f1e8] px-4"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><PortalRedirect /></Show><Show when="signed-out"><PublicHome /></Show></>;
}

function PortalRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/portal'); }, [setLocation]);
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5f1e8]"><LoaderCircle className="animate-spin text-[#0f766e]" /></div>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><PublicHome /></Show></>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/portal"><ProtectedRoute><PortalPage /></ProtectedRoute></Route>
        <Route path="/evaluate/manual"><ProtectedRoute><ManualEvaluatorPage /></ProtectedRoute></Route>
        <Route path="/evaluate"><ProtectedRoute><EvaluatorPage /></ProtectedRoute></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ApiClientConfig() {
  const { getToken } = useAuth();
  useEffect(() => {
    const apiOrigin = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
    setBaseUrl(apiOrigin || null);
    setAuthTokenGetter(getToken);
    setPortalAuthTokenGetter(getToken);
    return () => {
      setAuthTokenGetter(null);
      setPortalAuthTokenGetter(null);
    };
  }, [getToken]);
  return null;
}

function App() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => { window.history.pushState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')); }}
      routerReplace={(to) => { window.history.replaceState({}, '', to); window.dispatchEvent(new PopStateEvent('popstate')); }}
      localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your assessment desk' } }, signUp: { start: { title: 'Create your account', subtitle: 'Set up your role in AI Examiner' } } }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ApiClientConfig />
          <WouterRouter base={basePath}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
