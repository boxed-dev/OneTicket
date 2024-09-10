import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import twilio from "twilio";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Serper } from "@langchain/community/tools/serper";
import { Calculator } from "@langchain/community/tools/calculator";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { DynamicTool } from "@langchain/core/tools";
import * as exhibitionDatabase from "./exhibitionDatabase";

export const runtime = "nodejs"; // Ensure this runs in a Node.js environment

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

// Add Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

const AGENT_SYSTEM_TEMPLATE = `You are an exhibition booking assistant for an event management platform. You have access to the following data:

#### Schema

1. **Bookings**
   - **booking_id**: Unique identifier for each booking.
   - **user_id**: References the user who made the booking.
   - **event_id**: References the event that is booked.
   - **event_date**: Date when the user attends the event.
   - **event_time**: Time when the event starts.
   - **quantity**: Number of tickets booked.
   - **total_price**: Total price for the booking.

2. **Events**
   - **id**: Unique identifier for each event.
   - **title**: Title of the event (e.g., museum, exhibition).
   - **type**: Type of the event (e.g., museum, exhibition, show).
   - **history**: Description or history of the event.
   - **poster**: URL to the event poster.
   - **ticket_price**: Ticket price for attending the event.
   - **event_start**: Date and time when the event starts.
   - **event_end**: Date and time when the event ends.

3. **Users**
   - **user_id**: Unique identifier for each user.
   - **name**: Name of the user.
   - **email**: Email address of the user.
   - **phone**: Phone number of the user.
   - **address**: Address of the user.

#### Relationships

1. **User-Booking Relationship**:
   - Each booking is associated with a user.
   - The \`user_id\` in the bookings data references the \`user_id\` in the users data.

2. **Event-Booking Relationship**:
   - Each booking is associated with an event.
   - The \`event_id\` in the bookings data references the \`event_id\` in the events data.

If someone asks for booking details, you can search the user first using the tool then fetch the booking details using the tool.

Use this information to assist users with their booking inquiries.

MOST IMPORTANT: IF YOU CANT ASSIST WITH SOMETHING THEN SHOW THIS LINK TO THE USER: https://wa.me/918881920469?text=Hello where the user can talk to CostumerAgent.
NOTE: NEVER SAY ANYTHING HYPOTHETICALLY KEEP IN MIND THAT YOU ARE TALKING TO A REAL PERSON AND YOU ARE HANDLING SOMETHING THAT INVOLVES MONEY SO BE VERY CAUTIOUS.
After booking an event, always offer to send a detailed confirmation SMS to the user. Ask if they want to include full booking details in the SMS or prefer a brief confirmation. If the user agrees to receive an SMS, check if their phone number is available in their user details. If not, ask for their phone number before sending the confirmation.
Remember that the payment link will be sent throught the user by sms which is important for confirmation
If a user is not in the system, you can use the tool to add them. Think step by step and use the tools to gather the necessary information.
Use the SendBookingConfirmation tool to send the SMS after obtaining the phone number and preference for detailed information. The tool takes a JSON input with booking_id, phone_number, and include_details flag.
Always show price in Rupees. Price should be calculated based on the number of tickets and the ticket price.
Always show all the details of the events except the posters
ALWAYS REMEMBER: The user may tell you something in any language. You should call the tools and process the query in english. Then reply the final answer in their language
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
        name: "SearchUsers",
        description:
          "Search for users in the database. Input: user name or partial name",
        func: async (input: string) =>
          JSON.stringify(await exhibitionDatabase.searchUsers(input)),
      }),
      new DynamicTool({
        name: "CreateUser",
        description:
          "Create a new user. Input: JSON string with user details (name, email, phone, address)",
        func: async (input: string) =>
          JSON.stringify(
            await exhibitionDatabase.createUser(JSON.parse(input))
          ),
      }),
      new DynamicTool({
        name: "GetUserBookings",
        description: "Retrieve a user's current bookings. Input: user ID",
        func: async (input: string) =>
          JSON.stringify(await exhibitionDatabase.getUserBookings(input)),
      }),
      new DynamicTool({
        name: "SearchEvents",
        description:
          "Search for available events. Input: JSON string with date and time range",
        func: async (input: string) =>
          JSON.stringify(
            await exhibitionDatabase.searchEvents(JSON.parse(input))
          ),
      }),
      new DynamicTool({
        name: "BookEvent",
        description:
          "Book an event for a user. Input: JSON string with user_id, event_id, event_date, event_time, total_price",
        func: async (input: string) =>
          JSON.stringify(await exhibitionDatabase.bookEvent(JSON.parse(input))),
      }),
      new DynamicTool({
        name: "SendBookingConfirmation",
        description:
          "Send detailed booking confirmation SMS. Input: JSON string with booking_id, phone_number, and include_details flag",
        func: async (input: string) => {
          const { booking_id, phone_number, include_details } =
            JSON.parse(input);
          const result = await sendDetailedBookingConfirmationSMS(
            booking_id,
            phone_number,
            include_details
          );
          return JSON.stringify(result);
        },
      }),
      new DynamicTool({
        name: "CancelBooking",
        description: "Cancel an existing booking. Input: booking ID",
        func: async (input: string) =>
          JSON.stringify(await exhibitionDatabase.cancelBooking(input)),
      }),
      new DynamicTool({
        name: "GetEventDetails",
        description: "Get event details by event ID. Input: event ID",
        func: async (input: string) =>
          JSON.stringify(await exhibitionDatabase.getEventDetails(input)),
      }),
      new DynamicTool({
        name: "GetTodaysDate",
        description: "Get today's date",
        func: async () =>
          JSON.stringify({ date: exhibitionDatabase.getTodaysDate() }),
      }),
      new Calculator(),
    ];

    const chat = new ChatOpenAI({
      model: "gpt-4-turbo-preview",
      temperature: 0,
    });
    /**
     * Use a prebuilt LangGraph agent.
     */
    const agent = createReactAgent({
      llm: chat,
      tools,
      /**
       * Modify the stock prompt in the prebuilt agent. See docs
       * for how to customize your agent:
       *
       * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
       */
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       */
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" }
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content
              if (!!data.chunk.content) {
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
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
// Add a function to send SMS
async function sendDetailedBookingConfirmationSMS(
  bookingId: string,
  phoneNumber: string,
  includeDetails: boolean
) {
  try {
    const bookingDetails = await exhibitionDatabase.getBookingDetails(
      bookingId
    );
    if (!bookingDetails) {
      throw new Error("Booking details not found");
    }

    const eventDetails = await exhibitionDatabase.getEventDetails(
      bookingDetails.event_id
    );
    if (!eventDetails) {
      throw new Error("Event details not found");
    }

    const userDetails = await exhibitionDatabase.getUserDetails(
      bookingDetails.user_id
    );
    if (!userDetails) {
      throw new Error("User details not found");
    }

    // Crafting the SMS body
    let messageBody = `Dear ${userDetails.name},\n\nThank you for booking your event with us. Your booking has been confirmed!\n\n`;

    if (includeDetails) {
      messageBody += `Booking Details:\n`;
      messageBody += `- Booking ID: ${bookingId}\n`;
      messageBody += `- Event: ${eventDetails.title}\n`;
      messageBody += `- Event Date: ${eventDetails.title}\n`;
      messageBody += `- Event Time: ${eventDetails.title}\n`;
      messageBody += `- Total Price: Rs.${bookingDetails.total_price}\n\n`;
    }

    messageBody += `We look forward to hosting you at our event. If you have any questions, please don't hesitate to contact us.\n\nBest regards,\nExhibition Event Team`;

    const message = await twilioClient.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log(`Detailed SMS sent successfully. SID: ${message.sid}`);
    return {
      success: true,
      message: "Detailed confirmation SMS sent successfully",
    };
  } catch (error) {
    console.error("Error sending detailed SMS:", error);
    return {
      success: false,
      message: "Failed to send detailed confirmation SMS",
    };
  }
}
