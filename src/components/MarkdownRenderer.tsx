import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Simple, robust parser for academic markdown responses from AI
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = '';

  lines.forEach((line, idx) => {
    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code_${idx}`} className="my-3 overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs font-mono text-emerald-400 shadow-inner dark:bg-stone-950">
            {codeLanguage && <div className="mb-2 text-[10px] uppercase text-stone-500">{codeLanguage}</div>}
            <pre className="whitespace-pre">{codeBuffer.join('\n')}</pre>
          </div>
        );
        codeBuffer = [];
        inCodeBlock = false;
        codeLanguage = '';
      } else {
        inCodeBlock = true;
        codeLanguage = line.trim().replace('```', '');
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h_${idx}`} className="mt-4 mb-2 font-serif text-base font-bold text-stone-900 dark:text-stone-100">
          {line.replace('### ', '')}
        </h4>
      );
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h_${idx}`} className="mt-5 mb-2 font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
          {line.replace('## ', '')}
        </h3>
      );
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h_${idx}`} className="mt-6 mb-3 font-serif text-xl font-bold text-stone-900 dark:text-stone-100">
          {line.replace('# ', '')}
        </h2>
      );
      return;
    }

    // Bullet points
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const text = line.trim().replace(/^[-*]\s+/, '');
      elements.push(
        <li key={`li_${idx}`} className="ml-4 list-disc text-sm leading-relaxed text-stone-800 dark:text-stone-200">
          {formatInline(text)}
        </li>
      );
      return;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line.trim())) {
      const text = line.trim().replace(/^\d+\.\s+/, '');
      elements.push(
        <div key={`num_${idx}`} className="ml-4 flex gap-2 text-sm leading-relaxed text-stone-800 dark:text-stone-200 my-1">
          <span className="font-semibold text-stone-900 dark:text-stone-100">{line.trim().match(/^\d+\./)?.[0]}</span>
          <span>{formatInline(text)}</span>
        </div>
      );
      return;
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<div key={`space_${idx}`} className="h-2" />);
      return;
    }

    // Regular paragraphs
    elements.push(
      <p key={`p_${idx}`} className="text-sm leading-relaxed text-stone-800 dark:text-stone-200 my-1">
        {formatInline(line)}
      </p>
    );
  });

  return <div className="space-y-1">{elements}</div>;
};

// Helper for bold, inline code, and math symbols
function formatInline(text: string): React.ReactNode {
  // Simple bold parser **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-stone-900 dark:text-stone-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Inline code `code`
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.map((cPart, cI) => {
      if (cPart.startsWith('`') && cPart.endsWith('`')) {
        return (
          <code key={`${i}-${cI}`} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-xs text-blue-600 dark:bg-stone-800 dark:text-blue-400">
            {cPart.slice(1, -1)}
          </code>
        );
      }
      return cPart;
    });
  });
}
