'use client';

import React from 'react';
import { Share2, Star, MoreHorizontal, ChevronRight, CheckCircle2 } from 'lucide-react';
import { UserAwareness } from '@/lib/yjs-provider';

interface TopBarProps {
  roomName: string;
  peers: UserAwareness[];
  isConnected: boolean;
  onShare: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  roomName,
  peers,
  isConnected,
  onShare,
}) => {
  return (
    <header className="h-[45px] px-4 flex items-center justify-between text-[13px] text-notion-muted border-b border-transparent select-none bg-white">
      <div className="flex items-center gap-1.5">
        <span className="cursor-pointer hover:bg-notion-hover hover:text-notion-ink px-1.5 py-0.5 rounded">
          Personal Workspace
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-notion-light" />
        <span className="text-notion-ink font-medium px-1.5 py-0.5 rounded">
          {roomName}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-xs text-notion-light mr-1">
          <CheckCircle2 className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span>{isConnected ? 'Saved to cloud' : 'Reconnecting...'}</span>
        </div>

        {/* Real-time Peer Avatars */}
        <div className="flex items-center pl-1">
          <div
            className="w-6 h-6 rounded-full border-2 border-white text-white text-[10px] font-semibold flex items-center justify-center bg-blue-500 shadow-sm"
            title="You (Editor)"
          >
            ME
          </div>
          {peers.map((peer, idx) => (
            <div
              key={peer.userId || idx}
              style={{ backgroundColor: peer.color || '#8752a3' }}
              className="w-6 h-6 rounded-full border-2 border-white -ml-1.5 text-white text-[10px] font-semibold flex items-center justify-center shadow-sm"
              title={`${peer.name} (${peer.userId})`}
            >
              {peer.name ? peer.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
          ))}
        </div>

        <button
          onClick={onShare}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-notion-ink hover:bg-notion-hover border border-notion-border font-medium text-[13px] transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>

        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-notion-hover text-notion-muted hover:text-notion-ink"
          title="Favorite"
        >
          <Star className="w-3.5 h-3.5" />
        </button>

        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-notion-hover text-notion-muted hover:text-notion-ink"
          title="More options"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
