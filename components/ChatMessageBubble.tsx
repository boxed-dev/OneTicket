import type { Message } from "ai/react";
import ReactMarkdown from 'react-markdown';

export function ChatMessageBubble(props: { message: Message, sources: any[] }) {
  const isUser = props.message.role === "user";
  const colorClassName = isUser ? "bg-gray-100 text-gray-800" : "bg-white text-gray-700";
  const alignmentClassName = isUser ? "ml-auto" : "mr-auto";

  return (
    <div className={`${alignmentClassName} ${colorClassName} rounded border border-gray-200 px-3 py-2 max-w-[80%] mb-2`}>
      <div className="flex flex-col">
        <ReactMarkdown className="prose prose-sm max-w-none">
          {props.message.content}
        </ReactMarkdown>
        {props.sources && props.sources.length > 0 && (
          <div className="mt-1">
            <details className="text-xs">
              <summary className="font-medium cursor-pointer text-gray-600">Sources</summary>
              <ul className="mt-1 list-disc list-inside">
                {props.sources.map((source, i) => (
                  <li key={`source:${i}`} className="mb-1 text-gray-600">
                    &quot;{source.pageContent}&quot;
                    {source.metadata?.loc?.lines && (
                      <span className="text-gray-400">
                        (Lines {source.metadata.loc.lines.from} to {source.metadata.loc.lines.to})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}