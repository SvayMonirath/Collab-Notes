import * as Y from 'yjs';
import { Socket } from 'socket.io-client';

export interface UserAwareness {
  userId: string;
  name: string;
  color: string;
  cursor?: { anchor: number; head: number } | null;
}

export class SocketIoYjsProvider {
  public doc: Y.Doc;
  public socket: Socket;
  public roomName: string;
  public user: UserAwareness;
  public peers: Map<string, UserAwareness> = new Map();
  private onAwarenessChangeCallbacks: Array<(peers: Map<string, UserAwareness>) => void> = [];

  constructor(doc: Y.Doc, socket: Socket, roomName: string, user: UserAwareness) {
    this.doc = doc;
    this.socket = socket;
    this.roomName = roomName;
    this.user = user;

    this.init();
  }

  private init() {
    // 1. Initial Handshake: Send local state vector to server
    const stateVector = Y.encodeStateVector(this.doc);
    const vectorBase64 = Buffer.from(stateVector).toString('base64');

    this.socket.emit(
      'yjs_sync_step_1',
      { roomName: this.roomName, stateVector: vectorBase64 },
      (res: any) => {
        if (res && res.status === 'success' && res.data) {
          if (res.data.update) {
            const updateBytes = Buffer.from(res.data.update, 'base64');
            Y.applyUpdate(this.doc, new Uint8Array(updateBytes), 'server');
          }
        }
      }
    );

    // 2. Listen for local Y.Doc updates and send to server
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'server') {
        const updateBase64 = Buffer.from(update).toString('base64');
        this.socket.emit('yjs_update', {
          roomName: this.roomName,
          update: updateBase64,
        });
      }
    });

    // 3. Receive remote Y.Doc updates from server
    this.socket.on('yjs_update', (payload: { update: string }) => {
      if (payload && payload.update) {
        const updateBytes = Buffer.from(payload.update, 'base64');
        Y.applyUpdate(this.doc, new Uint8Array(updateBytes), 'server');
      }
    });

    // 4. Awareness: Broadcast own cursor & receive peer cursors
    this.socket.on('yjs_awareness', (payload: { userId: string; awareness: UserAwareness }) => {
      if (payload && payload.userId && payload.userId !== this.user.userId) {
        this.peers.set(payload.userId, payload.awareness);
        this.notifyAwareness();
      }
    });

    // Broadcast initial presence
    this.broadcastAwareness();
  }

  public setCursor(cursor: { anchor: number; head: number } | null) {
    this.user.cursor = cursor;
    this.broadcastAwareness();
  }

  public onAwarenessChange(callback: (peers: Map<string, UserAwareness>) => void) {
    this.onAwarenessChangeCallbacks.push(callback);
    callback(new Map(this.peers));
  }

  private notifyAwareness() {
    for (const cb of this.onAwarenessChangeCallbacks) {
      cb(new Map(this.peers));
    }
  }

  private broadcastAwareness() {
    this.socket.emit('yjs_awareness', {
      roomName: this.roomName,
      awareness: this.user,
    });
  }

  public destroy() {
    this.socket.off('yjs_update');
    this.socket.off('yjs_awareness');
    this.onAwarenessChangeCallbacks = [];
  }
}
