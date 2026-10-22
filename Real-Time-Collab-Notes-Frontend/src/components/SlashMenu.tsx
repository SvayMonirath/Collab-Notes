'use client';

import React from 'react';
import { Type, Heading1, Heading2, CheckSquare, Info, Minus } from 'lucide-react';

interface SlashMenuProps {
  isOpen: boolean;
  onSelect: (type: string) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({ isOpen, onSelect, onClose }) => {
  if (!isOpen) return null;

  const items = [
    { id: 'text', title: 'Text', desc: 'Just start writing with plain text.', icon: Type },
    { id: 'h1', title: 'Heading 1', desc: 'Big section heading.', icon: Heading1 },
    { id: 'h2', title: 'Heading 2', desc: 'Medium section heading.', icon: Heading2 },
    { id: 'todo', title: 'To-do list', desc: 'Track tasks with an interactive checkbox.', icon: CheckSquare },
    { id: 'callout', title: 'Callout', desc: 'Highlight important text with an icon.', icon: Info },
    { id: 'divider', title: 'Divider', desc: 'Visually divide sections with a thin line.', icon: Minus },
  ];

  return (
    <div className="absolute z-50 bg-white border border-notion-border rounded-md shadow-xl py-1.5 w-[280px] text-[13.5px]">
      <div className="px-3 py-1 text-[11px] font-semibold text-notion-light uppercase tracking-wider">
        Basic Blocks
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            onClick={() => {
              onSelect(item.id);
              onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-notion-hover cursor-pointer transition-colors"
          >
            <div className="w-[26px] h-[26px] rounded border border-notion-border bg-white flex items-center justify-center text-notion-muted">
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-notion-ink">{item.title}</span>
              <span className="text-[11.5px] text-notion-light leading-tight">{item.desc}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
