import { RoomService } from 'src/service/room.service';
import { SocketAuthMiddleware } from 'src/middleware/socket-auth.middleware';
import { NoteRepository } from 'src/repository/note.repository';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Note, Role } from 'generated/prisma/client';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

type RoomLookupPayload = {
  roomName?: string;
  roomId?: string;
};

type SocketData = {
  userId?: string;
  role?: Role;
  roomId?: string;
};

type ConnectedUser = {
  socketId: string;
  userId?: string;
  role?: Role;
};

type RoomResponse = {
  data: {
    id: string;
    name: string;
  };
};

type UpdateNotePayload = RoomLookupPayload & {
  content?: string;
  noteContent?: string;
  clientVersion?: number;
};

type YjsSyncStep1Payload = RoomLookupPayload & {
  stateVector: string; // Base64 encoded state vector
};

type YjsUpdatePayload = RoomLookupPayload & {
  update: string; // Base64 encoded Yjs update
};

type YjsAwarenessPayload = RoomLookupPayload & {
  awareness: any;
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  maxHttpBufferSize: 1e7, // 10MB
})
export class NoteGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly roomMembers = new Map<string, ConnectedUser[]>();
  private readonly roomDocs = new Map<string, Y.Doc>();
  private readonly saveTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly roomService: RoomService,
    private readonly noteRepository: NoteRepository,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
  ) {}

  @WebSocketServer()
  server!: Server;

  afterInit(server: Server) {
    // Configure Redis adapter if available
    try {
      const redisHost = process.env.REDIS_HOST || 'localhost';
      const redisPort = Number(process.env.REDIS_PORT) || 6379;
      const pubClient = new Redis({
        host: redisHost,
        port: redisPort,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      const subClient = pubClient.duplicate();

      pubClient
        .connect()
        .then(() => subClient.connect())
        .then(() => {
          server.adapter(createAdapter(pubClient, subClient));
        })
        .catch(() => {
          // Fallback cleanly to in-memory adapter if Redis isn't responding
        });
    } catch {
      // Clean fallback
    }

    server.use((socket, next) => {
      const token = socket.handshake.query.token as string;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      try {
        const payload = this.socketAuthMiddleware.validateToken(token);
        const socketData = socket.data as SocketData;
        socketData.userId = payload.userId;
        next();
      } catch (error) {
        next(error as Error);
      }
    });
  }

  handleConnection(client: Socket) {
    const socketData = client.data as SocketData;
    client.emit('connected', {
      socketId: client.id,
      userId: socketData.userId,
    });
  }

  handleDisconnect(client: Socket) {
    for (const [roomId, members] of this.roomMembers.entries()) {
      const nextMembers = members.filter(
        (member) => member.socketId !== client.id,
      );

      if (nextMembers.length === members.length) {
        continue;
      }

      if (nextMembers.length === 0) {
        this.roomMembers.delete(roomId);
        // Persist doc if needed when last user disconnects
        this.flushRoomDoc(roomId);
      } else {
        this.roomMembers.set(roomId, nextMembers);
      }

      this.server.to(roomId).emit('room_presence', {
        roomId,
        members: nextMembers,
      });
    }

    client.emit('disconnected', {
      socketId: client.id,
    });
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(client: Socket, payload: RoomLookupPayload) {
    const room = await this.resolveRoom(payload);
    const userId = (client.data as SocketData).userId;

    if (!userId) {
      throw new WsException('Unauthorized');
    }

    // RBAC: Ensure user is a member of the room and retrieve assigned role
    const member = await this.roomService.ensure_member(room.data.id, userId);
    const socketData = client.data as SocketData;
    socketData.role = member.role;
    socketData.roomId = room.data.id;

    await client.join(room.data.id);

    const currentMembers = this.roomMembers.get(room.data.id) ?? [];
    const filteredMembers = currentMembers.filter(
      (m) => m.socketId !== client.id,
    );
    const updatedMembers: ConnectedUser[] = [
      ...filteredMembers,
      {
        socketId: client.id,
        userId: userId,
        role: member.role,
      },
    ];

    this.roomMembers.set(room.data.id, updatedMembers);

    // Initialize or load Y.Doc for this room
    await this.getOrCreateDoc(room.data.id);

    this.server.to(room.data.id).emit('room_presence', {
      roomId: room.data.id,
      members: updatedMembers,
    });

    return {
      status: 'success',
      message: `Joined room ${room.data.id}`,
      data: {
        ...room.data,
        userRole: member.role,
      },
    };
  }

  @SubscribeMessage('get_note_snapshot')
  async handleGetNoteSnapshot(
    client: Socket,
    payload: RoomLookupPayload,
  ): Promise<{ status: string; data: Note }> {
    const room = await this.resolveRoom(payload);
    const note = await this.noteRepository.createOrGetNote(room.data.id);

    return {
      status: 'success',
      data: note,
    };
  }

  @SubscribeMessage('update_note')
  async handleUpdateNote(
    client: Socket,
    payload: UpdateNotePayload,
  ): Promise<{
    status: string;
    message: string;
    data: Note;
  }> {
    const room = await this.resolveRoom(payload);
    const socketData = client.data as SocketData;

    // RBAC Enforcement: Viewers cannot edit notes
    if (socketData.role === Role.VIEWER) {
      throw new WsException('Forbidden: Viewers cannot edit notes');
    }

    const content = payload.content ?? payload.noteContent;

    if (content === undefined || content === null) {
      throw new WsException('content is required');
    }

    const clientVersion = payload.clientVersion ?? 0;
    const result = await this.noteRepository.updateNote(
      room.data.id,
      content,
      clientVersion,
    );

    if (!result.versionMatched) {
      this.server.to(room.data.id).emit('note_conflict', {
        roomId: room.data.id,
        latestVersion: result.note.version,
        latestContent: result.note.content,
        message: 'Version mismatch - your edit was rejected',
      });

      return {
        status: 'conflict',
        message: 'Version mismatch',
        data: result.note,
      };
    }

    // Sync content to memory Y.Doc as well
    const ydoc = await this.getOrCreateDoc(room.data.id);
    const ytext = ydoc.getText('content');
    if (ytext.toString() !== content) {
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      });
    }

    this.server.to(room.data.id).emit('note_updated', {
      roomId: room.data.id,
      content: result.note.content,
      version: result.note.version,
    });

    return {
      status: 'success',
      message: `Note updated in room ${room.data.id}`,
      data: result.note,
    };
  }

  // --- YJS CRDT REALTIME PIPELINE ---

  @SubscribeMessage('yjs_sync_step_1')
  async handleYjsSyncStep1(client: Socket, payload: YjsSyncStep1Payload) {
    const room = await this.resolveRoom(payload);
    const ydoc = await this.getOrCreateDoc(room.data.id);

    // Client sent stateVector base64
    const clientStateVector = Buffer.from(payload.stateVector, 'base64');
    // Calculate missing updates from server to client
    const diffUpdate = Y.encodeStateAsUpdate(ydoc, new Uint8Array(clientStateVector));
    // Calculate server's state vector
    const serverStateVector = Y.encodeStateVector(ydoc);

    return {
      status: 'success',
      data: {
        update: Buffer.from(diffUpdate).toString('base64'),
        serverStateVector: Buffer.from(serverStateVector).toString('base64'),
      },
    };
  }

  @SubscribeMessage('yjs_update')
  async handleYjsUpdate(client: Socket, payload: YjsUpdatePayload) {
    const room = await this.resolveRoom(payload);
    const socketData = client.data as SocketData;

    // RBAC: Check write permission
    if (socketData.role === Role.VIEWER) {
      throw new WsException('Forbidden: Viewers cannot edit notes');
    }

    const ydoc = await this.getOrCreateDoc(room.data.id);
    const updateBytes = Buffer.from(payload.update, 'base64');

    // Apply update to server Y.Doc
    Y.applyUpdate(ydoc, new Uint8Array(updateBytes));

    // Broadcast binary update to all other connected peers in the room
    client.to(room.data.id).emit('yjs_update', {
      roomId: room.data.id,
      update: payload.update,
    });

    // Schedule debounced database persistence
    this.scheduleDebouncedSave(room.data.id, socketData.userId);

    return { status: 'success' };
  }

  @SubscribeMessage('yjs_awareness')
  async handleYjsAwareness(client: Socket, payload: YjsAwarenessPayload) {
    const room = await this.resolveRoom(payload);
    const socketData = client.data as SocketData;

    // Broadcast cursor and selection awareness to peers
    client.to(room.data.id).emit('yjs_awareness', {
      roomId: room.data.id,
      userId: socketData.userId,
      socketId: client.id,
      awareness: payload.awareness,
    });

    return { status: 'success' };
  }

  private async getOrCreateDoc(roomId: string): Promise<Y.Doc> {
    let ydoc = this.roomDocs.get(roomId);
    if (!ydoc) {
      ydoc = new Y.Doc();
      const note = await this.noteRepository.createOrGetNote(roomId);

      if (note.crdtState && note.crdtState.length > 0) {
        Y.applyUpdate(ydoc, new Uint8Array(note.crdtState));
      } else if (note.content) {
        ydoc.getText('content').insert(0, note.content);
      }

      this.roomDocs.set(roomId, ydoc);
    }
    return ydoc;
  }

  private scheduleDebouncedSave(roomId: string, authorId?: string) {
    const existing = this.saveTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      await this.flushRoomDoc(roomId, authorId);
    }, 1000);
    timer.unref();

    this.saveTimers.set(roomId, timer);
  }

  private async flushRoomDoc(roomId: string, authorId?: string) {
    const ydoc = this.roomDocs.get(roomId);
    if (!ydoc) return;

    try {
      const crdtState = Y.encodeStateAsUpdate(ydoc);
      const textContent = ydoc.getText('content').toString();
      await this.noteRepository.saveCrdtState(
        roomId,
        Buffer.from(crdtState),
        textContent,
        authorId,
      );
    } catch {
      // Log persistence error
    }
  }

  private async resolveRoom(payload: RoomLookupPayload) {
    if (payload.roomName) {
      try {
        return (await this.roomService.get_room_by_name(
          payload.roomName,
        )) as RoomResponse;
      } catch (error) {
        throw new WsException(
          error instanceof Error ? error.message : 'Unable to resolve room',
        );
      }
    }

    if (payload.roomId) {
      try {
        return (await this.roomService.get_room_by_id(
          payload.roomId,
        )) as RoomResponse;
      } catch (error) {
        throw new WsException(
          error instanceof Error ? error.message : 'Unable to resolve room',
        );
      }
    }

    throw new WsException('roomName or roomId is required');
  }
}
