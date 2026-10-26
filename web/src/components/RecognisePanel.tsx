
import { HelpCircle, Undo2, Trash2, Volume2, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Session, SessionSnapshot } from '../app/session';
import type { Decision } from '../ml/decision';
import type { LoadedModel } from '../ml/model-client';
import { GuessList } from './GuessList';
import { Percent } from './ui';

interface HistoryEntry {
  id: number;
  decision: Decision;
}

const HISTORY = 8;

function notSureText(decision: Decision): string {
  if (decision.reason === 'partial')
    return 'Move back so your shoulders are in view, then sign again.';
  return 'None of the supported signs fit well enough. Try again, a little slower.';
}

export function RecognisePanel({
  session,
  snap,
  model,
}: {
  session: Session;
  snap: SessionSnapshot;
  model: LoadedModel;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sentence, setSentence] = useState<string[]>([]);

  useEffect(
    () =>
      session.onResult((result, id) => {
        setHistory((h) => [{ id, decision: result.decision }, ...h].slice(0, HISTORY));

        const best = result.decision.top[0];
        if (result.decision.kind === 'sign' && best) {
          const label = model.labels[best.index]?.label;
          if (label) setSentence((words) => [...words, label]);
        }
      }),
    [session, model],
  );

  const latest = history[0];
  const labels = model.labels;
  const shipped = labels.filter((l) => l.shipped).length;
  const decision = latest?.decision;
  const top = decision?.top[0];

  function speakText() {
    const text = sentence.join(' ');
    if (!text || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  async function copyText() {
    if (sentence.length === 0) return;
    try {
      await navigator.clipboard.writeText(sentence.join(' '));
    } catch {
      // Clipboard access may be unavailable outside a secure browser context.
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted">
        Sign one of the {shipped} supported ASL signs. Lower your hands or pause briefly to finish a sign.
      </p>

      <div className="rounded-xl border border-line bg-paper p-4" aria-live="polite" data-testid="recognise-result">
        {snap.signing ? (
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-accent">
            <span aria-hidden className="pulse-dot size-2 rounded-full bg-accent" />
            Reading your sign…
          </p>
        ) : null}

        {!decision ? (
          <p className="text-sm text-ink-muted">Your result appears here after each sign.</p>
        ) : decision.kind === 'sign' && top ? (
          <div>
            <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">You signed</p>
            <p className="mt-0.5 text-3xl font-semibold tracking-tight">{labels[top.index]?.label}</p>
            <p className="mt-1 text-sm text-ink-muted"><Percent value={top.probability} /> confident</p>
          </div>
        ) : decision.kind === 'not-sure' ? (
          <div>
            <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <HelpCircle aria-hidden className="size-6 text-warn" /> Not sure
            </p>
            <p className="mt-1 text-sm text-ink-muted">{notSureText(decision)}</p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Nothing to read in that clip.</p>
        )}
      </div>

      <section className="rounded-xl border border-line p-4" aria-label="Sentence builder">
        <h3 className="font-semibold">SkillBridge text builder</h3>
        <p className="mt-1 min-h-12 break-words text-lg" aria-live="polite">
          {sentence.join(' ') || 'Your recognized signs will appear here.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-muted"
            onClick={() => setSentence((words) => words.slice(0, -1))}>
            <Undo2 className="mr-1 inline size-4" /> Undo
          </button>
          <button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-muted"
            onClick={() => setSentence([])}>
            <Trash2 className="mr-1 inline size-4" /> Clear
          </button>
          <button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-muted"
            onClick={() => void copyText()}>
            <Copy className="mr-1 inline size-4" /> Copy text
          </button>
          <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            onClick={speakText} disabled={sentence.length === 0}>
            <Volume2 className="mr-1 inline size-4" /> Speak text
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Recognized labels are added automatically. These labels are not necessarily grammatical sentences.
        </p>
      </section>

      {decision && decision.top.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Top guesses</h3>
          <GuessList guesses={decision.top} labels={labels} muted={decision.kind !== 'sign'} />
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent signs</h3>
        {history.length === 0 ? (
          <p className="text-sm text-ink-muted">None yet.</p>
        ) : (
          <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Recent signs" data-testid="history">
            {history.map((entry) => {
              const best = entry.decision.top[0];
              const named = entry.decision.kind === 'sign' && best;
              return (
                <li key={entry.id} className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
                  named ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface-muted text-ink-muted'
                }`}>
                  {named ? labels[best.index]?.label : 'Not sure'}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
