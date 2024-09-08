import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { PrismaClient } from "@prisma/client";
import { DynamicTool } from "@langchain/core/tools";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as eventDatabase from "./eventDatabase";
// import { sendSMS } from "./smsService"; // Assume SMS functionality is available here

const prisma = new PrismaClient();
export const runtime = "nodejs";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

// System Template for the Agent
const AGENT_SYSTEM_TEMPLATE = `You are a helpful museum assistant for event bookings. You have access to the following data and tools:

#### Schema

1. **Users**
   - **user_id**: Unique identifier for each user.
   - **name**: Name of the user.
   - **email**: Email address of the user.
   - **phone_number**: Phone number of the user.
   - **registered_date**: Date when the user registered.

2. **Events**
   - **event_id**: Unique identifier for each event or show.
   - **event_name**: Name of the event.
   - **description**: Description of the event.
   - **event_type**: Type of the event (Exhibition, Show).
   - **start_date**: Start date of the event.
   - **end_date**: End date of the event.
   - **location**: Event location.
   - **price**: Ticket price.
   - **capacity**: Total capacity for the event.

3. **Tickets**
   - **ticket_id**: Unique identifier for each ticket.
   - **user_id**: The user who booked the ticket.
   - **event_id**: The event related to the ticket.
   - **ticket_type**: Type of ticket.
   - **visit_date**: Date when the user is visiting.

If someone asks for booking details, you can search the user first using the tool then fetch the booking details using the tool.

Use this information to assist users with their booking inquiries.

MOST IMPORTANT: IF YOU CANT ASSIST WITH SOMETHING THEN SHOW THIS LINK TO THE USER: https://wa.me/918881920469?text=Hello where user can talk to CostumerAgent.
NOTE: NEVER SAY ANYTHING HYPOTHETICALLY KEEP IN MIND THAT YOU ARE TALKING TO A REAL PERSON AND YOU ARE HANDLING SOMEHING THAT INVOLCES MONEY SO BE VERY VERY CAUTIOUS.
After booking a room, always offer to send a detailed confirmation SMS to the user. Ask if they want to include full booking details in the SMS or prefer a brief confirmation. If the user agrees to receive an SMS, check if their phone number is available in their user details. If not, ask for their phone number before sending the confirmation.

Use the SendBookingConfirmation tool to send the SMS after obtaining the phone number and preference for detailed information. The tool takes a JSON input with booking_id, phone_number, and include_details flag.
Always show price in Rupees.
Today's date is ${new Date().toLocaleDateString()}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant"
      )
      .map(convertVercelMessageToLangChainMessage);

    const tools = [
      new DynamicTool({
        name: "GetAvailableEvents",
        description: "Retrieve list of available events.",
        func: async () =>
          JSON.stringify(await eventDatabase.getAvailableEvents()),
      }),
      new DynamicTool({
        name: "CheckEventAvailability",
        description:
          "Check if tickets are available for a specific event. Input: event ID",
        func: async (input: string) =>
          JSON.stringify(
            await eventDatabase.checkEventAvailability(parseInt(input))
          ),
      }),
      new DynamicTool({
        name: "BookTickets",
        description:
          "Book tickets for an event. Input: JSON with user_id, event_id, visit_date, quantity, ticket_type",
        func: async (input: string) =>
          JSON.stringify(await eventDatabase.bookTickets(JSON.parse(input))),
      }),
      new DynamicTool({
        name: "CancelBooking",
        description: "Cancel a booking. Input: ticket ID",
        func: async (input: string) =>
          JSON.stringify(await eventDatabase.cancelBooking(parseInt(input))),
      }),
      new DynamicTool({
        name: "GetUserBookings",
        description:
          "Get the list of a user's current bookings. Input: user ID",
        func: async (input: string) =>
          JSON.stringify(await eventDatabase.getUserBookings(parseInt(input))),
      }),
      new DynamicTool({
        name: "RegisterUser",
        description:
          "Register a new user. Input: JSON with user details (name, email, phone_number)",
        func: async (input: string) =>
          JSON.stringify(await eventDatabase.registerUser(JSON.parse(input))),
      }),
      new DynamicTool({
        name: "GetEventDetails",
        description:
          "Get detailed information about a specific event. Input: event ID",
        func: async (input: string) =>
          JSON.stringify(await eventDatabase.getEventDetails(parseInt(input))),
      }),
      // new DynamicTool({
      //   name: "SendSMS",
      //   description:
      //     "Send an SMS notification to the user. Input: JSON with phone_number and message",
      //   func: async (input: string) => {
      //     const { phone_number, message } = JSON.parse(input);
      //     return JSON.stringify(await sendSMS(phone_number, message));
      //   },
      // }),
      new DynamicTool({
        name: "GetTodaysDate",
        description: "Returns today's date.",
        func: async () => {
          const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
          return JSON.stringify({ date: today });
        },
      }),
    ];

    const chat = new ChatOpenAI({
      model: "gpt-4-turbo-preview",
      temperature: 0,
    });

    const agent = createReactAgent({
      llm: chat,
      tools,
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" }
      );
      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream" && !!data.chunk.content) {
              controller.enqueue(textEncoder.encode(data.chunk.content));
            }
          }
          controller.close();
        },
      });
      return new StreamingTextResponse(transformStream);
    } else {
      const result = await agent.invoke({ messages });
      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
