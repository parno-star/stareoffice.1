import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { api } from "@/convex/_generated/api.js";

/**
 * Watches for newly-arrived direct messages and shows a pop-up (toast) alert
 * so the user notices incoming messages from anywhere in the app.
 *
 * It tracks the last message id it has already alerted on, so it never
 * re-alerts for the same message and stays quiet on first load.
 */
export default function NewMessageNotifier() {
  const latest = useQuery(api.messages.getLatestUnread, {});
  const navigate = useNavigate();
  const location = useLocation();

  // Remembers the newest unread message id we've already handled. Starts as
  // undefined so the very first query result only primes the ref (no toast for
  // messages that were already unread before the app loaded).
  const lastSeenId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Still loading – do nothing.
    if (latest === undefined) return;

    // No unread messages: reset so a future message will alert again.
    if (latest === null) {
      lastSeenId.current = null;
      return;
    }

    // First real result after load: prime the ref without alerting.
    if (lastSeenId.current === undefined) {
      lastSeenId.current = latest.messageId;
      return;
    }

    // Already alerted for this message.
    if (lastSeenId.current === latest.messageId) return;

    lastSeenId.current = latest.messageId;

    // Don't pop up if the user is already viewing this conversation.
    if (location.pathname === `/messages/${latest.conversationId}`) return;

    const senderName = latest.senderName ?? "Seseorang";
    toast(`Pesan baru dari ${senderName}`, {
      description:
        latest.preview.length > 80
          ? `${latest.preview.slice(0, 80)}...`
          : latest.preview,
      icon: <MessageSquare className="size-4 text-primary" />,
      action: {
        label: "Buka",
        onClick: () => navigate(`/messages/${latest.conversationId}`),
      },
    });
  }, [latest, navigate, location.pathname]);

  return null;
}
