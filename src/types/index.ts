/**
 * Academic Data Models and Core Type Definitions for Ishizaki Academic OS
 */

export type SubjectName =
  | 'Mathematics'
  | 'Additional Mathematics'
  | 'Physics'
  | 'Chemistry'
  | 'Biology'
  | 'Computing'
  | 'English Language'
  | 'Social Studies'
  | 'SAT';

export type ExamTrack = 'WASSCE' | 'SAT';

export type SHSLevel = 'SHS 1' | 'SHS 2' | 'SHS 3' | 'SAT Prep';

export type MasteryStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'REVIEW_NEEDED' | 'SECURE';

export type ErrorCategory =
  | 'conceptual'
  | 'method'
  | 'calculation'
  | 'careless'
  | 'misread';

export interface CurriculumProvenance {
  sourceTitle: string;
  sourceType: 'NaCCA_CURRICULUM' | 'MOE_TEACHER_MANUAL' | 'WAEC_SYLLABUS' | 'COLLEGE_BOARD_SPECS';
  datasetVersion: string;
  verifiedDate: string;
}

export interface CurriculumNode {
  id: string; // e.g., 'math-alg-01'
  subject: SubjectName;
  track: ExamTrack;
  level: SHSLevel;
  strand: string;
  subStrand: string;
  topic: string;
  focalAreas: string[];
  prerequisites: string[];
  examRelevance: string; // High, Medium, Core
  provenance: CurriculumProvenance;
}

export interface AcademicPosition {
  subject: SubjectName;
  currentTopicId: string;
  currentStrand?: string;
  topic: string;
  strand?: string;
  notes?: string;
  updatedAt: string;
}

export interface MasteryRecord {
  nodeId: string;
  subject: SubjectName;
  score: number; // 0-100
  status: MasteryStatus;
  confidenceLevel: number; // 1-5
  attemptCount: number;
  correctCount: number;
  lastReviewedAt: string;
  nextReviewDue: string;
}

export interface MistakeItem {
  id: string;
  questionId?: string;
  subject: SubjectName;
  topic: string;
  nodeId: string;
  studentPrompt: string;
  incorrectAnswer: string;
  correctAnswer: string;
  errorCategory: ErrorCategory;
  explanation: string;
  recurrenceCount: number;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TextbookChapter {
  id: string;
  title: string;
  summary: string;
  markdownContent: string;
  diagrams?: Array<{
    id: string;
    caption: string;
    type: 'geometry' | 'chemical_structure' | 'flowchart' | 'data_curve';
    svgOrAscii: string;
  }>;
  workedExamples: Array<{
    problem: string;
    solutionSteps: string[];
    keyInsight: string;
  }>;
  keyFormulas: string[];
}

export interface PersonalizedTextbook {
  id: string;
  subject: SubjectName;
  topic: string;
  nodeId: string;
  title: string;
  targetLevel: string;
  adaptationNotes: string;
  chapters: TextbookChapter[];
  revisionNotes: string;
  practiceQuestions: PracticeQuestion[];
  generatedAt: string;
  updatedAt: string;
}

export interface PracticeQuestion {
  id: string;
  nodeId: string;
  subject: SubjectName;
  track: ExamTrack;
  difficulty: 'foundation' | 'standard' | 'advanced' | 'exam_challenge';
  questionType: 'multiple_choice' | 'free_response';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  stepByStepSolution: string;
  hints: string[];
  underlyingConcept: string;
}

export interface StudySession {
  id: string;
  subject: SubjectName;
  topic: string;
  durationMinutes: number;
  plannedMinutes: number;
  actionsCompleted: string[];
  weaknessesAddressed: string[];
  scoreChange: number;
  timestamp: string;
}

export interface AdaptiveTaskRecommendation {
  subject: SubjectName;
  topic: string;
  nodeId: string;
  track: ExamTrack;
  activityType: 'teach_from_zero' | 'beat_mistakes' | 'practice_drill' | 'exam_sprint' | 'deep_textbook';
  priorityScore: number;
  estimatedMinutes: number;
  headlineReason: string;
  actionLabel: string;
}

export interface VaultFileRecord {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  subject?: SubjectName;
  folder: string;
  b2Key: string;
  downloadUrl?: string;
  localDataUrl?: string; // For offline viewing or direct upload preview
  extractedText?: string;
  aiIndexed: boolean;
  offlineCached: boolean;
  uploadedAt: string;
}

export type ExamStatus = 'COVERED' | 'NEEDS_REVIEW' | 'MAJOR_GAP' | 'NOT_COVERED';

export interface ExamNodeStatus {
  nodeId: string;
  subject: SubjectName;
  topic: string;
  status: ExamStatus;
  questionsTested: number;
  questionsCorrect: number;
  lastTestedAt?: string;
}

export interface SystemTestResult {
  testId: string;
  category: 'core' | 'ai_cascade' | 'offline' | 'vault' | 'sync' | 'learning';
  name: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  latencyMs?: number;
  details: string;
  timestamp: string;
}

export interface UserAcademicProfile {
  userId: string;
  email: string;
  name: string;
  educationLevel: 'SHS 1' | 'SHS 2' | 'SHS 3';
  examTargetYear: number;
  wassceWeight: number; // e.g. 0.65
  satWeight: number;    // e.g. 0.35
  preferences: {
    defaultSessionMinutes: number;
    explanationDepth: 'concise' | 'standard' | 'deep';
    exampleDensity: 'minimal' | 'balanced' | 'heavy';
    showStepByStepWorking: boolean;
  };
  startingPositionsSet: boolean;
  createdAt: string;
  updatedAt: string;
}
