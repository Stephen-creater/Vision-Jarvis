import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Strip YAML frontmatter before rendering
  const body = content.replace(/^---[\s\S]*?---\s*/, '')

  return (
    <div className={`markdown-body ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {body}
      </ReactMarkdown>
    </div>
  )
}
