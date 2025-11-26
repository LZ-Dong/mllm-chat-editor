import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:9000/chat';

type ContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function mergeTextItems(items: ContentItem[]): ContentItem[] {
  const merged: ContentItem[] = [];
  for (const item of items) {
    if (item.type === 'text' && item.text.trim() === '') {
      continue;
    }

    const last = merged[merged.length - 1];
    if (last && last.type === 'text' && item.type === 'text') {
      merged[merged.length - 1] = { type: 'text', text: `${last.text}\n${item.text}` };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function extractContentItems(html: string): ContentItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;
  const items: ContentItem[] = [];

  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textValue = node.textContent ?? '';
      if (textValue.trim().length > 0) {
        items.push({ type: 'text', text: textValue });
      }
    } else if (node instanceof HTMLImageElement && node.src) {
      items.push({ type: 'image_url', image_url: { url: node.src } });
    }
    node = walker.nextNode();
  }

  return mergeTextItems(items);
}

function App() {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  const handleFormat = (command: string) => {
    document.execCommand(command);
  };

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!editorRef.current || typeof reader.result !== 'string') return;
      document.execCommand('insertImage', false, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      insertImage(file);
      event.target.value = '';
    }
  };

  const handleSend = async () => {
    if (!editorRef.current) return;

    const htmlContent = editorRef.current.innerHTML;
    const items = extractContentItems(htmlContent);
    if (items.length === 0) {
      setStatus('Please add text or an image before sending.');
      return;
    }

    const userText = items
      .map((item) => (item.type === 'text' ? item.text : '[image]'))
      .join(' ');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setIsSending(true);
    setStatus('Sending to model…');

    try {
      const response = await axios.post<{ reply: string }>(BACKEND_URL, { items });
      setMessages((prev) => [...prev, { role: 'assistant', content: response.data.reply }]);
      setStatus('');
    } catch (error) {
      console.error(error);
      setStatus('Failed to reach backend. Is it running?');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div>
      <header style={{ marginBottom: '1rem' }}>
        <h1>mllm-chat-editor</h1>
        <p className="status">
          Build a mixed text + image prompt and send it to the local Qwen3-VL model.
        </p>
      </header>

      <div className="button-row toolbar">
        <button type="button" onClick={() => handleFormat('bold')}>
          Bold
        </button>
        <button type="button" onClick={() => handleFormat('italic')}>
          Italic
        </button>
        <label style={{ display: 'inline-block' }}>
          <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          <button type="button">Insert Image</button>
        </label>
      </div>

      <div
        ref={editorRef}
        className="editor"
        contentEditable
        suppressContentEditableWarning
        placeholder="Type text here and insert images…"
      />

      <div className="button-row" style={{ marginTop: '0.75rem' }}>
        <button type="button" onClick={handleSend} disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
        {status && <span className="status">{status}</span>}
      </div>

      <div className="chat-area">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role === 'user' ? 'You' : 'Model'}:</strong> {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
