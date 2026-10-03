import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLanguage = '';

  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const rows = tableRows.slice(1).filter((r) => !r.every((cell) => /^[-:]+$/.test(cell.trim())));

      elements.push(
        <div key={`table_${elements.length}`} className="my-4 overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-800">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-stone-100 font-semibold text-stone-900 dark:bg-stone-800 dark:text-stone-100">
              <tr>
                {header.map((col, cIdx) => (
                  <th key={cIdx} className="px-3 py-2 border-b border-stone-200 dark:border-stone-700">
                    {formatInline(col.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-stone-50 dark:hover:bg-stone-850">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-stone-700 dark:text-stone-300">
                      {formatInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, idx) => {
    // Check if table row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|');
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

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

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr_${idx}`} className="my-4 border-t border-stone-200 dark:border-stone-800" />);
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

    // Math block lines \[ ... \] or $$ ... $$
    if (line.trim().startsWith('\\[') || line.trim().endsWith('\\]') || line.trim().startsWith('$$')) {
      const cleanMath = line.replace(/^(\s*\\\[|\s*\$\$)/, '').replace(/(\\\]|\$\$)\s*$/, '').trim();
      elements.push(
        <div key={`math_${idx}`} className="my-2.5 overflow-x-auto rounded-md bg-stone-100 p-2 text-center font-mono text-sm text-stone-900 dark:bg-stone-800 dark:text-stone-100">
          {cleanMath}
        </div>
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

  if (inTable) {
    flushTable();
  }

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
