"use client";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiSend } from "react-icons/fi";
import Image from "next/image";
import { detectAndTranslate, translate } from "@/utils/langApi";
import { Message } from "ai";
import { useChat } from "ai/react";
import { useRef, useState, ReactElement } from "react";
import type { FormEvent } from "react";

import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { IntermediateStep } from "./IntermediateStep";

export function ChatWindow(props: {
  endpoint: string;
  emptyStateComponent?: ReactElement;
  placeholder?: string;
  titleText?: string;
  showIngestForm?: boolean;
  showIntermediateStepsToggle?: boolean;
}) {
  const messageContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    endpoint,
    emptyStateComponent,
    placeholder,
    titleText = "An LLM",
    showIngestForm,
    showIntermediateStepsToggle,
  } = props;

  const [showIntermediateSteps, setShowIntermediateSteps] = useState(false);
  const [intermediateStepsLoading, setIntermediateStepsLoading] =
    useState(false);

  const intemediateStepsToggle = showIntermediateStepsToggle && (
    <div>
      <input
        type="checkbox"
        id="show_intermediate_steps"
        name="show_intermediate_steps"
        checked={showIntermediateSteps}
        onChange={(e) => setShowIntermediateSteps(e.target.checked)}
      ></input>
      <label htmlFor="show_intermediate_steps"> Show intermediate steps</label>
    </div>
  );

  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, any>
  >({});
  const [focused, setFocused] = useState(false);

  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading: chatEndpointIsLoading,
    setMessages,
  } = useChat({
    api: endpoint,
    onResponse(response) {
      const sourcesHeader = response.headers.get("x-sources");
      const sources = sourcesHeader
        ? JSON.parse(Buffer.from(sourcesHeader, "base64").toString("utf8"))
        : [];
      const messageIndexHeader = response.headers.get("x-message-index");
      if (sources.length && messageIndexHeader !== null) {
        setSourcesForMessages({
          ...sourcesForMessages,
          [messageIndexHeader]: sources,
        });
      }
    },
    streamMode: "text",
    onError: (e) => {
      toast(e.message, {
        theme: "dark",
      });
    },
  });
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (messageContainerRef.current) {
      messageContainerRef.current.classList.add("grow");
    }
    if (!messages.length) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (chatEndpointIsLoading ?? intermediateStepsLoading) {
      return;
    }
    if (showIntermediateSteps) {
      handleSubmit(e);
      // Some extra work to show intermediate steps properly
    } else {
      setIntermediateStepsLoading(true);
      setInput("");
      const messagesWithUserReply = messages.concat({
        id: messages.length.toString(),
        content: input,
        role: "user",
      });
      const filteredMessages = messagesWithUserReply.filter(
        (message) => message.role !== "system"
      );

      setMessages(filteredMessages);
      console.log("filteredMessages");
      console.log(filteredMessages);

      // Get the last 6 messages (or all if less than 6)
      const lastSixMessages = filteredMessages.slice(-6);

      // Translate messages to English
      const translatedMessages = await Promise.all(
        lastSixMessages.map(async (message) => {
          if (message.role === "user") {
            const result = await detectAndTranslate(message.content);
            setDetectedLanguage(result.detected_language);
            return { ...message, content: result.translated_text };
          }
          return message;
        })
      );

      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          messages: translatedMessages,
          show_intermediate_steps: true,
        }),
      });
      console.log("response");
      console.log(response);
      const json = await response.json();
      // Translate the last message (English response) back to the detected language
      if (json.messages && json.messages.length > 0 && detectedLanguage) {
        const lastMessage = json.messages[json.messages.length - 1];
        if (lastMessage.role === "assistant" && lastMessage.content) {
          try {
            const translatedResponse = await translate(
              lastMessage.content,
              detectedLanguage
            );

            // Update the last message with the translated content
            json.messages[json.messages.length - 1] = {
              ...lastMessage,
              content: translatedResponse.translated_text,
            };

            console.log("Translated response:", translatedResponse);
          } catch (error) {
            console.error("Error translating response:", error);
          }
        }
      }
      if (response.status === 200) {
        const responseMessages: Message[] = json.messages;
        // Represent intermediate steps as system messages for display purposes
        // TODO: Add proper support for tool messages
        const toolCallMessages = responseMessages.filter(
          (responseMessage: Message) => {
            return (
              (responseMessage.role === "assistant" &&
                !!responseMessage.tool_calls?.length) ||
              responseMessage.role === "tool"
            );
          }
        );
        const intermediateStepMessages = [];
        for (let i = 0; i < toolCallMessages.length; i += 2) {
          const aiMessage = toolCallMessages[i];
          const toolMessage = toolCallMessages[i + 1];
          if (toolMessage && toolMessage.content) {
            // Ensure toolMessage.content is defined
            intermediateStepMessages.push({
              id: (messagesWithUserReply.length + i / 2).toString(),
              role: "system" as const,
              content: JSON.stringify({
                action: aiMessage.tool_calls?.[0],
                observation: toolMessage.content,
              }),
            });
          }
        }
        const newMessages = messagesWithUserReply;
        for (const message of intermediateStepMessages) {
          newMessages.push(message);
          setMessages([...newMessages]);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 + Math.random() * 1000)
          );
        }
        setMessages([
          ...newMessages,
          {
            id: newMessages.length.toString(),
            content: responseMessages[responseMessages.length - 1].content,
            role: "assistant",
          },
        ]);
      } else {
        if (json.error) {
          toast(json.error, {
            theme: "dark",
          });
          throw new Error(json.error);
        }
      }
    }
  }

  async function handleMessage(
    aiMessage: { tool_calls: any[] },
    toolMessage: { content: any }
  ) {
    try {
      // Log the details for debugging
      console.log("AI Message:", aiMessage);
      console.log("Tool Message:", toolMessage);

      if (toolMessage && toolMessage.content) {
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: aiMessage.tool_calls?.[0],
            observation: toolMessage.content,
          }),
        });
      } else {
        console.error("Tool message is undefined or missing content");
      }
    } catch (error) {
      console.error("Error handling message:", error);
    }
  }

  return (
    <div className="flex flex-col items-center p-2 md:p-4 grow overflow-hidden border border-gray-200 bg-[#F8F8FF] rounded-xl">
      {/* <div className='relative w-full h-[8%] sm:h-[10%] border-b-2 border-black flex py-2 gap-3'>
        <div className='w-10 h-10 relative object-contain'>
          <Image src='/images/Default PRofile.png' alt='public/images/Default PRofile.png' fill priority/>
        </div>
        <h3 className='text-2xl pt-3'>User</h3>
      </div> */}
      <h2 className="text-xl text-gray-700 mb-2">{titleText}</h2>
      <div
        className="hide-scrollbar flex flex-col-reverse w-full mb-2 overflow-auto transition-[flex-grow] ease-in-out flex-grow relative px-1 lg:w-[80%] xl:w-[60%] mt-2"
        ref={messageContainerRef}
      >
        {messages.length > 0 ? (
          [...messages].reverse().map((m, i) => {
            const sourceKey = (messages.length - 1 - i).toString();
            return m.role === "system" ? (
              <IntermediateStep key={m.id} message={m} />
            ) : (
              <ChatMessageBubble
                key={m.id}
                message={m}
                sources={sourcesForMessages[sourceKey]}
              />
            );
          })
        ) : (
          <div className="text-gray-500 text-center py-8">
            {emptyStateComponent || "No messages yet. Start a conversation!"}
          </div>
        )}
      </div>

      <form
        onSubmit={sendMessage}
        className={`flex w-full flex-col mt-4 rounded-xl border-2 border-black relative lg:w-[80%] xl:w-[60%] ${
          focused ? "ring-2 ring-blue-500 border-none" : ""
        }`}
      >
        {/* <div className="flex mb-2 pl-10 relative z-10 py-2">
          {intemediateStepsToggle}
        </div>
        <div className="h-10 w-full bg-[#D5DAE7] rounded-t-xl absolute top-0"></div> */}
        <div className="flex w-full rounded-xl">
          <input
            className="grow mr-2 p-2 rounded-xl border-none pl-4 md:pl-10 py-5 focus:border-none focus:outline-none"
            value={input}
            placeholder={placeholder ?? "What's it like to be a pirate?"}
            onChange={handleInputChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <button
            type="submit"
            className="shrink-0 bg-black text-white rounded my-4 px-4 mr-4"
          >
            <div
              role="status"
              className={`${
                chatEndpointIsLoading || intermediateStepsLoading
                  ? ""
                  : "hidden"
              } flex justify-center`}
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4 text-white animate-spin fill-blue-600"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span className="sr-only">Loading...</span>
            </div>
            <span
              className={
                chatEndpointIsLoading || intermediateStepsLoading
                  ? "hidden"
                  : ""
              }
            >
              <FiSend />
            </span>
          </button>
        </div>
      </form>
      <ToastContainer />
    </div>
  );
}
