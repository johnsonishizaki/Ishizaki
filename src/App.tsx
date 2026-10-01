/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { LearnView } from './components/LearnView';
import { VaultView } from './components/VaultView';
import { AskView } from './components/AskView';
import { SystemDiagnosticsView } from './components/SystemDiagnosticsView';
import { AuthModal } from './components/AuthModal';

import {
  SubjectName,
  MasteryRecord,
  MistakeItem,
  PersonalizedTextbook,
  AcademicPosition,
  VaultFileRecord,
  StudySession,
} from './types';
import { idb } from './lib/indexedDB';
import { syncEngine, SyncState } from './lib/syncEngine';
import { isSessionActive, terminateSession } from './lib/auth';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'learn' | 'vault' | 'ask' | 'system'>('home');
  const [syncState, setSyncState] = useState<SyncState>('SYNCED');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Core Academic State
  const [masteryList, setMasteryList] = useState<MasteryRecord[]>([]);
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [positions, setPositions] = useState<Record<SubjectName, AcademicPosition>>({} as any);
  const [textbooks, setTextbooks] = useState<PersonalizedTextbook[]>([]);
  const [vaultFiles, setVaultFiles] = useState<VaultFileRecord[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);

  // Navigation Deep Links & Contexts
  const [learnSubject, setLearnSubject] = useState<SubjectName>('Mathematics');
  const [learnNodeId, setLearnNodeId] = useState<string | undefined>(undefined);
  const [learnMode, setLearnMode] = useState<string | undefined>(undefined);
  const [askPrompt, setAskPrompt] = useState<string>('');
  const [documentContext, setDocumentContext] = useState<{ title: string; text: string } | null>(null);

  // Check session unlock status on mount
  useEffect(() => {
    setIsUnlocked(isSessionActive());
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsUnlocked(true);
        syncEngine.pullCloudState(user.uid);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to Sync Engine
  useEffect(() => {
    const unsub = syncEngine.subscribe((state, pending) => {
      setSyncState(state);
      setPendingSyncCount(pending);
    });
    return () => {
      unsub();
    };
  }, []);

  // Load all local data from IndexedDB
  const loadLocalData = async () => {
    try {
      const [mList, mItems, pos, tbs, vFiles, sess] = await Promise.all([
        idb.getMasteryList(),
        idb.getMistakes(),
        idb.getPositions(),
        idb.getTextbooks(),
        idb.getVaultFiles(),
        idb.getSessions(),
      ]);

      setMasteryList(mList);
      setMistakes(mItems);
      setPositions(pos);
      setTextbooks(tbs);
      setVaultFiles(vFiles);
      setSessions(sess);

      // Seed initial starting position if none exist
      if (Object.keys(pos).length === 0) {
        const defaultPositions: Partial<Record<SubjectName, AcademicPosition>> = {
          Mathematics: {
            subject: 'Mathematics',
            currentTopicId: 'math-alg-01',
            currentStrand: 'Algebraic Reasoning',
            topic: 'Simultaneous Equations and Quadratic Graphs',
            updatedAt: new Date().toISOString(),
          },
          'Additional Mathematics': {
            subject: 'Additional Mathematics',
            currentTopicId: 'addmath-calc-01',
            currentStrand: 'Calculus',
            topic: 'Differentiation from First Principles',
            updatedAt: new Date().toISOString(),
          },
          Physics: {
            subject: 'Physics',
            currentTopicId: 'phy-mech-01',
            currentStrand: 'Mechanics and Matter',
            topic: 'Motion, Vectors and Newton Laws',
            updatedAt: new Date().toISOString(),
          },
          Chemistry: {
            subject: 'Chemistry',
            currentTopicId: 'chem-phys-01',
            currentStrand: 'Physical Chemistry',
            topic: 'Atomic Structure and The Mole Concept',
            updatedAt: new Date().toISOString(),
          },
          Biology: {
            subject: 'Biology',
            currentTopicId: 'bio-cell-01',
            currentStrand: 'Life in the Fundamental Unit',
            topic: 'Cell Biology, Transport and Protein Synthesis',
            updatedAt: new Date().toISOString(),
          },
          Computing: {
            subject: 'Computing',
            currentTopicId: 'comp-arch-01',
            currentStrand: 'Computer Architecture & Organisation',
            topic: 'Boolean Algebra and Logic Gates',
            updatedAt: new Date().toISOString(),
          },
          'English Language': {
            subject: 'English Language',
            currentTopicId: 'eng-write-01',
            currentStrand: 'Writing and Grammar',
            topic: 'Formal Letters, Articles, Reports and Cohesive Devices',
            updatedAt: new Date().toISOString(),
          },
          'Social Studies': {
            subject: 'Social Studies',
            currentTopicId: 'soc-gov-01',
            currentStrand: 'Law, Order and Governance',
            topic: 'National Identity, Citizenship and Law Enforcement in Ghana',
            updatedAt: new Date().toISOString(),
          },
          SAT: {
            subject: 'SAT',
            currentTopicId: 'sat-math-01',
            currentStrand: 'Math',
            topic: 'Linear Equations, Systems and Nonlinear Functions',
            updatedAt: new Date().toISOString(),
          },
        };

        for (const p of Object.values(defaultPositions)) {
          if (p) {
            await idb.savePosition(p);
          }
        }
        const refreshedPos = await idb.getPositions();
        setPositions(refreshedPos);
      }
    } catch (err) {
      console.warn('Failed loading local state:', err);
    }
  };

  useEffect(() => {
    loadLocalData();
  }, [isUnlocked]);

  // Handlers for state mutation
  const handleSavePosition = async (pos: AcademicPosition) => {
    await idb.savePosition(pos);
    setPositions((prev) => ({ ...prev, [pos.subject]: pos }));
    syncEngine.flushQueue();
  };

  const handleSaveMastery = async (record: MasteryRecord) => {
    await idb.saveMastery(record);
    setMasteryList((prev) => {
      const idx = prev.findIndex((m) => m.nodeId === record.nodeId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = record;
        return copy;
      }
      return [...prev, record];
    });
    syncEngine.flushQueue();
  };

  const handleSaveMistake = async (mistake: MistakeItem) => {
    await idb.saveMistake(mistake);
    setMistakes((prev) => {
      const idx = prev.findIndex((m) => m.id === mistake.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = mistake;
        return copy;
      }
      return [mistake, ...prev];
    });
    syncEngine.flushQueue();
  };

  const handleSaveTextbook = async (tb: PersonalizedTextbook) => {
    await idb.saveTextbook(tb);
    setTextbooks((prev) => [tb, ...prev.filter((t) => t.id !== tb.id)]);
    syncEngine.flushQueue();
  };

  const handleUploadFile = async (file: File, subject?: SubjectName, folder?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (subject) formData.append('subject', subject);
    if (folder) formData.append('folder', folder);

    try {
      const res = await fetch('/api/vault/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const fileData: VaultFileRecord = await res.json();
      fileData.subject = subject;
      fileData.folder = folder || 'General';

      // Cache blob locally in IndexedDB as well
      await idb.saveVaultBlob(fileData.id, file);
      fileData.offlineCached = true;

      await idb.saveVaultFile(fileData);
      setVaultFiles((prev) => [fileData, ...prev]);
      syncEngine.flushQueue();
    } catch (err: any) {
      console.error('File upload error:', err);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    await idb.deleteVaultFile(fileId);
    setVaultFiles((prev) => prev.filter((f) => f.id !== fileId));
    syncEngine.flushQueue();
  };

  const handleAskDocument = (file: VaultFileRecord) => {
    setDocumentContext({
      title: file.fileName,
      text: file.extractedText || `File ${file.fileName} (${file.mimeType})`,
    });
    setActiveTab('ask');
  };

  const handleSelectHomeAction = (
    subject: SubjectName,
    topic: string,
    nodeId: string,
    mode: string
  ) => {
    setLearnSubject(subject);
    setLearnNodeId(nodeId);
    setLearnMode(mode);
    setActiveTab('learn');
  };

  const handleOpenAsk = (prompt: string) => {
    setAskPrompt(prompt);
    setActiveTab('ask');
  };

  const handleOpenAskWithContext = (prompt: string, context?: string) => {
    setAskPrompt(prompt);
    if (context) {
      setDocumentContext({ title: 'Curriculum Focus', text: context });
    }
    setActiveTab('ask');
  };

  const handleLogout = () => {
    terminateSession();
    setIsUnlocked(false);
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-stone-900 selection:bg-stone-200 dark:bg-[#121316] dark:text-stone-100">
      {/* Private Authentication Guard */}
      {!isUnlocked && <AuthModal onSuccess={() => setIsUnlocked(true)} />}

      {/* Top 3-Zone Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        syncState={syncState}
        pendingSyncCount={pendingSyncCount}
        onLogout={handleLogout}
      />

      {/* Primary Workspace View Switcher */}
      <main className="pb-16">
        {activeTab === 'home' && (
          <HomeView
            masteryList={masteryList}
            mistakes={mistakes}
            sessions={sessions}
            onSelectAction={handleSelectHomeAction}
            onOpenAsk={handleOpenAsk}
          />
        )}

        {activeTab === 'learn' && (
          <LearnView
            initialSubject={learnSubject}
            initialTopicNodeId={learnNodeId}
            initialMode={learnMode}
            masteryList={masteryList}
            mistakes={mistakes}
            positions={positions}
            textbooks={textbooks}
            onSavePosition={handleSavePosition}
            onSaveMastery={handleSaveMastery}
            onSaveMistake={handleSaveMistake}
            onSaveTextbook={handleSaveTextbook}
            onOpenAskWithContext={handleOpenAskWithContext}
          />
        )}

        {activeTab === 'vault' && (
          <VaultView
            files={vaultFiles}
            onUploadFile={handleUploadFile}
            onDeleteFile={handleDeleteFile}
            onAskDocument={handleAskDocument}
          />
        )}

        {activeTab === 'ask' && (
          <AskView
            initialPrompt={askPrompt}
            documentContext={documentContext}
            onClearContext={() => setDocumentContext(null)}
          />
        )}

        {activeTab === 'system' && <SystemDiagnosticsView />}
      </main>
    </div>
  );
}
