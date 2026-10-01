import React, { useState } from 'react';
import { ArrowRight, Clock, Target, AlertTriangle, BookCheck } from 'lucide-react';
import {
  SubjectName,
  AdaptiveTaskRecommendation,
  StudySession,
  MistakeItem,
  MasteryRecord,
} from '../types';
import { computeAdaptiveStudyQueue } from '../lib/adaptiveScheduler';

interface HomeViewProps {
  masteryList: MasteryRecord[];
  mistakes: MistakeItem[];
  sessions: StudySession[];
  onSelectAction: (subject: SubjectName, topic: string, nodeId: string, mode: string) => void;
  onOpenAsk: (prompt: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  masteryList,
  mistakes,
  sessions,
  onSelectAction,
  onOpenAsk,
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState<number>(20);

  // Compute live recommendations using the login-driven balancing formula
  const recommendations = computeAdaptiveStudyQueue({
    masteryList,
    mistakes,
    sessions,
    availableMinutes: selectedMinutes,
    wassceWeight: 0.65,
    satWeight: 0.35,
  });

  const primaryRecommendation = recommendations[0];
  const secondaryRecommendations = recommendations.slice(1, 4);

  const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
  const unresolvedMistakes = mistakes.filter((m) => !m.resolved);
  const criticalMistake = unresolvedMistakes[0];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      {/* Session Time Selector & Prompt */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
              What should I study?
            </h1>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              Ishizaki evaluates your curriculum progress, unresolved errors, and exam balance.
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white p-1 text-xs dark:border-stone-800 dark:bg-stone-900">
            <Clock className="ml-1.5 h-3.5 w-3.5 text-stone-500" />
            <span className="text-stone-500">Available:</span>
            {[5, 10, 20, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => setSelectedMinutes(mins)}
                className={`rounded px-2 py-1 font-medium transition-colors ${
                  selectedMinutes === mins
                    ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                    : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Primary Recommended Study Action */}
      {primaryRecommendation && (
        <section className="relative overflow-hidden rounded-xl border border-stone-300 bg-white p-6 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                <Target className="h-4 w-4" />
                <span>RECOMMENDED NEXT ACTION · {primaryRecommendation.track} ({selectedMinutes} MINS)</span>
              </div>
              <h2 className="font-serif text-xl font-bold text-stone-900 dark:text-stone-100">
                {primaryRecommendation.subject} — {primaryRecommendation.topic}
              </h2>
              <p className="text-sm text-stone-600 dark:text-stone-400">
                {primaryRecommendation.headlineReason}
              </p>
            </div>

            <button
              onClick={() =>
                onSelectAction(
                  primaryRecommendation.subject,
                  primaryRecommendation.topic,
                  primaryRecommendation.nodeId,
                  primaryRecommendation.activityType
                )
              }
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-stone-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              <span>{primaryRecommendation.actionLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Secondary Quick Queue & Checkpoints */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Last Learning Checkpoint */}
        <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              Last Studied Checkpoint
            </h3>
            <BookCheck className="h-4 w-4 text-stone-500" />
          </div>

          {lastSession ? (
            <div className="mt-3 space-y-2">
              <div className="font-serif text-base font-semibold text-stone-900 dark:text-stone-100">
                {lastSession.subject}: {lastSession.topic}
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400">
                Studied {lastSession.durationMinutes} minutes · {new Date(lastSession.timestamp).toLocaleDateString()}
              </p>
              <button
                onClick={() =>
                  onSelectAction(lastSession.subject, lastSession.topic, '', 'practice_drill')
                }
                className="mt-2 text-xs font-medium text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
              >
                Resume Topic →
              </button>
            </div>
          ) : (
            <div className="mt-3 text-xs text-stone-600 dark:text-stone-400">
              No recent study sessions logged. Launch your first study unit above to begin tracking.
            </div>
          )}
        </section>

        {/* Urgent Weakness & Mistake Bank Focus */}
        <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
              Attention Required
            </h3>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>

          {criticalMistake ? (
            <div className="mt-3 space-y-2">
              <div className="font-serif text-base font-semibold text-stone-900 dark:text-stone-100">
                {criticalMistake.subject}: {criticalMistake.topic}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Mistake category: {criticalMistake.errorCategory} error ({unresolvedMistakes.length} total errors in bank)
              </p>
              <button
                onClick={() =>
                  onSelectAction(criticalMistake.subject, criticalMistake.topic, criticalMistake.nodeId, 'beat_mistakes')
                }
                className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-800 dark:text-amber-400"
              >
                Repair This Weakness Now →
              </button>
            </div>
          ) : (
            <div className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
              All logged mistakes have been repaired. Run an Exam Mode sprint or practice drill to test retention.
            </div>
          )}
        </section>
      </div>

      {/* Alternative Study Queue Items */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
          Balanced Study Queue (Alternative Options)
        </h3>

        <div className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900/40">
          {secondaryRecommendations.map((rec) => (
            <div
              key={rec.nodeId}
              className="flex items-center justify-between p-4 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/40"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {rec.subject}
                  </span>
                  <span className="text-[11px] text-stone-500">· {rec.track}</span>
                </div>
                <div className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  {rec.topic}
                </div>
                <div className="text-xs text-stone-600 dark:text-stone-400">
                  {rec.headlineReason}
                </div>
              </div>

              <button
                onClick={() => onSelectAction(rec.subject, rec.topic, rec.nodeId, rec.activityType)}
                className="rounded border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Start
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Direct AI Study Prompt Bar */}
      <section className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900/30">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs font-semibold uppercase text-stone-600 dark:text-stone-400">Need specific guidance?</div>
            <div className="text-sm text-stone-800 dark:text-stone-200">
              Ask Ishizaki to teach any topic from scratch or break down a difficult problem.
            </div>
          </div>
          <button
            onClick={() => onOpenAsk('Teach me from zero: ')}
            className="rounded-lg bg-stone-200 px-4 py-2 text-xs font-medium text-stone-900 transition-colors hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700"
          >
            Open Ishizaki Tutor →
          </button>
        </div>
      </section>
    </div>
  );
};
