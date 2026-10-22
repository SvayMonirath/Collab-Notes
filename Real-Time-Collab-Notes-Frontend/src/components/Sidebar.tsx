'use client';

import React from 'react';
import {
  Grid,
  Search,
  Clock,
  Settings,
  FileText,
  Zap,
  CheckSquare,
  Boxes,
  Users,
  Plus,
  ChevronDown,
} from 'lucide-react';

interface SidebarProps {
  currentRoom: string;
  rooms: string[];
  onSelectRoom: (roomName: string) => void;
  onCreateRoom: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoom,
  rooms,
  onSelectRoom,
  onCreateRoom,
}) => {
  return (
    <aside className="w-[250px] bg-notion-sidebar border-r border-notion-border flex flex-col flex-shrink-0 select-none text-[13.5px]">
      {/* Workspace Switcher */}
      <div className="p-3 mx-1 my-1 flex items-center justify-between rounded-md hover:bg-notion-hover cursor-pointer transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-[22px] h-[22px] rounded bg-blue-600 text-white flex items-center justify-center">
            <Grid className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-notion-ink truncate max-w-[150px]">
            Personal Workspace
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-notion-light" />
      </div>

      {/* Main Nav Items */}
      <div className="px-1.5 py-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2.5 px-2 py-1 rounded-md text-notion-muted hover:bg-notion-hover hover:text-notion-ink cursor-pointer transition-colors">
          <Search className="w-4 h-4" />
          <span>Search</span>
          <span className="ml-auto text-[10px] text-notion-light border border-notion-border px-1 py-0.5 rounded font-mono">⌘K</span>
        </div>
        <div className="flex items-center gap-2.5 px-2 py-1 rounded-md text-notion-muted hover:bg-notion-hover hover:text-notion-ink cursor-pointer transition-colors">
          <Clock className="w-4 h-4" />
          <span>Updates</span>
        </div>
        <div className="flex items-center gap-2.5 px-2 py-1 rounded-md text-notion-muted hover:bg-notion-hover hover:text-notion-ink cursor-pointer transition-colors">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </div>
      </div>

      {/* Document Tree - Private */}
      <div className="text-[11px] font-semibold text-notion-light px-2.5 pt-4 pb-1 tracking-wider uppercase">
        Private
      </div>
      <div className="px-1.5 flex flex-col gap-0.5">
        {rooms.map((room) => {
          const isActive = currentRoom === room;
          return (
            <div
              key={room}
              onClick={() => onSelectRoom(room)}
              className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-colors ${
                isActive
                  ? 'bg-notion-active font-medium text-notion-ink'
                  : 'text-notion-ink hover:bg-notion-hover'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-notion-muted" />
              <span className="truncate">{room}</span>
            </div>
          );
        })}
      </div>

      {/* Document Tree - Shared */}
      <div className="text-[11px] font-semibold text-notion-light px-2.5 pt-4 pb-1 tracking-wider uppercase">
        Shared
      </div>
      <div className="px-1.5 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 px-2 py-1 rounded-md text-notion-ink hover:bg-notion-hover cursor-pointer transition-colors">
          <Users className="w-3.5 h-3.5 text-notion-muted" />
          <span>Team Standup Notes</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 rounded-md text-notion-ink hover:bg-notion-hover cursor-pointer transition-colors">
          <Zap className="w-3.5 h-3.5 text-notion-muted" />
          <span>Architecture RFC</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Footer / New Page Button */}
      <div className="p-3 border-t border-notion-border flex items-center justify-between text-xs text-notion-light">
        <button
          onClick={onCreateRoom}
          className="flex items-center gap-1.5 text-notion-ink hover:text-blue-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Page</span>
        </button>
        <span className="font-mono text-[10px]">CRDT Active</span>
      </div>
    </aside>
  );
};
