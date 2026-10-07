import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import { Copy, Download, FileUp, GripVertical, Plus, RotateCcw, X } from 'lucide-react';

import {
  advancedCases,
  applyContentChange,
  blankWorkroom,
  buildPortablePrompt,
  captureExactQuote,
  createMarkdownReviewPack,
  createWorkroomFromCase,
  evaluateAuthoredCase,
  getReviewSummary,
  hasMeaningfulWorkroom,
  nextCitationId,
  nextCriterionId,
  nextReviewId,
  nextSourceId,
  parseReviewPack,
  reorderSources,
  replaceWorkroom,
  resetWorkroom,
  restoreImportedState,
  serializeReviewPack,
  validateReview,
  WORKROOM_LIMITS,
  type Citation,
  type ReviewEntry,
  type Verdict,
  type WorkroomState,
} from '@/lib/workroom';

type Stage = 'brief' | 'prompt' | 'review' | 'pack';
type HandoffFormat = 'markdown' | 'json';
type GuardAction =
  | { kind: 'download'; format: HandoffFormat }
  | { kind: 'case'; caseId: string }
  | { kind: 'own-work' }
  | { kind: 'clear' }
  | { kind: 'import'; imported: WorkroomState }
  | { kind: 'course-reset' };
type GuardState = { action: GuardAction; error: string };
export type WorkroomHandle = { requestCourseReset: () => boolean };
type WorkroomProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  resetToken?: number;
  onCourseResetConfirmed?: () => void;
  onOpenWorkroom?: () => void;
};
type ReviewDraft = {
  claim: string;
  draftQuote: string;
  draftOffset: number;
  citations: Citation[];
  verdict: Verdict | '';
  reason: string;
};

const emptyReviewDraft = (): ReviewDraft => ({
  claim: '',
  draftQuote: '',
  draftOffset: -1,
  citations: [],
  verdict: '',
  reason: '',
});

function hasUnfinishedReview(entry: ReviewDraft) {
  return Boolean(
    entry.claim.trim()
    || entry.draftQuote.trim()
    || entry.draftOffset >= 0
    || entry.citations.length
    || entry.verdict
    || entry.reason.trim(),
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function statusLabel(status: ReturnType<typeof getReviewSummary>['status']) {
  return status === 'ready-for-human-review' ? 'Ready for review' : 'More checks needed';
}

function characterLimit(value: string, maximum: number) {
  return <small className="field-limit" aria-hidden="true">{value.length.toLocaleString()} / {maximum.toLocaleString()} characters</small>;
}

function byteLabel(bytes: number) {
  return `${Math.ceil(bytes / 1_000).toLocaleString()} KB`;
}

const Workroom = forwardRef<WorkroomHandle, WorkroomProps>(function Workroom({
  headingRef,
  resetToken = 0,
  onCourseResetConfirmed,
  onOpenWorkroom,
}, ref) {
  const [state, setState] = useState<WorkroomState>(() => createWorkroomFromCase('supplier'));
  const [entry, setEntry] = useState<ReviewDraft>(emptyReviewDraft);
  const [notice, setNotice] = useState('Supplier decision practice is loaded. Start with the request, or check the draft now.');
  const [stage, setStage] = useState<Stage>('brief');
  const [guard, setGuard] = useState<GuardState | null>(null);
  const resetTokenRef = useRef(resetToken);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const casePickerRef = useRef<HTMLDetailsElement>(null);
  const reviewFocusRequestedRef = useRef(false);
  const sourceEvidenceRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);
  const safeDialogActionRef = useRef<HTMLButtonElement>(null);
  const summary = useMemo(() => getReviewSummary(state), [state]);
  const prompt = useMemo(() => buildPortablePrompt(state), [state]);
  const authoredCase = useMemo(() => evaluateAuthoredCase(state), [state]);
  const packReadiness = useMemo(() => serializeReviewPack(state), [state]);
  const unfinishedReview = hasUnfinishedReview(entry);
  const meaningfulWorkroom = hasMeaningfulWorkroom(state);

  const openGuard = (
    action: GuardAction,
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null,
  ) => {
    dialogOpenerRef.current = opener;
    setGuard({ action, error: '' });
  };

  const dismissGuard = (restoreFocus = true) => {
    setGuard(null);
    if (!restoreFocus) return;
    const opener = dialogOpenerRef.current;
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus();
    });
  };

  useImperativeHandle(ref, () => ({
    requestCourseReset: () => {
      if (!meaningfulWorkroom && !unfinishedReview) return false;
      const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      onOpenWorkroom?.();
      requestAnimationFrame(() => openGuard({ kind: 'course-reset' }, opener));
      return true;
    },
  }), [meaningfulWorkroom, onOpenWorkroom, unfinishedReview]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!guard) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => safeDialogActionRef.current?.focus());
  }, [guard]);

  useEffect(() => {
    if (resetToken === resetTokenRef.current) return;
    resetTokenRef.current = resetToken;
    setState(resetWorkroom());
    setEntry(emptyReviewDraft());
    setStage('brief');
    setNotice('The course reset cleared this Workroom. Nothing was saved.');
  }, [resetToken]);

  useEffect(() => {
    if (stage !== 'review' || !reviewFocusRequestedRef.current) return;
    reviewFocusRequestedRef.current = false;
    draftRef.current?.focus();
  }, [stage]);

  const changeContent = (change: Parameters<typeof applyContentChange>[1], nextNotice = 'This changed the current material, so record its checks again for this version.') => {
    const nextState = applyContentChange(state, change);
    const exportable = serializeReviewPack(nextState);
    if (!exportable.ok) {
      setNotice(`This edit was not applied. ${exportable.error}`);
      return;
    }
    setState(nextState);
    setEntry(emptyReviewDraft());
    setNotice(nextNotice);
  };

  const reportGuardError = (error: string) => {
    setGuard((current) => current ? { ...current, error } : current);
  };

  const installReplacement = (nextState: WorkroomState, nextStage: Stage, nextNotice: string) => {
    const exportable = serializeReviewPack(nextState);
    if (!exportable.ok) {
      const message = `This replacement cannot continue. ${exportable.error}`;
      if (guard) reportGuardError(message);
      else setNotice(message);
      return false;
    }
    setState(nextState);
    setEntry(emptyReviewDraft());
    setStage(nextStage);
    setNotice(nextNotice);
    dismissGuard(false);
    return true;
  };

  const loadCaseNow = (caseId: string) => {
    const item = advancedCases.find((candidate) => candidate.id === caseId);
    if (!item) return;
    const nextState = replaceWorkroom(state, createWorkroomFromCase(caseId));
    if (!installReplacement(nextState, 'brief', `${item.title} loaded. It is fictional practice: make your own claim checks before comparing it with the reference.`)) return;
    casePickerRef.current?.removeAttribute('open');
  };

  const loadCase = (caseId: string) => {
    if (meaningfulWorkroom || unfinishedReview) {
      openGuard({ kind: 'case', caseId });
      return;
    }
    loadCaseNow(caseId);
  };

  const startOwnWorkNow = () => {
    const nextState = replaceWorkroom(state, blankWorkroom());
    installReplacement(nextState, 'brief', 'Started a blank Workroom. Add the request and source notes, then build a prompt or check a draft.');
  };

  const startOwnWork = () => {
    if (meaningfulWorkroom || unfinishedReview) {
      openGuard({ kind: 'own-work' });
      return;
    }
    startOwnWorkNow();
  };

  const clearWorkroomNow = () => {
    setState(resetWorkroom());
    setEntry(emptyReviewDraft());
    setStage('brief');
    setNotice('Workroom cleared. Nothing was saved.');
    dismissGuard(false);
  };

  const requestClearWorkroom = () => {
    if (meaningfulWorkroom || unfinishedReview) {
      openGuard({ kind: 'clear' });
      return;
    }
    clearWorkroomNow();
  };

  const checkDraft = () => {
    if (stage === 'review') {
      draftRef.current?.focus();
      return;
    }
    reviewFocusRequestedRef.current = true;
    setStage('review');
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Automatic copy was unavailable. Select the ${label.toLowerCase()} and copy it manually.`);
    }
  };

  const captureDraftSelection = () => {
    const textarea = draftRef.current;
    if (!textarea) return;
    const captured = captureExactQuote(state.draft, textarea.selectionStart, textarea.selectionEnd);
    if (!captured.quote.trim()) {
      setNotice('Select a claim in the draft first. Its exact wording will stay with this check.');
      return;
    }
    setEntry((current) => ({ ...current, draftQuote: captured.quote, draftOffset: captured.offset }));
      setNotice('Selected draft text added to this claim check.');
  };

  const prepareReview = () => {
    if (state.reviews.length >= WORKROOM_LIMITS.maxReviews) {
      return { ok: false as const, error: `This handoff can hold up to ${WORKROOM_LIMITS.maxReviews} claim checks.` };
    }
    if (!entry.verdict) {
      return { ok: false as const, error: 'Choose your finding before saving this claim check.' };
    }
    const prepared: ReviewEntry = {
      id: nextReviewId(state),
      claim: entry.claim,
      draftQuote: entry.draftQuote,
      draftOffset: entry.draftOffset,
      citations: entry.citations.map((citation) => ({ ...citation })),
      verdict: entry.verdict,
      reason: entry.reason,
    };
    const error = validateReview(prepared, state.sources, state.draft);
    if (error) {
      return { ok: false as const, error };
    }
    const nextState = { ...state, reviews: [...state.reviews, prepared] };
    const exportable = serializeReviewPack(nextState);
    if (!exportable.ok) {
      return { ok: false as const, error: `This claim check was not saved. ${exportable.error}` };
    }
    return { ok: true as const, state: nextState };
  };

  const savePreparedReview = (nextState: WorkroomState) => {
    setState(nextState);
    setEntry(emptyReviewDraft());
    setNotice('Claim check saved. It covers this claim only, not the whole draft.');
  };

  const addReview = () => {
    const prepared = prepareReview();
    if (!prepared.ok) {
      setNotice(prepared.error);
      return null;
    }
    savePreparedReview(prepared.state);
    return prepared.state;
  };

  const restoreImportedNow = (imported: WorkroomState) => {
    const nextState = restoreImportedState(state, imported);
    return installReplacement(nextState, 'pack', 'JSON handoff opened. Its status was recalculated from the restored material.');
  };

  const importPack = async (file?: File) => {
    if (!file) return;
    if (file.size > WORKROOM_LIMITS.maxPackBytes) {
      setNotice(`That JSON handoff is too large. The limit is ${WORKROOM_LIMITS.maxPackBytes.toLocaleString()} bytes, and it was not read.`);
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice('This JSON handoff could not be read. Your current work is unchanged.');
      return;
    }
    const parsed = parseReviewPack(text);
    if (!parsed.ok) {
      setNotice(parsed.error);
      return;
    }
    if (meaningfulWorkroom || unfinishedReview) {
      openGuard({ kind: 'import', imported: parsed.state });
      return;
    }
    restoreImportedNow(parsed.state);
  };

  const captureSourceSelection = (sourceId: string) => {
    if (entry.citations.length >= WORKROOM_LIMITS.maxCitationsPerReview) {
      setNotice(`A claim check can hold up to ${WORKROOM_LIMITS.maxCitationsPerReview} exact source excerpts.`);
      return;
    }
    const textarea = sourceEvidenceRefs.current[sourceId];
    const source = state.sources.find((item) => item.id === sourceId);
    if (!textarea || !source) return;
    const captured = captureExactQuote(source.text, textarea.selectionStart, textarea.selectionEnd);
    if (!captured.quote.trim()) {
      setNotice(`Select an exact excerpt in ${sourceId} first.`);
      return;
    }
    setEntry((current) => {
      const exists = current.citations.some(
        (citation) => citation.sourceId === sourceId && citation.offset === captured.offset && citation.quote === captured.quote,
      );
      if (exists) return current;
      return {
        ...current,
        citations: [
          ...current.citations,
          {
            id: nextCitationId(current, state.reviews.flatMap((review) => review.citations)),
            sourceId,
            quote: captured.quote,
            offset: captured.offset,
          },
        ],
      };
    });
    setNotice(`Excerpt added from ${source.title}.`);
  };

  const changeReviewerNote = (reviewerNote: string) => {
    const nextState = { ...state, reviewerNote };
    const exportable = serializeReviewPack(nextState);
    if (!exportable.ok) {
      setNotice(`This note was not applied. ${exportable.error}`);
      return;
    }
    setState(nextState);
  };

  const downloadJsonPack = (stateToDownload = state, completionNote = '') => {
    const exportable = serializeReviewPack(stateToDownload);
    if (!exportable.ok) {
      setNotice(`JSON handoff was not downloaded. ${exportable.error}`);
      return;
    }
    download('signal-school-review-pack.json', exportable.text, 'application/json;charset=utf-8');
    setNotice(`JSON handoff downloaded (${byteLabel(exportable.byteLength)}).${completionNote}`);
  };

  const downloadMarkdownHandoff = (stateToDownload = state, completionNote = '') => {
    const exportable = serializeReviewPack(stateToDownload);
    if (!exportable.ok) {
      setNotice(`Markdown handoff was not downloaded. ${exportable.error}`);
      return;
    }
    download('signal-school-review.md', createMarkdownReviewPack(stateToDownload), 'text/markdown;charset=utf-8');
    setNotice(`Markdown handoff downloaded.${completionNote}`);
  };

  const downloadHandoff = (format: HandoffFormat, stateToDownload = state, completionNote = '') => {
    if (format === 'json') downloadJsonPack(stateToDownload, completionNote);
    else downloadMarkdownHandoff(stateToDownload, completionNote);
  };

  const requestDownload = (format: HandoffFormat) => {
    if (unfinishedReview) {
      openGuard({ kind: 'download', format });
      return;
    }
    downloadHandoff(format);
  };

  const returnToCheck = () => {
    reviewFocusRequestedRef.current = true;
    setStage('review');
    dismissGuard(false);
  };

  const saveAndDownload = () => {
    if (guard?.action.kind !== 'download') return;
    const prepared = prepareReview();
    if (!prepared.ok) {
      reportGuardError(prepared.error);
      return;
    }
    const format = guard.action.format;
    savePreparedReview(prepared.state);
    dismissGuard(false);
    downloadHandoff(format, prepared.state);
  };

  const downloadWithoutUnfinishedReview = (discard = false) => {
    if (guard?.action.kind !== 'download') return;
    const format = guard.action.format;
    if (discard) setEntry(emptyReviewDraft());
    dismissGuard(false);
    downloadHandoff(
      format,
      state,
      discard
        ? ' The unfinished claim check was discarded.'
        : ' It does not include the unfinished claim check, which remains in the check form.',
    );
  };

  const continueReplacement = () => {
    if (!guard) return;
    const action = guard.action;
    if (action.kind === 'case') {
      loadCaseNow(action.caseId);
      return;
    }
    if (action.kind === 'own-work') {
      startOwnWorkNow();
      return;
    }
    if (action.kind === 'clear') {
      clearWorkroomNow();
      return;
    }
    if (action.kind === 'import') {
      restoreImportedNow(action.imported);
      return;
    }
    dismissGuard(false);
    onCourseResetConfirmed?.();
  };

  const returnToHandoff = () => {
    setStage('pack');
    dismissGuard(false);
    onOpenWorkroom?.();
  };

  const activePracticeCase = state.caseId
    ? advancedCases.find((item) => item.id === state.caseId) ?? null
    : null;
  const checkDraftLabel = state.draft.trim()
    ? 'Check loaded draft'
    : activePracticeCase
      ? 'Check the practice draft'
      : 'Check your draft';
  const guardTitle = guard?.action.kind === 'download'
    ? 'An unfinished claim check needs a decision'
    : guard?.action.kind === 'course-reset'
      ? 'Reset the course and discard this Workroom?'
      : 'Replace this Workroom?';
  const guardDescription = guard?.action.kind === 'download'
    ? 'This claim check is still in the form, so it is not in the handoff yet. Save it, return to it, or make an explicit handoff without it.'
    : 'This action would replace the current Workroom. Download a handoff first, keep editing, or continue when you are ready to let this material go.';
  const replacementActionLabel = guard?.action.kind === 'case'
    ? 'Load the practice case'
    : guard?.action.kind === 'own-work'
      ? 'Start a blank Workroom'
      : guard?.action.kind === 'clear'
        ? 'Clear this Workroom'
        : guard?.action.kind === 'import'
          ? 'Open the JSON handoff'
          : 'Reset the course';

  return (
    <section className="prompt-lab workroom" id="prompt-lab" data-workspace-active data-stage={stage} aria-labelledby="lab-title">
      <div className="workroom-heading">
        <p className="signal-eyebrow">Workroom</p>
        <h2 id="lab-title" tabIndex={-1} ref={headingRef}>Check a draft against its source notes.</h2>
        <p>Keep the request, source notes, draft, and your checks together.</p>
      </div>

      <div className="workroom-entry" aria-label="Workroom starting point">
        <div className="active-case">
          <span>{activePracticeCase ? 'Practice case' : 'Your own work'}</span>
          <strong>{activePracticeCase?.title ?? 'Your draft and source notes'}</strong>
        </div>
        <div className="workroom-entry-actions">
          <button type="button" onClick={checkDraft}>{checkDraftLabel}</button>
          <button type="button" className="quiet-action" onClick={startOwnWork} aria-pressed={state.caseId === null}>Start your own work</button>
          <details className="case-launch" ref={casePickerRef}>
            <summary>Change practice case</summary>
            <div className="case-launch-options">
              <strong>Choose a practice case</strong>
              <span>Each case is fictional and has its own source notes and draft.</span>
              {advancedCases.map((item) => (
                <button type="button" key={item.id} onClick={() => loadCase(item.id)} aria-pressed={state.caseId === item.id}>
                  {item.title}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>

      <nav className="workroom-stages" aria-label="Workroom steps">
        {([
          ['brief', '1. Request & sources'],
          ['prompt', '2. Build prompt'],
          ['review', '3. Check draft'],
          ['pack', '4. Download handoff'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={stage === id} onClick={() => setStage(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="workroom-status" aria-live="polite">
        <strong data-review-status={unfinishedReview ? 'unfinished-entry' : summary.status}>
          {unfinishedReview ? 'Unfinished claim check' : statusLabel(summary.status)}
        </strong>
        <span>{state.sources.length} source cards</span>
        <span>{state.criteria.length} manual criteria</span>
        <span>{summary.selectedClaimCount} {summary.selectedClaimCount === 1 ? 'claim checked' : 'claims checked'}</span>
        {unfinishedReview && <span className="unfinished-review-status">1 unfinished claim check</span>}
      </div>

      {stage === 'brief' && (
        <div className="workroom-grid">
          <section className="brief-panel" aria-labelledby="brief-title">
            <h3 id="brief-title">Request</h3>
            <p className="field-help">State the work, reader, and limits before you draft.</p>
            {([
              ['task', 'Task'],
              ['audience', 'Audience'],
              ['output', 'Requested output'],
              ['boundary', 'Boundary'],
              ['unknowns', 'Known unknowns or questions'],
            ] as const).map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  value={state.brief[key]}
                  onChange={(event) => changeContent({ brief: { ...state.brief, [key]: event.target.value } })}
                  placeholder={key === 'unknowns' ? 'For example: delivery timing is not confirmed.' : undefined}
                  maxLength={WORKROOM_LIMITS.maxBriefFieldLength}
                />
                {characterLimit(state.brief[key], WORKROOM_LIMITS.maxBriefFieldLength)}
              </label>
            ))}

            <div className="workroom-subhead">
              <h3>Acceptance criteria</h3>
              <p>Mark these checks yourself before you hand the draft on.</p>
            </div>
            {state.criteria.map((criterion) => (
              <article className="criterion" key={criterion.id}>
                <p className="stable-id"><span>Criterion</span><code>{criterion.id}</code></p>
                <label>
                  Criterion
                  <textarea
                    aria-label={`${criterion.id} criterion`}
                    value={criterion.text}
                    onChange={(event) => changeContent({ criteria: state.criteria.map((item) => item.id === criterion.id ? { ...item, text: event.target.value } : item) })}
                    maxLength={WORKROOM_LIMITS.maxCriterionTextLength}
                  />
                  {characterLimit(criterion.text, WORKROOM_LIMITS.maxCriterionTextLength)}
                </label>
                <button
                  type="button"
                  className="quiet-action"
                  onClick={() => changeContent({ criteria: state.criteria.filter((item) => item.id !== criterion.id) })}
                >
                  <X aria-hidden="true" /> Remove
                </button>
              </article>
            ))}
            <button
              type="button"
              className="quiet-action"
              disabled={state.criteria.length >= WORKROOM_LIMITS.maxCriteria}
              onClick={() => changeContent({ criteria: [...state.criteria, { id: nextCriterionId(state), text: '', review: 'not-reviewed' }] })}
            >
              <Plus aria-hidden="true" /> Add criterion
            </button>
          </section>

          <section className="source-panel" aria-labelledby="sources-title">
            <h3 id="sources-title">Source notes</h3>
            <p className="source-boundary">These notes are the evidence you can cite. Their labels stay with saved excerpts when you move a card.</p>
            {state.sources.map((source, index) => (
              <article className="source-card" key={source.id || `source-${index}`}>
                <div className="source-card-header">
                  <GripVertical aria-hidden="true" />
                  <strong>{source.id || 'Source ID needed'}</strong>
                  <div>
                    <button type="button" className="icon-action" aria-label={`Move ${source.id} up`} disabled={index === 0} onClick={() => setState((current) => reorderSources(current, source.id, 'up'))}>↑</button>
                    <button type="button" className="icon-action" aria-label={`Move ${source.id} down`} disabled={index === state.sources.length - 1} onClick={() => setState((current) => reorderSources(current, source.id, 'down'))}>↓</button>
                  </div>
                </div>
                <p className="stable-id"><span>Source</span><code>{source.id}</code></p>
                <label>
                  Source title
                  <input
                    aria-label={`${source.id} source title`}
                    value={source.title}
                    onChange={(event) => changeContent({ sources: state.sources.map((item) => item.id === source.id ? { ...item, title: event.target.value } : item) })}
                    maxLength={WORKROOM_LIMITS.maxSourceTitleLength}
                  />
                  {characterLimit(source.title, WORKROOM_LIMITS.maxSourceTitleLength)}
                </label>
                <label>
                  Source text
                  <textarea
                    aria-label={`${source.id} source text`}
                    value={source.text}
                    onChange={(event) => changeContent({ sources: state.sources.map((item) => item.id === source.id ? { ...item, text: event.target.value } : item) })}
                    maxLength={WORKROOM_LIMITS.maxSourceTextLength}
                  />
                  {characterLimit(source.text, WORKROOM_LIMITS.maxSourceTextLength)}
                </label>
                <button type="button" className="quiet-action" onClick={() => changeContent({ sources: state.sources.filter((item) => item.id !== source.id) })}>
                  <X aria-hidden="true" /> Remove source
                </button>
              </article>
            ))}
            <button
              type="button"
              className="quiet-action"
              disabled={state.sources.length >= WORKROOM_LIMITS.maxSources}
              onClick={() => changeContent({ sources: [...state.sources, { id: nextSourceId(state), title: '', text: '' }] })}
            >
              <Plus aria-hidden="true" /> Add source
            </button>
          </section>
        </div>
      )}

      {stage === 'prompt' && (
        <section className="prompt-output" aria-labelledby="prompt-title">
          <div className="workroom-subhead">
            <div>
              <h3 id="prompt-title">Build a prompt</h3>
              <p>Use this with the AI tool you choose. It brings the request, source notes, and limits together.</p>
            </div>
          </div>
          <pre aria-label="Prompt to use">{prompt}</pre>
          <div className="workroom-actions">
            <button type="button" onClick={() => copyText(prompt, 'prompt')}><Copy aria-hidden="true" /> Copy prompt</button>
            <button type="button" onClick={() => download('signal-school-brief.txt', prompt, 'text/plain;charset=utf-8')}><Download aria-hidden="true" /> Download prompt</button>
          </div>
        </section>
      )}

      {stage === 'review' && (
        <section className="draft-review" aria-labelledby="review-title">
          <div className="workroom-subhead">
            <div>
              <h3 id="review-title">Check the draft</h3>
              <p>Select the exact draft text and source excerpts you want to check. These notes cover only those claims.</p>
            </div>
          </div>
          <label>
            Draft to check
            <textarea
              ref={draftRef}
              aria-label="Draft to check"
              className="draft-textarea"
              value={state.draft}
              onChange={(event) => changeContent({ draft: event.target.value })}
              placeholder="Paste a draft from the external tool you chose."
              maxLength={WORKROOM_LIMITS.maxDraftLength}
            />
            {characterLimit(state.draft, WORKROOM_LIMITS.maxDraftLength)}
          </label>
          <button type="button" className="quiet-action" onClick={captureDraftSelection}>Capture selected draft text</button>

          <div className="review-layout">
            <section className="review-form" aria-label="Claim check">
              <h4>Your claim check</h4>
              <label>
                Claim in your own words
                <input maxLength={WORKROOM_LIMITS.maxClaimLength} value={entry.claim} onChange={(event) => setEntry((current) => ({ ...current, claim: event.target.value }))} />
                {characterLimit(entry.claim, WORKROOM_LIMITS.maxClaimLength)}
              </label>
              <p className="captured-quote">
                {entry.draftQuote ? <>Exact draft text: “{entry.draftQuote}”</> : 'Capture the exact draft text before you save this check.'}
              </p>
              <label>
                Your finding
                <select value={entry.verdict} onChange={(event) => setEntry((current) => ({ ...current, verdict: event.target.value as Verdict | '' }))}>
                  <option value="">Choose verdict</option>
                  <option value="supported">Supported</option>
                  <option value="contradicted">Contradicted</option>
                  <option value="not-established">Not established</option>
                  <option value="sources-disagree">Sources disagree</option>
                </select>
              </label>
              <label>
                Why this finding
                <textarea maxLength={WORKROOM_LIMITS.maxReasonLength} value={entry.reason} onChange={(event) => setEntry((current) => ({ ...current, reason: event.target.value }))} placeholder="Explain what the cited evidence establishes, conflicts with, or leaves open." />
                {characterLimit(entry.reason, WORKROOM_LIMITS.maxReasonLength)}
              </label>
              <div className="captured-citations">
                <strong>Exact source excerpts</strong>
                {entry.citations.length ? entry.citations.map((citation) => (
                  <div key={citation.id}>
                    <span>{citation.id} · {citation.sourceId}</span>
                    <q>{citation.quote}</q>
                    <button type="button" className="icon-action" aria-label={`Remove ${citation.id}`} onClick={() => setEntry((current) => ({ ...current, citations: current.citations.filter((item) => item.id !== citation.id) }))}>×</button>
                  </div>
                )) : <p>No source excerpt added yet.</p>}
              </div>
              <button type="button" onClick={addReview} disabled={state.reviews.length >= WORKROOM_LIMITS.maxReviews}>Save this claim check</button>
            </section>

            <section className="evidence-capture" aria-label="Source evidence capture">
              <h4>Add source excerpts</h4>
              <p>Select a passage in a source note. Its exact wording stays attached to this check.</p>
              {state.sources.map((source) => (
                <article key={source.id}>
                  <h5>{source.id} — {source.title}</h5>
                  <textarea
                    ref={(node) => { sourceEvidenceRefs.current[source.id] = node; }}
                    aria-label={`${source.id} evidence text`}
                    value={source.text}
                    readOnly
                  />
                  <button type="button" className="quiet-action" disabled={entry.citations.length >= WORKROOM_LIMITS.maxCitationsPerReview} onClick={() => captureSourceSelection(source.id)}>Add selected {source.id} excerpt</button>
                </article>
              ))}
            </section>
          </div>

          <section className="recorded-reviews" aria-label="Saved claim checks">
            <h4>Saved claim checks</h4>
            {state.reviews.length ? (
              <ul>
                {state.reviews.map((review) => (
                  <li key={review.id}>
                    <div>
                      <strong>{review.id} — {review.verdict}</strong>
                      <p><strong>Your claim:</strong> {review.claim}</p>
                      <p>“{review.draftQuote}”</p>
                      <p>{review.citations.map((citation) => `[${citation.sourceId}] “${citation.quote}”`).join(' · ')}</p>
                      <p>{review.reason}</p>
                    </div>
                    <button type="button" className="quiet-action" onClick={() => setState((current) => ({ ...current, reviews: current.reviews.filter((item) => item.id !== review.id) }))}>Remove</button>
                  </li>
                ))}
              </ul>
            ) : <p>No claim checks yet. You decide what needs checking.</p>}
          </section>

          <section className="criterion-decisions" aria-labelledby="criterion-review-title">
            <h4 id="criterion-review-title">Check the handoff criteria</h4>
            {state.criteria.map((criterion) => (
              <label key={criterion.id}>
                <span><strong>{criterion.id}</strong> {criterion.text}</span>
                <select
                  aria-label={`${criterion.id} manual review`}
                  value={criterion.review}
                  onChange={(event) => setState((current) => ({
                    ...current,
                    criteria: current.criteria.map((item) => item.id === criterion.id ? { ...item, review: event.target.value as typeof item.review } : item),
                  }))}
                >
                  <option value="not-reviewed">Not reviewed</option>
                  <option value="met">Met</option>
                  <option value="not-met">Not met</option>
                </select>
              </label>
            ))}
          </section>

          <label className="reviewer-note">
            Note for the next reviewer
            <textarea maxLength={WORKROOM_LIMITS.maxReviewerNoteLength} value={state.reviewerNote} onChange={(event) => changeReviewerNote(event.target.value)} placeholder="For example: check the delivery decision after the vendor replies." />
            {characterLimit(state.reviewerNote, WORKROOM_LIMITS.maxReviewerNoteLength)}
          </label>

          {authoredCase.mode === 'authored' ? (
            <details className="authored-reference">
              <summary>Compare with the practice reference</summary>
              <p>This reference applies only while this fictional case is unchanged. A match means your saved verdict and selected excerpts cover this fixed reference; it does not judge the rest of the draft or your explanation.</p>
              <p>{authoredCase.reference.introduction}</p>
              <ol>
                {authoredCase.reference.judgments.map((judgment) => {
                  const match = authoredCase.matches.find((item) => item.judgmentId === judgment.id);
                  return (
                    <li key={judgment.id}>
                      <strong>{judgment.verdict}</strong> — “{judgment.draftQuote}”
                      <p>{judgment.explanation}</p>
                      <p>{judgment.citations.map((citation) => `[${citation.sourceId}] “${citation.quote}”`).join(' · ')}</p>
                      <small>{match?.state === 'matches-reference' ? 'These saved checks cover the practice reference.' : match?.state === 'conflicting' ? 'Your saved checks disagree about this claim. Resolve them before using the reference.' : match?.state === 'different' ? 'Your verdict or selected excerpts differ from this reference; inspect the evidence together.' : 'Not reviewed by you yet.'}</small>
                    </li>
                  );
                })}
              </ol>
            </details>
          ) : (
            <p className="manual-boundary">{authoredCase.message}</p>
          )}
        </section>
      )}

      {stage === 'pack' && (
        <section className="review-pack" aria-labelledby="pack-title">
          <div className="workroom-subhead">
            <div>
              <h3 id="pack-title">Download handoff</h3>
              {unfinishedReview ? (
                <p className="unfinished-review-note"><strong>1 unfinished claim check is not in this handoff yet.</strong> Save it, return to it, or make that choice when you download.</p>
              ) : <p><strong>{statusLabel(summary.status)}</strong> for this draft version.</p>}
              <p>This reflects the checks recorded here. It does not confirm the whole draft is correct or approved.</p>
            </div>
          </div>
          <section className="unresolved-items" aria-labelledby="unresolved-title">
            <h4 id="unresolved-title">What still needs checking</h4>
            {summary.unresolvedItems.length ? (
              <ul>{summary.unresolvedItems.map((item) => <li key={`${item.kind}-${item.id}-${item.message}`}>{item.message}</li>)}</ul>
            ) : <p>No open item is recorded in these checks. A reviewer still decides whether to share the draft.</p>}
          </section>
          <div className="workroom-actions">
            <button type="button" onClick={() => requestDownload('markdown')}><Download aria-hidden="true" /> Download Markdown handoff</button>
            <button type="button" onClick={() => requestDownload('json')} disabled={!packReadiness.ok}><Download aria-hidden="true" /> Download JSON handoff</button>
            <label className="import-pack">
              <FileUp aria-hidden="true" /> Open JSON handoff
              <input type="file" accept="application/json,.json" onChange={(event) => { void importPack(event.target.files?.[0]); event.currentTarget.value = ''; }} />
            </label>
            <button type="button" className="quiet-action" onClick={requestClearWorkroom}><RotateCcw aria-hidden="true" /> Clear workroom</button>
          </div>
          <p className={`pack-capacity ${packReadiness.ok ? '' : 'pack-capacity-warning'}`}>
            {packReadiness.ok
              ? `JSON handoff is ${byteLabel(packReadiness.byteLength)} of the ${byteLabel(WORKROOM_LIMITS.maxPackBytes)} limit and can be reopened here.`
              : `JSON handoff needs attention before you can download it: ${packReadiness.error}`}
          </p>
          <section className="snapshot-history" aria-labelledby="history-title">
            <h4 id="history-title">Earlier checked versions</h4>
            {state.priorSnapshots.length ? state.priorSnapshots.map((snapshot) => (
              <details key={snapshot.id}>
                <summary>Previous checked version · {snapshot.status === 'ready-for-human-review' ? 'ready for review' : 'more checks needed'}</summary>
                <p>Archived {snapshot.archivedAt}.</p>
                <p><strong>Task:</strong> {snapshot.content.brief.task}</p>
                <p><strong>Exact draft:</strong></p>
                <pre>{snapshot.content.draft}</pre>
                <p>{snapshot.content.reviews.length} claim checks and {snapshot.content.criteria.length} criteria are preserved in this version and the downloaded handoff.</p>
                <details className="revision-detail"><summary>Revision detail</summary><p>Content fingerprint: <code>{snapshot.fingerprint}</code></p></details>
              </details>
            )) : <p>No earlier checked version is available in this browser session.</p>}
          </section>
        </section>
      )}

      <dialog
        ref={dialogRef}
        className="workroom-guard"
        aria-labelledby="workroom-guard-title"
        aria-describedby="workroom-guard-description"
        onCancel={(event) => {
          event.preventDefault();
          dismissGuard();
        }}
      >
        {guard && (
          <div>
            <h2 id="workroom-guard-title">{guardTitle}</h2>
            <p id="workroom-guard-description">{guardDescription}</p>
            {guard.error && <p className="workroom-guard-error" role="alert">{guard.error}</p>}
            <div className="workroom-guard-actions">
              {guard.action.kind === 'download' ? (
                <>
                  <button type="button" onClick={saveAndDownload}>Save claim check and download</button>
                  <button ref={safeDialogActionRef} type="button" className="quiet-action" onClick={returnToCheck}>Return to check</button>
                  <button type="button" className="quiet-action" onClick={() => downloadWithoutUnfinishedReview()}>Download without this check</button>
                  <button type="button" className="danger-action" onClick={() => downloadWithoutUnfinishedReview(true)}>Discard check and download</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={returnToHandoff}>Download handoff first</button>
                  <button ref={safeDialogActionRef} type="button" className="quiet-action" onClick={() => dismissGuard()}>Keep editing</button>
                  <button type="button" className="danger-action" onClick={continueReplacement}>Continue: {replacementActionLabel}</button>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>

      <p className="workroom-notice" aria-live="polite">{notice}</p>
    </section>
  );
});

export default Workroom;
