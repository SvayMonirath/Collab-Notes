'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { FileText, Info, ChevronRight, Plus, GripVertical } from 'lucide-react';
import { SocketIoYjsProvider, UserAwareness } from '@/lib/yjs-provider';
import { SlashMenu } from './SlashMenu';
import { Socket } from 'socket.io-client';

interface EditorProps {
  roomName: string;
  socket: Socket | null;
  user: UserAwareness;
  onPeersUpdate: (peers: UserAwareness[]) => void;
}

export const Editor: React.FC<EditorProps> = ({
  roomName,
  socket,
  user,
  onPeersUpdate,
}) => {
  const [doc] = useState(() => new Y.Doc());
  const [title, setTitle] = useState(roomName);
  const [provider, setProvider] = useState<SocketIoYjsProvider | null>(null);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState({ top: 300, left: 60 });
  const [isToggleOpen, setIsToggleOpen] = useState(false);

  // Initialize Socket.io Yjs Provider
  useEffect(() => {
    if (!socket) return;

    const yjsProvider = new SocketIoYjsProvider(doc, socket, roomName, user);
    setProvider(yjsProvider);

    yjsProvider.onAwarenessChange((peersMap) => {
      onPeersUpdate(Array.from(peersMap.values()));
    });

    return () => {
      yjsProvider.destroy();
    };
  }, [doc, socket, roomName, user, onPeersUpdate]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false, // Handled by Yjs
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Placeholder.configure({
          placeholder: "Type '/' for commands or start writing...",
        }),
        Collaboration.configure({
          document: doc,
        }),
      ],
      editorProps: {
        attributes: {
          class: 'focus:outline-none min-h-[300px]',
        },
        handleKeyDown: (view, event) => {
          if (event.key === '/') {
            const { from } = view.state.selection;
            const coords = view.coordsAtPos(from);
            setSlashMenuPos({ top: coords.bottom + 8, left: coords.left });
            setShowSlashMenu(true);
          } else if (event.key === 'Escape') {
            setShowSlashMenu(false);
          }
          return false;
        },
      },
    },
    [doc]
  );

  const handleSlashSelect = (type: string) => {
    if (!editor) return;

    if (type === 'h1') {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    } else if (type === 'h2') {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    } else if (type === 'todo') {
      editor.chain().focus().toggleTaskList().run();
    } else if (type === 'callout') {
      editor.chain().focus().toggleBlockquote().run();
    } else if (type === 'divider') {
      editor.chain().focus().setHorizontalRule().run();
    } else {
      editor.chain().focus().setParagraph().run();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto flex justify-center py-10 px-6 relative bg-white">
      <div className="w-full max-w-[780px] relative">
        {/* Document Icon Badge (Notion style, clean SVG) */}
        <div
          className="w-12 h-12 rounded-lg bg-[#f1f1ef] border border-notion-border flex items-center justify-center mb-5 cursor-pointer hover:bg-[#e8e8e6] transition-colors"
          title="Change Page Icon"
        >
          <FileText className="w-6 h-6 text-notion-ink stroke-[1.5]" />
        </div>

        {/* Page Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="text-[40px] font-bold text-notion-ink w-full bg-transparent border-none outline-none mb-6 tracking-tight"
        />

        {/* Notion Callout Block */}
        <div className="bg-notion-callout border border-notion-border rounded-md p-4 flex gap-3.5 items-start my-4 text-[15px] leading-relaxed">
          <div className="w-5 h-5 flex items-center justify-center text-notion-muted mt-0.5 flex-shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <strong className="text-notion-ink">Real-Time Workspace:</strong> Changes sync via{' '}
            <span className="bg-purple-100 text-purple-900 px-1 py-0.5 rounded font-mono text-xs">Yjs CRDT</span>{' '}
            with mathematical convergence. No concurrent overwrite errors.
          </div>
        </div>

        {/* Main Tiptap ProseMirror Area */}
        <div className="relative group my-2">
          {/* Notion Block Gutter Hover Handle */}
          <div className="absolute -left-9 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 text-notion-light cursor-pointer select-none">
            <button
              onClick={() => {
                if (editor) editor.chain().focus().setParagraph().run();
              }}
              className="w-4 h-5 flex items-center justify-center hover:bg-notion-hover hover:text-notion-ink rounded"
              title="Add a block below"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div
              className="w-4 h-5 flex items-center justify-center hover:bg-notion-hover hover:text-notion-ink rounded cursor-grab"
              title="Drag to move"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
          </div>

          <EditorContent editor={editor} />
        </div>

        {/* Notion Interactive Toggle Accordion Block */}
        <div className="my-4 pt-2">
          <div
            onClick={() => setIsToggleOpen(!isToggleOpen)}
            className="flex items-center gap-1.5 cursor-pointer font-medium text-notion-ink text-[15px] select-none hover:bg-notion-hover p-1 rounded transition-colors"
          >
            <ChevronRight
              className={`w-4 h-4 text-notion-muted transition-transform duration-150 ${
                isToggleOpen ? 'rotate-90' : ''
              }`}
            />
            <span>Technical Architecture & Collaboration Invariants</span>
          </div>
          {isToggleOpen && (
            <div className="ml-5 mt-1.5 text-[14.5px] text-notion-muted leading-relaxed border-l-2 border-notion-border pl-3 py-1">
              Document states are distributed as binary delta logs over WebSockets. Multiple users typing in the same sentence merge conflict-free. All operations are backed up to PostgreSQL asynchronously.
            </div>
          )}
        </div>

        {/* Floating Slash Command Dropdown */}
        <div style={{ top: slashMenuPos.top, left: slashMenuPos.left }} className="fixed z-50">
          <SlashMenu
            isOpen={showSlashMenu}
            onSelect={handleSlashSelect}
            onClose={() => setShowSlashMenu(false)}
          />
        </div>
      </div>
    </div>
  );
};
