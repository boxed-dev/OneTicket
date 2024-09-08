import type { Message } from "ai/react";
import ReactMarkdown from 'react-markdown';
import Image from "next/image";

export function ChatMessageBubble(props: { message: Message, sources: any[] }) {
  const isUser = props.message.role === "user";
  const colorClassName = isUser
    ? "bg-[#0F172A] text-white shadow-2xl rounded-l-xl rounded-br-xl"
    : "bg-[#F1F4F9] text-gray-700 shadow-2xl rounded-r-xl rounded-bl-xl";
  const alignmentClassName = isUser ? "ml-auto mr-[8%] md:mr-[6%] xl:mr-[4%]" : "mr-auto";

  return (
    <>
      <div
        className={`${alignmentClassName} ${colorClassName} rounded border border-gray-200 px-3 py-1 max-w-[80%] md:max-w-[90%] mb-4 relative` }
      >
        {isUser?<div className="absolute w-[20px] h-[20px] object-contain right-[-30px] top-0 rounded-full">
          <Image
            src="/images/Default PRofile.png"
            alt="public/images/Default PRofile.png"
            fill
            priority
          />
        </div>:<></>}
        <div className="flex flex-col">
          <ReactMarkdown className="prose prose-sm max-w-none">
            {props.message.content}
          </ReactMarkdown>
          {props.sources && props.sources.length > 0 && (
            <div className="mt-1">
              <details className="text-xs">
                <summary className="font-medium cursor-pointer text-gray-600">
                  Sources
                </summary>
                <ul className="mt-1 list-disc list-inside">
                  {props.sources.map((source, i) => (
                    <li key={`source:${i}`} className="mb-1 text-gray-600">
                      &quot;{source.pageContent}&quot;
                      {source.metadata?.loc?.lines && (
                        <span className="text-gray-400">
                          (Lines {source.metadata.loc.lines.from} to{" "}
                          {source.metadata.loc.lines.to})
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
    </>
  );
}