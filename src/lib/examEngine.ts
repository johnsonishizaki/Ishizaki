import { SubjectName, ExamStatus, ExamNodeStatus, PracticeQuestion } from '../types';
import { SEED_CURRICULUM } from '../data/seedCurriculum';

export interface ExamCoverageSummary {
  subject: SubjectName;
  totalNodes: number;
  coveredCount: number;
  needsReviewCount: number;
  majorGapCount: number;
  notCoveredCount: number;
  percentageCovered: number;
}

export function computeExamCoverage(nodeStatuses: Record<string, ExamNodeStatus>): ExamCoverageSummary[] {
  const subjects: SubjectName[] = [
    'Mathematics',
    'Additional Mathematics',
    'Physics',
    'Chemistry',
    'Biology',
    'Computing',
    'English Language',
    'Social Studies',
    'SAT',
  ];

  return subjects.map((subject) => {
    const nodes = SEED_CURRICULUM.filter((n) => n.subject === subject);
    let covered = 0;
    let review = 0;
    let gap = 0;
    let notCovered = 0;

    nodes.forEach((n) => {
      const st = nodeStatuses[n.id]?.status || 'NOT_COVERED';
      if (st === 'COVERED') covered++;
      else if (st === 'NEEDS_REVIEW') review++;
      else if (st === 'MAJOR_GAP') gap++;
      else notCovered++;
    });

    const total = nodes.length;
    const percentage = total > 0 ? Math.round(((covered + review * 0.5) / total) * 100) : 0;

    return {
      subject,
      totalNodes: total,
      coveredCount: covered,
      needsReviewCount: review,
      majorGapCount: gap,
      notCoveredCount: notCovered,
      percentageCovered: percentage,
    };
  });
}

// Built-in rapid diagnostic questions generator for fast offline exam coverage check
export function getRapidDiagnosticQuestions(nodeId: string): PracticeQuestion[] {
  const node = SEED_CURRICULUM.find((n) => n.id === nodeId);
  if (!node) return [];

  // Deterministic high-yield diagnostic questions for each node
  if (node.id === 'math-nums-01') {
    return [
      {
        id: 'diag-m1',
        nodeId,
        subject: node.subject,
        track: node.track,
        difficulty: 'standard',
        questionType: 'multiple_choice',
        prompt: 'Simplify the surd expression: (3√2 + 2√3)(3√2 - 2√3)',
        options: ['6', '12', '18', '24'],
        correctAnswer: '6',
        stepByStepSolution: '(3√2)^2 - (2√3)^2 = 9(2) - 4(3) = 18 - 12 = 6.',
        hints: ['Use the difference of two squares identity: (a+b)(a-b) = a^2 - b^2.'],
        underlyingConcept: 'Surds and Difference of Squares',
      },
      {
        id: 'diag-m2',
        nodeId,
        subject: node.subject,
        track: node.track,
        difficulty: 'standard',
        questionType: 'multiple_choice',
        prompt: 'If log₁₀(x) + log₁₀(x - 3) = 1, find x.',
        options: ['5', '-2', '5 and -2', '10'],
        correctAnswer: '5',
        stepByStepSolution: 'log₁₀(x(x - 3)) = 1 => x² - 3x = 10 => x² - 3x - 10 = 0 => (x - 5)(x + 2) = 0. Since log is only defined for positive numbers, x = 5.',
        hints: ['Combine logs using product law: log(a) + log(b) = log(ab). Remember argument must be positive.'],
        underlyingConcept: 'Logarithmic equations and domain constraints',
      },
    ];
  }

  if (node.id === 'addmath-calc-01') {
    return [
      {
        id: 'diag-am1',
        nodeId,
        subject: node.subject,
        track: node.track,
        difficulty: 'standard',
        questionType: 'multiple_choice',
        prompt: 'Find the gradient of the curve y = 3x² - 5x + 2 at the point x = 2.',
        options: ['7', '5', '12', '4'],
        correctAnswer: '7',
        stepByStepSolution: 'dy/dx = 6x - 5. At x = 2, dy/dx = 6(2) - 5 = 12 - 5 = 7.',
        hints: ['Differentiate using the power rule d/dx[xⁿ] = n·xⁿ⁻¹.'],
        underlyingConcept: 'First derivative as tangent gradient',
      },
    ];
  }

  if (node.id === 'phy-mech-01') {
    return [
      {
        id: 'diag-p1',
        nodeId,
        subject: node.subject,
        track: node.track,
        difficulty: 'standard',
        questionType: 'multiple_choice',
        prompt: 'A car accelerates uniformly from rest at 2.5 m/s² for 8 seconds. What distance does it cover?',
        options: ['80 m', '40 m', '160 m', '20 m'],
        correctAnswer: '80 m',
        stepByStepSolution: 's = ut + (1/2)at². With u = 0: s = (1/2)(2.5)(8²) = 1.25 * 64 = 80 m.',
        hints: ['Use the SUVAT kinematic equation relating distance, initial velocity, acceleration, and time.'],
        underlyingConcept: 'Uniform linear motion (SUVAT)',
      },
    ];
  }

  if (node.id === 'chem-phys-01') {
    return [
      {
        id: 'diag-c1',
        nodeId,
        subject: node.subject,
        track: node.track,
        difficulty: 'standard',
        questionType: 'multiple_choice',
        prompt: 'What volume does 0.5 moles of an ideal gas occupy at standard temperature and pressure (STP)?',
        options: ['11.2 dm³', '22.4 dm³', '44.8 dm³', '5.6 dm³'],
        correctAnswer: '11.2 dm³',
        stepByStepSolution: '1 mole of gas at STP occupies 22.4 dm³. Therefore 0.5 * 22.4 = 11.2 dm³.',
        hints: ['Molar volume of ideal gas at standard STP is 22.4 dm³/mol.'],
        underlyingConcept: 'Molar gas volume at STP',
      },
    ];
  }

  // Generic diagnostic fallback question
  return [
    {
      id: `diag-${node.id}-1`,
      nodeId,
      subject: node.subject,
      track: node.track,
      difficulty: 'standard',
      questionType: 'multiple_choice',
      prompt: `Which of the following principles forms the primary core foundation of "${node.topic}" in ${node.subject}?`,
      options: [
        node.focalAreas[0] || 'Core theoretical foundation',
        'Arbitrary unrelated rule',
        'Obsolete legacy hypothesis',
        'Contradictory physical property',
      ],
      correctAnswer: node.focalAreas[0] || 'Core theoretical foundation',
      stepByStepSolution: `The focal area for ${node.topic} is specifically defined in the curriculum as: ${node.focalAreas.join('; ')}.`,
      hints: ['Review the official syllabus definition and learning objectives.'],
      underlyingConcept: node.topic,
    },
  ];
}
