
import React from 'react';

interface JsonViewerProps {
  data: object;
}

const syntaxHighlight = (json: string): string => {
    if (json === null || json === undefined) return '';
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'text-green-400'; // number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-cyan-400'; // key
            } else {
                cls = 'text-amber-400'; // string
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-purple-400'; // boolean
        } else if (/null/.test(match)) {
            cls = 'text-slate-500'; // null
        }
        return `<span class="${cls}">${match}</span>`;
    });
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
  const formattedJson = JSON.stringify(data, null, 2);
  const highlightedJson = syntaxHighlight(formattedJson);

  return (
    <pre className="text-sm whitespace-pre-wrap break-words">
      <code dangerouslySetInnerHTML={{ __html: highlightedJson }} />
    </pre>
  );
};
