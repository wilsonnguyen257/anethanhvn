import { useRef, useEffect, useCallback } from 'react';

interface VisualEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** id of an element that labels the editor, when the label lives outside it. */
  labelledBy?: string;
  required?: boolean;
}

export default function VisualEditor({
  value,
  onChange,
  placeholder,
  label,
  labelledBy,
  required = false
}: VisualEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Update editor content when value changes externally. Skipping the write
  // when the DOM already matches keeps the caret from jumping while typing.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Smart paste handler - keeps structure and bold, removes backgrounds
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    
    const clipboardData = e.clipboardData;
    const html = clipboardData.getData('text/html');
    const text = clipboardData.getData('text/plain');

    if (html && editorRef.current) {
      const cleanedHtml = cleanPastedHTML(html);
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const temp = document.createElement('div');
        temp.innerHTML = cleanedHtml;
        
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) {
          fragment.appendChild(temp.firstChild);
        }
        range.insertNode(fragment);
        range.collapse(false);
      } else {
        editorRef.current.innerHTML += cleanedHtml;
      }
      
      handleInput();
    } else if (text && editorRef.current) {
      const paragraphs = text.split(/\n\n+/);
      const html = paragraphs
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const fragment = range.createContextualFragment(html);
        range.insertNode(fragment);
        range.collapse(false);
      } else {
        editorRef.current.innerHTML += html;
      }
      
      handleInput();
    }
  }, [handleInput]);

  // Clean pasted HTML - keep structure and bold, remove backgrounds
  const cleanPastedHTML = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove script, style, meta tags
    const unwanted = ['script', 'style', 'meta', 'link', 'iframe'];
    unwanted.forEach(tag => {
      const elements = temp.getElementsByTagName(tag);
      for (let i = elements.length - 1; i >= 0; i--) {
        elements[i].remove();
      }
    });

    // Process all elements
    const allElements = temp.querySelectorAll('*');
    allElements.forEach((el: Element) => {
      // Remove tracking/data attributes
      const attrsToRemove: string[] = [];
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i].name;
        if (attr.startsWith('data-') || attr === 'class' || attr === 'id' || 
            attr.startsWith('on') || attr === 'role' || attr.startsWith('aria-')) {
          attrsToRemove.push(attr);
        }
      }
      attrsToRemove.forEach(attr => el.removeAttribute(attr));

      // Clean style - keep only font-weight (bold), remove backgrounds
      const style = el.getAttribute('style');
      if (style) {
        const keepStyles: string[] = [];
        const styleProps = style.split(';');
        
        styleProps.forEach((prop: string) => {
          const parts = prop.split(':');
          if (parts.length < 2) return;
          const name = parts[0].trim().toLowerCase();
          const val = parts[1].trim().toLowerCase();
          
          if (name === 'font-weight' && (val === 'bold' || val === '700' || val === '600')) {
            keepStyles.push('font-weight: bold');
          }
          if (name === 'font-style' && val === 'italic') {
            keepStyles.push('font-style: italic');
          }
          if (name === 'text-decoration' && val.includes('underline')) {
            keepStyles.push('text-decoration: underline');
          }
        });

        if (keepStyles.length > 0) {
          el.setAttribute('style', keepStyles.join('; '));
        } else {
          el.removeAttribute('style');
        }
      }
    });

    // Convert spans with bold to <strong>
    const spans = temp.querySelectorAll('span');
    spans.forEach((span: Element) => {
      const style = span.getAttribute('style');
      if (style && style.includes('font-weight')) {
        const strong = document.createElement('strong');
        strong.innerHTML = span.innerHTML;
        span.parentNode?.replaceChild(strong, span);
      } else if (!span.hasAttributes()) {
        const parent = span.parentNode;
        while (span.firstChild) {
          parent?.insertBefore(span.firstChild, span);
        }
        parent?.removeChild(span);
      }
    });

    return temp.innerHTML;
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const formatButtons = [
    { icon: '𝐁', command: 'bold', title: 'Bold (Ctrl+B)' },
    { icon: '𝐼', command: 'italic', title: 'Italic (Ctrl+I)' },
    { icon: 'U̲', command: 'underline', title: 'Underline (Ctrl+U)' },
    { icon: 'S̶', command: 'strikeThrough', title: 'Strikethrough' },
  ];

  const headingButtons = [
    { label: 'H1', command: 'formatBlock', value: 'H1', title: 'Heading 1' },
    { label: 'H2', command: 'formatBlock', value: 'H2', title: 'Heading 2' },
    { label: 'H3', command: 'formatBlock', value: 'H3', title: 'Heading 3' },
    { label: 'P', command: 'formatBlock', value: 'P', title: 'Paragraph' },
  ];

  const listButtons = [
    { icon: '• •', command: 'insertUnorderedList', title: 'Bullet List' },
    { icon: '1. 2.', command: 'insertOrderedList', title: 'Numbered List' },
  ];

  const alignButtons = [
    { icon: '≡', command: 'justifyLeft', title: 'Align Left' },
    { icon: '≡', command: 'justifyCenter', title: 'Align Center', style: 'text-center' },
    { icon: '≡', command: 'justifyRight', title: 'Align Right', style: 'text-right' },
  ];

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      {/* Toolbar */}
      <div role="toolbar" aria-label="Text formatting" className="bg-slate-100 border border-slate-200 rounded-t-xl p-2 flex flex-wrap gap-1">
        {/* Format buttons */}
        <div className="flex gap-1 border-r border-slate-200 pr-2">
          {formatButtons.map((btn) => (
            <button
              key={btn.command}
              type="button"
              onClick={() => execCommand(btn.command)}
              title={btn.title}
              aria-label={btn.title}
              className="px-3 py-1.5 text-sm font-semibold bg-surface hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Heading buttons */}
        <div className="flex gap-1 border-r border-slate-200 pr-2">
          {headingButtons.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => execCommand(btn.command, btn.value)}
              title={btn.title}
              aria-label={btn.title}
              className="px-3 py-1.5 text-sm font-semibold bg-surface hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* List buttons */}
        <div className="flex gap-1 border-r border-slate-200 pr-2">
          {listButtons.map((btn) => (
            <button
              key={btn.command}
              type="button"
              onClick={() => execCommand(btn.command)}
              title={btn.title}
              aria-label={btn.title}
              className="px-3 py-1.5 text-xs bg-surface hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Align buttons */}
        <div className="flex gap-1 border-r border-slate-200 pr-2">
          {alignButtons.map((btn) => (
            <button
              key={btn.command}
              type="button"
              onClick={() => execCommand(btn.command)}
              title={btn.title}
              aria-label={btn.title}
              className={`px-3 py-1.5 text-sm bg-surface hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors ${btn.style || ''}`}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Link button */}
        <button
          type="button"
          onClick={insertLink}
          title="Insert Link"
          aria-label="Insert Link"
          className="px-3 py-1.5 text-sm bg-surface hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
        >
          🔗
        </button>

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() => execCommand('removeFormat')}
          title="Clear Formatting"
          aria-label="Clear Formatting"
          className="px-3 py-1.5 text-sm bg-surface hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-required={required || undefined}
        onInput={handleInput}
        onPaste={handlePaste}
        className="w-full min-h-[200px] p-4 border border-slate-200 rounded-b-xl bg-surface text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600 overflow-auto"
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style>{`
        [contentEditable]:empty:before {
          content: attr(data-placeholder);
          color: #61656C;
          pointer-events: none;
          position: absolute;
        }
        [contentEditable] {
          line-height: 1.6;
        }
        [contentEditable] h1 {
          font-size: 2em;
          font-weight: bold;
          margin: 0.67em 0;
        }
        [contentEditable] h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.75em 0;
        }
        [contentEditable] h3 {
          font-size: 1.17em;
          font-weight: bold;
          margin: 0.83em 0;
        }
        [contentEditable] p {
          margin: 1em 0;
        }
        [contentEditable] ul, [contentEditable] ol {
          margin: 1em 0;
          padding-left: 2.5em;
        }
        [contentEditable] ul {
          list-style-type: disc;
        }
        [contentEditable] ol {
          list-style-type: decimal;
        }
        [contentEditable] li {
          margin: 0.5em 0;
        }
        [contentEditable] a {
          color: #0D324D;
          text-decoration: underline;
        }
        [contentEditable] strong, [contentEditable] b {
          font-weight: bold;
        }
        [contentEditable] em, [contentEditable] i {
          font-style: italic;
        }
        [contentEditable] u {
          text-decoration: underline;
        }
        [contentEditable] strike, [contentEditable] s {
          text-decoration: line-through;
        }
        .dark [contentEditable] a {
          color: #60a5fa;
        }
      `}</style>
    </div>
  );
}
