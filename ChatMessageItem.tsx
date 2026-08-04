import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import { Sparkles, User2, AlertCircle, ExternalLink, Copy, Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Button } from "@/components/ui/button.tsx";
import { toast } from "sonner";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type Props = {
  message: Doc<"aiChatMessages">;
  onSuggestionClick?: (suggestion: string) => void;
};

/** Match markdown links like [Label](/path) and render as in-app navigation */
function InAppLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  const navigate = useNavigate();
  const isInternal = href?.startsWith("/");

  if (isInternal && href) {
    return (
      <button
        onClick={() => navigate(href)}
        className="inline-flex cursor-pointer items-center gap-1 font-medium text-primary underline underline-offset-2 hover:text-primary/80"
      >
        {children}
        <ExternalLink className="inline size-3" />
      </button>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
      {children}
    </a>
  );
}

function ChatMessageItem({ message, onSuggestionClick }: Props) {
  const isUser = message.role === "user";
  const isPending = message.status === "pending";
  const isError = message.status === "error";
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("Teks disalin");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin teks");
    }
  };

  const suggestions = message.suggestions ?? [];

  return (
    <div
      className={cn(
        "flex w-full gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm",
        )}
      >
        {isUser ? <User2 className="size-4" /> : <Sparkles className="size-4" />}
      </div>

      <div
        className={cn(
          "min-w-0 max-w-[85%] space-y-2",
          isUser ? "items-end text-right" : "items-start text-left",
        )}
      >
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-foreground",
            isError && !isUser && "border-destructive/40 bg-destructive/5",
          )}
        >
          {isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="size-3.5" />
              <span className="animate-pulse">Starfa sedang berpikir...</span>
            </div>
          ) : isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div
              className={cn(
                "prose prose-sm max-w-none text-inherit",
                "prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0",
                "prose-pre:my-2 prose-code:text-xs prose-strong:text-foreground",
                "dark:prose-invert",
              )}
            >
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => <InAppLink href={href}>{children}</InAppLink>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Copy button for assistant messages */}
        {!isUser && !isPending && !isError && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-6 cursor-pointer gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Disalin" : "Salin"}
            </Button>
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && !isPending && suggestions.length > 0 && onSuggestionClick && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(s)}
                className="cursor-pointer rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 transition-all hover:border-violet-300 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:border-violet-700 dark:hover:bg-violet-900/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {isError ? (
          <div className="inline-flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" /> Pesan gagal dikirim
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default memo(ChatMessageItem);
