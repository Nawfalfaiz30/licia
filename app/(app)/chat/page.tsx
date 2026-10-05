import { ChatWidget } from "@/components/chat/ChatWidget";
import { getServerI18n } from "@/lib/i18n/server";

export default async function ChatPage() {
  const { tr } = await getServerI18n();

  return (
    <div className="chat-page-shell animate-licia-page-in">
      <div className="chat-page-intro">
        <div className="chat-page-intro-copy">
          <span className="chat-page-eyebrow">PERSONAL AI · LIFE OS</span>
          <h1>{tr("Ruang obrolanmu")}</h1>
          <p>{tr("Tanya, rencanakan, dan bereskan hal penting bersama Licia.")}</p>
        </div>
        <div className="chat-page-intro-mark" aria-hidden="true">
          <span>✦</span>
        </div>
      </div>
      <ChatWidget />
    </div>
  );
}
