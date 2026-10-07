import { ChatWidget } from "@/components/chat/ChatWidget";

export default function ChatPage(){
  return <div className="chat-route fixed inset-x-0 top-0 bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom))] z-30 h-[calc(100dvh-var(--nav-h)-env(safe-area-inset-bottom))] min-h-0 md:static md:h-auto md:max-w-[1280px] md:px-2">
    <ChatWidget/>
  </div>;
}