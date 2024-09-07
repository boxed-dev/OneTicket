import { ChatWindow } from "@/components/ChatWindow";

export default function AgentsPage() {
  // const InfoCard = (
    // <div className="p-4 rounded bg-[#030303] w-full max-h-[85%] overflow-hidden">
    //   {/* <h1 className="text-2xl mb-2 text-center">
    //     Hotel Booking Assistant
    //   </h1> */}
    //   <p className="text-center text-sm">
    //     Ask about bookings and availability
    //   </p>
    // </div>
  // );

  return (
    <ChatWindow
      endpoint="api/chat/agents"
      emptyStateComponent={<div></div>}
      placeholder="Ask about hotel bookings..."
      titleText=""
      showIntermediateStepsToggle={true}
    />
  );
}
