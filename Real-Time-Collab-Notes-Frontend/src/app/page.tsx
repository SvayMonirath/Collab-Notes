'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { Editor } from '@/components/Editor';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { UserAwareness } from '@/lib/yjs-provider';
import { Socket } from 'socket.io-client';

export default function WorkspacePage() {
  const [currentRoom, setCurrentRoom] = useState('design-sync');
  const [rooms, setRooms] = useState<string[]>(['design-sync', 'architecture-specs', 'product-roadmap']);
  const [peers, setPeers] = useState<UserAwareness[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Generate a consistent user identity for this session
  const [currentUser] = useState<UserAwareness>(() => {
    const id = 'user-' + Math.floor(Math.random() * 1000);
    const colors = ['#8752a3', '#d9730d', '#2383e2', '#0f7b6c', '#e03e3e'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    return {
      userId: id,
      name: 'User ' + id.slice(-3),
      color: randomColor,
    };
  });

  // Connect to backend Socket.IO gateway
  useEffect(() => {
    // Generate simple development JWT for socket auth middleware
    // Backend accepts tokens signed with JWT_SECRET containing userId
    const devToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyLW1vbmlyYXRoIiwic3ViIjoidXNlci1tb25pcmF0aCJ9.dev';
    
    // Fallback: connect with token in query
    const s = getSocket(devToken);
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      s.emit('join_room', { roomName: currentRoom }, (res: any) => {
        // Room joined
      });
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      disconnectSocket();
    };
  }, [currentRoom]);

  // Fetch rooms from backend REST API
  useEffect(() => {
    fetch('http://localhost:8000/room')
      .then((res) => res.json())
      .then((json) => {
        if (json && json.data && Array.isArray(json.data) && json.data.length > 0) {
          const names = json.data.map((r: any) => r.name);
          setRooms((prev) => Array.from(new Set([...names, ...prev])));
        }
      })
      .catch(() => {
        // Use default rooms if API not currently mounted
      });
  }, []);

  const handleCreateRoom = async () => {
    const name = prompt('Enter new document name:', 'new-document-' + Math.floor(Math.random() * 100));
    if (!name) return;

    try {
      await fetch('http://localhost:8000/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    } catch {
      // Offline fallback
    }

    setRooms((prev) => [...prev, name]);
    setCurrentRoom(name);
  };

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      alert(`Link copied to clipboard! Share this URL to collaborate live in "${currentRoom}".`);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Notion Sidebar */}
      <Sidebar
        currentRoom={currentRoom}
        rooms={rooms}
        onSelectRoom={(name) => setCurrentRoom(name)}
        onCreateRoom={handleCreateRoom}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <TopBar
          roomName={currentRoom}
          peers={peers}
          isConnected={isConnected}
          onShare={handleShare}
        />

        <Editor
          key={currentRoom}
          roomName={currentRoom}
          socket={socket}
          user={currentUser}
          onPeersUpdate={(updatedPeers) => setPeers(updatedPeers)}
        />
      </div>
    </div>
  );
}
