import { ChatWidget } from "@/components/chat/ChatWidget";

export default function ChatPage() {
  return (
    <div className="chat-page-shell -mx-4 -mt-2 h-[100dvh] sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
      <ChatWidget />
    </div>
  );
}
