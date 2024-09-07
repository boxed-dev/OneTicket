import { useState } from "react";
import type { Message } from "ai/react";
import { ChevronDown, ChevronUp } from 'react-feather';

export function IntermediateStep(props: { message: Message }) {
  const parsedInput = JSON.parse(props.message.content);
  const { action, observation } = parsedInput;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-auto bg-gray-100 rounded border border-gray-200 px-3 py-2 max-w-[80%] mb-2 text-gray-700">
      <div 
        className="flex justify-between items-center cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-medium">{action.name}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {expanded && (
        <div className="mt-2 text-xs">
          <div className="bg-white rounded border border-gray-200 p-2 mb-2">
            <h4 className="font-medium mb-1">Tool Input:</h4>
            <pre className="whitespace-pre-wrap overflow-auto max-h-[80px] text-gray-600">
              {JSON.stringify(action.args, null, 2)}
            </pre>
          </div>
          <div className="bg-white rounded border border-gray-200 p-2">
            <h4 className="font-medium mb-1">Observation:</h4>
            <pre className="whitespace-pre-wrap overflow-auto max-h-[200px] text-gray-600">
              {observation}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}