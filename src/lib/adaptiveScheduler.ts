import {
  SubjectName,
  CurriculumNode,
  MasteryRecord,
  MistakeItem,
  StudySession,
  AdaptiveTaskRecommendation,
} from '../types';
import { SEED_CURRICULUM } from '../data/seedCurriculum';

export interface SchedulerContext {
  masteryList: MasteryRecord[];
  mistakes: MistakeItem[];
  sessions: StudySession[];
  availableMinutes: number;
  wassceWeight?: number; // default 0.65
  satWeight?: number;    // default 0.35
}

export function computeAdaptiveStudyQueue(context: SchedulerContext): AdaptiveTaskRecommendation[] {
  const {
    masteryList,
    mistakes,
    sessions,
    availableMinutes,
    wassceWeight = 0.65,
    satWeight = 0.35,
  } = context;

  const now = Date.now();

  // Create fast lookup maps
  const masteryMap = new Map<string, MasteryRecord>();
  masteryList.forEach((m) => masteryMap.set(m.nodeId, m));

  const unresolvedMistakesBySubject = new Map<SubjectName, number>();
  const unresolvedMistakesByNode = new Map<string, MistakeItem[]>();
  mistakes.forEach((mistake) => {
    if (!mistake.resolved) {
      unresolvedMistakesBySubject.set(
        mistake.subject,
        (unresolvedMistakesBySubject.get(mistake.subject) || 0) + 1
      );
      const list = unresolvedMistakesByNode.get(mistake.nodeId) || [];
      list.push(mistake);
      unresolvedMistakesByNode.set(mistake.nodeId, list);
    }
  });

  // Calculate days since each subject was studied
  const daysSinceStudied = new Map<SubjectName, number>();
  sessions.forEach((s) => {
    const diffDays = Math.max(0, (now - new Date(s.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    const current = daysSinceStudied.get(s.subject);
    if (current === undefined || diffDays < current) {
      daysSinceStudied.set(s.subject, diffDays);
    }
  });

  const recommendations: AdaptiveTaskRecommendation[] = [];

  for (const node of SEED_CURRICULUM) {
    const mastery = masteryMap.get(node.id);
    const masteryScore = mastery ? mastery.score : 0;
    const masteryRatio = masteryScore / 100;

    const baseTrackWeight = node.track === 'WASSCE' ? wassceWeight : satWeight;
    const daysNeglected = daysSinceStudied.get(node.subject) ?? 14;
    const nodeMistakes = unresolvedMistakesByNode.get(node.id) || [];
    const subjectMistakes = unresolvedMistakesBySubject.get(node.subject) || 0;

    // Balancing Formula:
    // Weight = trackWeight * (1 + daysNeglected/7) * (1 + mistakes/4) * (1 - masteryRatio)
    const neglectMultiplier = 1 + Math.min(daysNeglected, 30) / 7;
    const mistakeMultiplier = 1 + Math.min(subjectMistakes + nodeMistakes.length * 2, 20) / 4;
    const gapMultiplier = 1.2 - masteryRatio * 0.8;

    const priorityScore = Math.round(baseTrackWeight * neglectMultiplier * mistakeMultiplier * gapMultiplier * 100);

    // Determine highest ROI activity type based on available time & current state
    let activityType: AdaptiveTaskRecommendation['activityType'] = 'practice_drill';
    let headlineReason = '';
    let actionLabel = 'Start Practice Drill';

    if (nodeMistakes.length > 0) {
      activityType = 'beat_mistakes';
      headlineReason = `${nodeMistakes.length} unresolved mistake${nodeMistakes.length > 1 ? 's' : ''} in ${node.topic}`;
      actionLabel = 'Beat My Mistakes';
    } else if (masteryScore < 30) {
      activityType = availableMinutes >= 20 ? 'teach_from_zero' : 'practice_drill';
      headlineReason = `Low concept confidence (${masteryScore}%); build foundation`;
      actionLabel = 'Teach From Zero';
    } else if (availableMinutes >= 35) {
      activityType = 'deep_textbook';
      headlineReason = `Uninterrupted block available for ${node.topic}`;
      actionLabel = 'Study Custom Textbook';
    } else if (availableMinutes <= 10) {
      activityType = 'practice_drill';
      headlineReason = `Quick recall sprint (${availableMinutes} min available)`;
      actionLabel = 'Rapid 5-Question Drill';
    } else {
      activityType = 'practice_drill';
      headlineReason = `Curriculum balance & spaced reinforcement`;
      actionLabel = 'Advance Mastery';
    }

    recommendations.push({
      subject: node.subject,
      topic: node.topic,
      nodeId: node.id,
      track: node.track,
      activityType,
      priorityScore,
      estimatedMinutes: Math.min(availableMinutes, 25),
      headlineReason,
      actionLabel,
    });
  }

  // Sort descending by priority score
  return recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
}
