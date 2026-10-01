import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Trash2,
  Eye,
  MessageSquare,
  Check,
  Folder,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { VaultFileRecord, SubjectName } from '../types';
import { idb } from '../lib/indexedDB';
import { ALL_SUBJECTS } from '../data/seedCurriculum';

interface VaultViewProps {
  files: VaultFileRecord[];
  onUploadFile: (file: File, subject?: SubjectName, folder?: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
  onAskDocument: (file: VaultFileRecord) => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  files,
  onUploadFile,
  onDeleteFile,
  onAskDocument,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedFolder, setSelectedFolder] = useState<string>('All');
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<VaultFileRecord | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState({ usedBytes: 0, quotaBytes: 10 * 1024 * 1024 * 1024, percentUsed: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    idb.getStorageEstimate().then(setStorageStats);
  }, [files]);

  // Handle file preview loading (either from local IndexedDB blob or remote url)
  const handleOpenFile = async (file: VaultFileRecord) => {
    setPreviewFile(file);
    const cachedBlob = await idb.getVaultBlob(file.id);
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      setPreviewBlobUrl(url);
    } else if (file.downloadUrl) {
      setPreviewBlobUrl(file.downloadUrl);
    } else {
      setPreviewBlobUrl(null);
    }
  };

  const closePreview = () => {
    if (previewBlobUrl && previewBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewFile(null);
    setPreviewBlobUrl(null);
  };

  // Toggle offline cache in IndexedDB
  const handleToggleOffline = async (file: VaultFileRecord) => {
    if (file.offlineCached) {
      await idb.deleteVaultBlob(file.id);
      await idb.saveVaultFile({ ...file, offlineCached: false });
    } else {
      try {
        if (file.downloadUrl) {
          const res = await fetch(file.downloadUrl);
          const blob = await res.blob();
          await idb.saveVaultBlob(file.id, blob);
          await idb.saveVaultFile({ ...file, offlineCached: true });
        }
      } catch (err) {
        console.warn('Failed to cache blob for offline:', err);
      }
    }
    const updatedStats = await idb.getStorageEstimate();
    setStorageStats(updatedStats);
  };

  // File Upload handler
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        await onUploadFile(
          uploadedFiles[i],
          selectedSubject !== 'All' ? (selectedSubject as SubjectName) : undefined,
          selectedFolder !== 'All' ? selectedFolder : 'General'
        );
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredFiles = files.filter((f) => {
    const matchSubj = selectedSubject === 'All' || f.subject === selectedSubject;
    const matchFolder = selectedFolder === 'All' || f.folder === selectedFolder;
    return matchSubj && matchFolder;
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Vault Header & Storage Meter */}
      <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-center dark:border-stone-800">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Personal Academic Vault
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            Backblaze B2-backed private document storage (10 GB target capacity) with local offline caching.
          </p>
        </div>

        {/* Quota Gauge */}
        <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3 text-xs dark:border-stone-800 dark:bg-stone-900">
          <HardDrive className="h-4 w-4 text-stone-500" />
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-stone-600 dark:text-stone-400">
              <span>{formatSize(storageStats.usedBytes)} used</span>
              <span>10.0 GB Limit</span>
            </div>
            <div className="h-1.5 w-36 rounded-full bg-stone-100 dark:bg-stone-800">
              <div
                className="h-1.5 rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(100, Math.max(2, storageStats.percentUsed))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Drag & Drop Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-white p-8 text-center transition-colors hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900/40 dark:hover:border-stone-600"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          multiple
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.md,.csv,.doc,.docx"
        />

        {isUploading ? (
          <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <span>Streaming and indexing academic document...</span>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-stone-400" />
            <div className="mt-3 text-sm font-semibold text-stone-900 dark:text-stone-100">
              Drop academic notes, past questions, or PDFs here
            </div>
            <p className="mt-1 text-xs text-stone-500">
              Supports PDF, Markdown, text notes, diagrams, and past question papers up to 100MB.
            </p>
          </>
        )}
      </div>

      {/* Filter Bars */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-stone-500">Subject:</span>
          {['All', ...ALL_SUBJECTS].map((subj) => (
            <button
              key={subj}
              onClick={() => setSelectedSubject(subj)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedSubject === subj
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Files List */}
      <div className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900/50">
        {filteredFiles.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-500">
            No academic documents stored in this view. Upload your syllabi, textbooks, or personal notes above.
          </div>
        ) : (
          <div className="divide-y divide-stone-200 dark:divide-stone-800">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-stone-100 p-2 dark:bg-stone-800">
                    {file.mimeType.includes('pdf') ? (
                      <FileText className="h-5 w-5 text-rose-600" />
                    ) : file.mimeType.includes('image') ? (
                      <ImageIcon className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <File className="h-5 w-5 text-blue-600" />
                    )}
                  </div>

                  <div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {file.fileName}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500">
                      <span>{formatSize(file.fileSize)}</span>
                      <span>·</span>
                      <span>{file.subject || 'General'}</span>
                      <span>·</span>
                      <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                      {file.offlineCached && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Cached Offline
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenFile(file)}
                    className="flex items-center gap-1 rounded border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Open</span>
                  </button>

                  <button
                    onClick={() => handleToggleOffline(file)}
                    className={`flex items-center gap-1 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      file.offlineCached
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-stone-200 text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800'
                    }`}
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>{file.offlineCached ? 'Offline Ready' : 'Make Offline'}</span>
                  </button>

                  <button
                    onClick={() => onAskDocument(file)}
                    className="flex items-center gap-1 rounded bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Ask Ishizaki</span>
                  </button>

                  <button
                    onClick={() => onDeleteFile(file.id)}
                    className="rounded p-1.5 text-stone-400 hover:text-rose-600"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Real In-Browser File Viewer Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl dark:bg-stone-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="font-serif text-base font-bold text-stone-900 dark:text-stone-100">
                  {previewFile.fileName}
                </h3>
              </div>
              <button onClick={closePreview} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                ✕
              </button>
            </div>

            {/* Viewer Content */}
            <div className="flex-1 overflow-auto p-6">
              {previewFile.mimeType.includes('image') && previewBlobUrl ? (
                <div className="flex items-center justify-center">
                  <img
                    src={previewBlobUrl}
                    alt={previewFile.fileName}
                    className="max-h-[70vh] rounded-lg object-contain shadow-md"
                  />
                </div>
              ) : previewFile.mimeType.includes('pdf') && previewBlobUrl ? (
                <iframe
                  src={previewBlobUrl}
                  title={previewFile.fileName}
                  className="h-[70vh] w-full rounded border border-stone-200 dark:border-stone-800"
                />
              ) : previewFile.extractedText ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 font-mono text-xs text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200">
                  <pre className="whitespace-pre-wrap">{previewFile.extractedText}</pre>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-stone-500">
                  File format preview not natively supported in browser. Download or ask Ishizaki to interrogate text.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-stone-200 px-6 py-3 text-xs dark:border-stone-800">
              <span className="text-stone-500">{formatSize(previewFile.fileSize)} · {previewFile.mimeType}</span>
              <button
                onClick={() => {
                  const target = previewFile;
                  closePreview();
                  onAskDocument(target);
                }}
                className="rounded-lg bg-stone-900 px-4 py-2 font-medium text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900"
              >
                Ask Ishizaki About This File →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
