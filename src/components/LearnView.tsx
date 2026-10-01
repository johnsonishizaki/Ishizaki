import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Play,
  RotateCcw,
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit3,
  Search,
} from 'lucide-react';
import {
  SubjectName,
  CurriculumNode,
  MasteryRecord,
  MistakeItem,
  PersonalizedTextbook,
  AcademicPosition,
  ExamNodeStatus,
} from '../types';
import { SEED_CURRICULUM, ALL_SUBJECTS } from '../data/seedCurriculum';
import { computeExamCoverage, getRapidDiagnosticQuestions } from '../lib/examEngine';
import { askAI } from '../lib/aiClient';

interface LearnViewProps {
  initialSubject?: SubjectName;
  initialTopicNodeId?: string;
  initialMode?: string;
  masteryList: MasteryRecord[];
  mistakes: MistakeItem[];
  positions: Record<SubjectName, AcademicPosition>;
  textbooks: PersonalizedTextbook[];
  onSavePosition: (pos: AcademicPosition) => void;
  onSaveMastery: (record: MasteryRecord) => void;
  onSaveMistake: (mistake: MistakeItem) => void;
  onSaveTextbook: (tb: PersonalizedTextbook) => void;
  onOpenAskWithContext: (prompt: string, context?: string) => void;
}

export const LearnView: React.FC<LearnViewProps> = ({
  initialSubject = 'Mathematics',
  initialTopicNodeId,
  masteryList,
  mistakes,
  positions,
  textbooks,
  onSavePosition,
  onSaveMastery,
  onSaveMistake,
  onSaveTextbook,
  onOpenAskWithContext,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<SubjectName>(initialSubject);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExamMode, setIsExamMode] = useState(false);

  // Active Modals & Viewers
  const [activeTextbook, setActiveTextbook] = useState<PersonalizedTextbook | null>(null);
  const [activePracticeNode, setActivePracticeNode] = useState<CurriculumNode | null>(null);
  const [editingPosition, setEditingPosition] = useState(false);
  const [positionInput, setPositionInput] = useState('');

  // Practice runner state
  const [practiceQuestions, setPracticeQuestions] = useState<any[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [practiceScore, setPracticeScore] = useState({ correct: 0, total: 0 });

  // Exam Mode State
  const [examStatuses, setExamStatuses] = useState<Record<string, ExamNodeStatus>>({});

  // Filter nodes by subject & search query
  const subjectNodes = SEED_CURRICULUM.filter(
    (n) => n.subject === selectedSubject && (searchQuery === '' || n.topic.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentPosition = positions[selectedSubject];
  const subjectMistakes = mistakes.filter((m) => m.subject === selectedSubject && !m.resolved);

  // Helper to get mastery
  const getMastery = (nodeId: string): MasteryRecord => {
    return (
      masteryList.find((m) => m.nodeId === nodeId) || {
        nodeId,
        subject: selectedSubject,
        score: 0,
        status: 'NOT_STARTED',
        confidenceLevel: 1,
        attemptCount: 0,
        correctCount: 0,
        lastReviewedAt: '',
        nextReviewDue: '',
      }
    );
  };

  // Launch Practice
  const startPractice = (node: CurriculumNode, isMistakeBeatdown = false) => {
    setActivePracticeNode(node);
    setCurrentQIndex(0);
    setSelectedAnswer(null);
    setShowSolution(false);
    setShowHint(false);
    setPracticeScore({ correct: 0, total: 0 });

    if (isMistakeBeatdown) {
      const nodeMistakes = mistakes.filter((m) => m.nodeId === node.id && !m.resolved);
      if (nodeMistakes.length > 0) {
        setPracticeQuestions(
          nodeMistakes.map((m, idx) => ({
            id: `mistake-q-${idx}`,
            nodeId: node.id,
            subject: node.subject,
            track: node.track,
            prompt: m.studentPrompt,
            options: [m.correctAnswer, m.incorrectAnswer, 'Cannot be determined', 'None of the above'],
            correctAnswer: m.correctAnswer,
            stepByStepSolution: m.explanation,
            hints: [`Recall your earlier error: you identified this as a ${m.errorCategory} issue. Focus on the core theorem.`],
          }))
        );
        return;
      }
    }

    // Standard practice questions
    const diags = getRapidDiagnosticQuestions(node.id);
    setPracticeQuestions(diags);
  };

  // Handle Practice Answer Submission
  const handleAnswerSubmit = (option: string) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(option);
    setShowSolution(true);

    const currentQ = practiceQuestions[currentQIndex];
    const isCorrect = option.trim().toLowerCase() === currentQ.correctAnswer.trim().toLowerCase();

    setPracticeScore((prev) => ({
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      total: prev.total + 1,
    }));

    if (isCorrect) {
      // If was mistake, resolve it
      const existingMistake = mistakes.find((m) => m.nodeId === currentQ.nodeId && !m.resolved);
      if (existingMistake) {
        onSaveMistake({ ...existingMistake, resolved: true, updatedAt: new Date().toISOString() });
      }

      // Update Mastery
      const currentMastery = getMastery(currentQ.nodeId);
      const newScore = Math.min(100, currentMastery.score + 15);
      onSaveMastery({
        ...currentMastery,
        score: newScore,
        status: newScore >= 85 ? 'SECURE' : 'IN_PROGRESS',
        attemptCount: currentMastery.attemptCount + 1,
        correctCount: currentMastery.correctCount + 1,
        lastReviewedAt: new Date().toISOString(),
      });

      // Update Exam Mode status if active
      if (isExamMode) {
        setExamStatuses((prev) => ({
          ...prev,
          [currentQ.nodeId]: {
            nodeId: currentQ.nodeId,
            subject: currentQ.subject,
            topic: currentQ.underlyingConcept || currentQ.nodeId,
            status: 'COVERED',
            questionsTested: (prev[currentQ.nodeId]?.questionsTested || 0) + 1,
            questionsCorrect: (prev[currentQ.nodeId]?.questionsCorrect || 0) + 1,
            lastTestedAt: new Date().toISOString(),
          },
        }));
      }
    } else {
      // Record new mistake
      const newMistake: MistakeItem = {
        id: `mistake_${Date.now()}`,
        subject: currentQ.subject,
        topic: currentQ.underlyingConcept || activePracticeNode?.topic || 'Concept Drill',
        nodeId: currentQ.nodeId,
        studentPrompt: currentQ.prompt,
        incorrectAnswer: option,
        correctAnswer: currentQ.correctAnswer,
        errorCategory: 'method',
        explanation: currentQ.stepByStepSolution,
        recurrenceCount: 1,
        resolved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveMistake(newMistake);

      // Update Mastery downward or flag for review
      const currentMastery = getMastery(currentQ.nodeId);
      onSaveMastery({
        ...currentMastery,
        status: 'REVIEW_NEEDED',
        attemptCount: currentMastery.attemptCount + 1,
        lastReviewedAt: new Date().toISOString(),
      });

      if (isExamMode) {
        setExamStatuses((prev) => ({
          ...prev,
          [currentQ.nodeId]: {
            nodeId: currentQ.nodeId,
            subject: currentQ.subject,
            topic: currentQ.underlyingConcept || currentQ.nodeId,
            status: 'MAJOR_GAP',
            questionsTested: (prev[currentQ.nodeId]?.questionsTested || 0) + 1,
            questionsCorrect: prev[currentQ.nodeId]?.questionsCorrect || 0,
            lastTestedAt: new Date().toISOString(),
          },
        }));
      }
    }
  };

  // Launch or Generate Personalized Textbook
  const openTextbook = async (node: CurriculumNode) => {
    // Check if textbook already generated
    const existing = textbooks.find((tb) => tb.nodeId === node.id);
    if (existing) {
      setActiveTextbook(existing);
      return;
    }

    // Generate bespoke textbook chapter via AI
    const prompt = `Write a comprehensive, scholarly academic textbook chapter for Ghanaian Senior High School / SAT student on:
Subject: ${node.subject}
Topic: ${node.topic}
Focal Areas: ${node.focalAreas.join(', ')}
Prerequisites: ${node.prerequisites.join(', ')}
Exam Relevance: ${node.examRelevance}

Include:
1. Executive Summary & Core Principle
2. Thorough Step-by-Step Conceptual Breakdown (teach from fundamentals)
3. 2 Detailed Worked Examples showing exact mathematical/scientific calculations or prose analysis
4. Common Mistakes to avoid in WASSCE / SAT marking schemes
5. High-Yield Revision Summary formulas/rules`;

    try {
      const res = await askAI({
        prompt,
        systemInstruction: 'You are Ishizaki, an authoritative academic textbook author. Format output with clean markdown headings and rigorous clarity.',
        preferredTier: 'heavy',
      });

      const newTb: PersonalizedTextbook = {
        id: `tb_${node.id}`,
        subject: node.subject,
        topic: node.topic,
        nodeId: node.id,
        title: `${node.subject}: ${node.topic}`,
        targetLevel: node.level,
        adaptationNotes: 'Generated specifically for your curriculum position with full worked solutions.',
        chapters: [
          {
            id: `ch1`,
            title: node.topic,
            summary: `Core principles and exam criteria for ${node.topic}`,
            markdownContent: res.text,
            workedExamples: [],
            keyFormulas: node.focalAreas,
          },
        ],
        revisionNotes: `Key takeaway: Ensure solid grasp of ${node.focalAreas[0]} before advancing.`,
        practiceQuestions: [],
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSaveTextbook(newTb);
      setActiveTextbook(newTb);
    } catch (err) {
      console.error('Failed to generate textbook:', err);
    }
  };

  const examCoverageMatrix = computeExamCoverage(examStatuses);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* View Header with Mode Selector */}
      <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-center dark:border-stone-800">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            {isExamMode ? 'Exam Mode — Rapid Coverage & Gap Diagnosis' : 'Curriculum & Learning Engine'}
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            {isExamMode
              ? 'Rapidly sweeps topics to confirm secure mastery or diagnose revision gaps.'
              : 'Select a subject, inspect your current coordinates, read textbooks, or beat errors.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExamMode(!isExamMode)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              isExamMode
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{isExamMode ? 'Exit Exam Mode' : 'Enter Exam Mode'}</span>
          </button>
        </div>
      </div>

      {/* 9 Subjects Navigation Bar */}
      <div className="flex overflow-x-auto pb-2 scrollbar-none">
        <div className="flex gap-1.5">
          {ALL_SUBJECTS.map((subject) => (
            <button
              key={subject}
              onClick={() => {
                setSelectedSubject(subject);
                setSearchQuery('');
              }}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedSubject === subject
                  ? 'bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:bg-stone-800 dark:text-stone-400 dark:hover:text-stone-100'
              }`}
            >
              {subject}
            </button>
          ))}
        </div>
      </div>

      {/* Current Academic Coordinates Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900/50">
        <div className="space-y-0.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
            Current Academic Position ({selectedSubject})
          </div>
          <div className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
            {currentPosition ? currentPosition.topic : 'Position not set yet'}
          </div>
          <div className="text-xs text-stone-600 dark:text-stone-400">
            {currentPosition?.strand ? `Strand: ${currentPosition.strand}` : 'Ishizaki teaches starting from this coordinate.'}
          </div>
        </div>

        <button
          onClick={() => {
            setPositionInput(currentPosition?.topic || '');
            setEditingPosition(true);
          }}
          className="flex items-center gap-1.5 rounded border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Edit Position</span>
        </button>
      </div>

      {/* Exam Mode Coverage Grid (When Active) */}
      {isExamMode && (
        <section className="space-y-4 rounded-xl border border-amber-300 bg-amber-50/50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
              Exam Coverage Matrix (All 9 Disciplines)
            </h2>
            <span className="text-xs text-stone-600 dark:text-stone-400">Target Year: 2028</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {examCoverageMatrix.map((matrix) => (
              <div
                key={matrix.subject}
                className="rounded-lg border border-stone-200 bg-white p-3 text-xs dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="font-semibold text-stone-900 dark:text-stone-100">{matrix.subject}</div>
                <div className="mt-1 flex items-center justify-between text-stone-600 dark:text-stone-400">
                  <span>Coverage: {matrix.percentageCovered}%</span>
                  <span>{matrix.totalNodes} Topics</span>
                </div>
                <div className="mt-2 flex gap-1">
                  <div
                    className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${(matrix.coveredCount / matrix.totalNodes) * 100}%` }}
                    title={`Covered: ${matrix.coveredCount}`}
                  />
                  <div
                    className="h-1.5 rounded-full bg-amber-500"
                    style={{ width: `${(matrix.needsReviewCount / matrix.totalNodes) * 100}%` }}
                    title={`Needs Review: ${matrix.needsReviewCount}`}
                  />
                  <div
                    className="h-1.5 rounded-full bg-rose-500"
                    style={{ width: `${(matrix.majorGapCount / matrix.totalNodes) * 100}%` }}
                    title={`Major Gaps: ${matrix.majorGapCount}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Topic Search & Unresolved Mistake Alerts */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${selectedSubject} topics...`}
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-4 text-xs text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100"
          />
        </div>

        {subjectMistakes.length > 0 && (
          <button
            onClick={() => {
              const nodeWithMistake = subjectNodes.find((n) =>
                subjectMistakes.some((m) => m.nodeId === n.id)
              );
              if (nodeWithMistake) startPractice(nodeWithMistake, true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Beat My Mistakes ({subjectMistakes.length})</span>
          </button>
        )}
      </div>

      {/* Curriculum Topic List */}
      <div className="space-y-4">
        {subjectNodes.map((node) => {
          const mastery = getMastery(node.id);
          const hasMistakes = mistakes.some((m) => m.nodeId === node.id && !m.resolved);

          return (
            <div
              key={node.id}
              className="rounded-xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-sm dark:border-stone-800 dark:bg-stone-900/60"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {node.strand}
                    </span>
                    <span className="text-xs text-stone-400">/</span>
                    <span className="text-xs text-stone-600 dark:text-stone-400">{node.subStrand}</span>
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                      {node.level}
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                    {node.topic}
                  </h3>

                  <div className="text-xs text-stone-600 dark:text-stone-400">
                    <span className="font-medium text-stone-700 dark:text-stone-300">Focal Areas: </span>
                    {node.focalAreas.join(' · ')}
                  </div>

                  {/* Provenance note */}
                  <div className="text-[11px] text-stone-600 dark:text-stone-400">
                    Source: {node.provenance.sourceTitle} ({node.provenance.datasetVersion})
                  </div>
                </div>

                {/* Mastery status badge & score */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded px-2.5 py-1 text-xs font-semibold ${
                      mastery.status === 'SECURE'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : mastery.status === 'REVIEW_NEEDED'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : mastery.status === 'IN_PROGRESS'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                    }`}
                  >
                    {mastery.status.replace('_', ' ')} ({mastery.score}%)
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                <button
                  onClick={() => openTextbook(node)}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Personalized Textbook</span>
                </button>

                <button
                  onClick={() => startPractice(node, false)}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Practice Questions</span>
                </button>

                <button
                  onClick={() =>
                    onOpenAskWithContext(
                      `Teach me ${node.topic} in ${node.subject} from zero. Start from fundamentals and test my understanding progressively.`,
                      `Subject: ${node.subject}, Topic: ${node.topic}, Focal Areas: ${node.focalAreas.join(', ')}`
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>Teach From Zero</span>
                </button>

                {hasMistakes && (
                  <button
                    onClick={() => startPractice(node, true)}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Beat Mistakes</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Current Academic Coordinates Modal */}
      {editingPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-stone-900">
            <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
              Set Current Coordinate for {selectedSubject}
            </h3>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Tell Ishizaki what topic you are currently learning in class so your study sessions start here.
            </p>

            <div className="mt-4 space-y-3">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Choose or Enter Current Topic:
              </label>
              <input
                type="text"
                value={positionInput}
                onChange={(e) => setPositionInput(e.target.value)}
                placeholder="e.g. Simultaneous Equations, Vectors, Motion..."
                className="w-full rounded-lg border border-stone-300 p-2.5 text-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />

              <div className="space-y-1">
                <span className="text-[11px] text-stone-500">Suggested Topics from Syllabus:</span>
                <div className="flex flex-wrap gap-1">
                  {subjectNodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setPositionInput(n.topic)}
                      className="rounded border border-stone-200 px-2 py-0.5 text-[11px] text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                    >
                      {n.topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditingPosition(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const matchedNode = subjectNodes.find((n) => n.topic === positionInput);
                  onSavePosition({
                    subject: selectedSubject,
                    currentTopicId: matchedNode?.id || 'custom',
                    currentStrand: matchedNode?.strand || 'General',
                    topic: positionInput || 'Foundations',
                    updatedAt: new Date().toISOString(),
                  });
                  setEditingPosition(false);
                }}
                className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
              >
                Save Position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Practice Question Runner Modal */}
      {activePracticeNode && practiceQuestions.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl dark:bg-stone-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 dark:border-stone-800">
              <div>
                <span className="text-[11px] font-semibold uppercase text-stone-500">
                  Question {currentQIndex + 1} of {practiceQuestions.length}
                </span>
                <h3 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                  {activePracticeNode.subject} · {activePracticeNode.topic}
                </h3>
              </div>
              <button
                onClick={() => setActivePracticeNode(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            {/* Question Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="text-sm font-medium leading-relaxed text-stone-900 dark:text-stone-100">
                {practiceQuestions[currentQIndex]?.prompt}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {practiceQuestions[currentQIndex]?.options?.map((opt: string, idx: number) => {
                  const isChosen = selectedAnswer === opt;
                  const isTarget =
                    practiceQuestions[currentQIndex].correctAnswer.trim().toLowerCase() ===
                    opt.trim().toLowerCase();

                  let btnStyle = 'border-stone-200 hover:border-stone-400 bg-white dark:bg-stone-800 dark:border-stone-700';
                  if (selectedAnswer !== null) {
                    if (isTarget) {
                      btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200';
                    } else if (isChosen && !isTarget) {
                      btnStyle = 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={selectedAnswer !== null}
                      onClick={() => handleAnswerSubmit(opt)}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-xs transition-colors ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {selectedAnswer !== null && isTarget && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 ml-2" />
                      )}
                      {selectedAnswer !== null && isChosen && !isTarget && (
                        <XCircle className="h-4 w-4 text-rose-600 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Hint Accordion */}
              {practiceQuestions[currentQIndex]?.hints?.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{showHint ? 'Hide Hint' : 'Need a Hint? (Guided Reasoning)'}</span>
                  </button>
                  {showHint && (
                    <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                      {practiceQuestions[currentQIndex]?.hints[0]}
                    </div>
                  )}
                </div>
              )}

              {/* Worked Solution */}
              {showSolution && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-xs dark:border-stone-800 dark:bg-stone-800/40">
                  <div className="font-semibold text-stone-900 dark:text-stone-100">Step-by-Step Solution:</div>
                  <p className="mt-1 text-stone-700 dark:text-stone-300">
                    {practiceQuestions[currentQIndex]?.stepByStepSolution}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-stone-200 px-6 py-4 dark:border-stone-800">
              <span className="text-xs text-stone-500">
                Score: {practiceScore.correct} / {practiceScore.total}
              </span>

              {selectedAnswer !== null && (
                <button
                  onClick={() => {
                    if (currentQIndex + 1 < practiceQuestions.length) {
                      setCurrentQIndex(currentQIndex + 1);
                      setSelectedAnswer(null);
                      setShowSolution(false);
                      setShowHint(false);
                    } else {
                      setActivePracticeNode(null);
                    }
                  }}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
                >
                  {currentQIndex + 1 < practiceQuestions.length ? 'Next Question →' : 'Complete Drill'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Personalized Textbook Viewer Modal */}
      {activeTextbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl bg-[#FBFBF9] shadow-2xl dark:bg-[#121316]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 dark:border-stone-800">
              <div>
                <span className="text-[11px] font-semibold uppercase text-stone-500">
                  {activeTextbook.subject} · {activeTextbook.targetLevel}
                </span>
                <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
                  {activeTextbook.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveTextbook(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            {/* Textbook Reading Body */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6 font-serif">
              {activeTextbook.chapters.map((ch) => (
                <div key={ch.id} className="space-y-4">
                  <h4 className="border-b border-stone-200 pb-2 text-xl font-bold text-stone-900 dark:border-stone-800 dark:text-stone-100">
                    {ch.title}
                  </h4>
                  <div className="prose max-w-none text-sm leading-relaxed text-stone-800 dark:prose-invert dark:text-stone-200">
                    <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
                      {ch.markdownContent}
                    </pre>
                  </div>
                </div>
              ))}

              {/* Revision Marginalia */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 font-sans text-xs dark:border-stone-800 dark:bg-stone-900">
                <div className="font-semibold text-stone-900 dark:text-stone-100">Personal Revision Notes:</div>
                <p className="mt-1 text-stone-600 dark:text-stone-400">{activeTextbook.revisionNotes}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-stone-200 px-6 py-3 font-sans text-xs dark:border-stone-800">
              <span className="text-stone-500">Stored locally in IndexedDB · Available Offline</span>
              <button
                onClick={() => {
                  const node = SEED_CURRICULUM.find((n) => n.id === activeTextbook.nodeId);
                  setActiveTextbook(null);
                  if (node) startPractice(node, false);
                }}
                className="rounded-lg bg-stone-900 px-4 py-2 font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
              >
                Test Myself on This Chapter →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
