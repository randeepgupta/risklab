import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownReply({text}: {text: string}) {
  return <div className="min-w-0 break-words text-sm leading-relaxed">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
      h1: ({children}) => <h3 className="mb-2 mt-4 text-lg font-bold text-white first:mt-0">{children}</h3>,
      h2: ({children}) => <h3 className="mb-2 mt-4 text-base font-bold text-white first:mt-0">{children}</h3>,
      h3: ({children}) => <h4 className="mb-2 mt-3 font-semibold text-white first:mt-0">{children}</h4>,
      p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
      strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
      ul: ({children}) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
      ol: ({children}) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
      li: ({children}) => <li className="pl-1 [&>p]:mb-1">{children}</li>,
      a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline underline-offset-2 hover:text-sky-200">{children}</a>,
      blockquote: ({children}) => <blockquote className="my-3 border-l-2 border-sky-500 pl-3 text-slate-400">{children}</blockquote>,
      pre: ({children}) => <pre className="my-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs">{children}</pre>,
      code: ({children}) => <code className="rounded bg-slate-800/70 px-1 py-0.5 font-mono text-xs">{children}</code>,
      table: ({children}) => <div className="my-3 max-w-full overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
      th: ({children}) => <th className="border border-slate-700 bg-slate-800 px-3 py-2 font-semibold text-white">{children}</th>,
      td: ({children}) => <td className="border border-slate-700 px-3 py-2 align-top">{children}</td>,
      hr: () => <hr className="my-4 border-slate-700" />,
      img: ({alt}) => <span className="text-slate-400">{alt}</span>,
    }}>{text}</ReactMarkdown>
  </div>;
}
