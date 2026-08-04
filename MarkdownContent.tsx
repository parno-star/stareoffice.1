import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils.ts";

/** Render markdown content using sane defaults for wiki articles. */
export default function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none text-foreground dark:prose-invert",
        // Typography tweaks that Tailwind prose doesn't cover well
        "prose-headings:scroll-mt-24 prose-headings:font-bold prose-headings:tracking-tight",
        "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
        "prose-p:leading-relaxed",
        "prose-a:text-primary prose-a:underline-offset-4 hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:rounded-lg prose-pre:border prose-pre:bg-muted/60 prose-pre:text-foreground",
        "prose-blockquote:border-l-primary prose-blockquote:text-foreground/80",
        "prose-img:rounded-lg prose-img:border",
        "prose-hr:my-6",
        "prose-table:text-sm",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
