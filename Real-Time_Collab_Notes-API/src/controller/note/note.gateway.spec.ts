import { Test, TestingModule } from '@nestjs/testing';
import { NoteGateway } from './note.gateway';
import { RoomService } from 'src/service/room.service';
import { NoteRepository } from 'src/repository/note.repository';
import { SocketAuthMiddleware } from 'src/middleware/socket-auth.middleware';
import { WsException } from '@nestjs/websockets';
import { Role } from 'generated/prisma/client';
import * as Y from 'yjs';

describe('NoteGateway', () => {
  let gateway: NoteGateway;

  const mockRoom = {
    data: {
      id: 'room-uuid-123',
      name: 'design-sync',
    },
  };

  const mockNote = {
    id: 'note-uuid-123',
    roomId: 'room-uuid-123',
    content: 'Initial hello',
    version: 1,
    crdtState: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRoomService = {
    get_room_by_name: jest.fn().mockResolvedValue(mockRoom),
    get_room_by_id: jest.fn().mockResolvedValue(mockRoom),
    ensure_member: jest.fn().mockResolvedValue({
      id: 'mem-1',
      roomId: 'room-uuid-123',
      userId: 'user-456',
      role: Role.EDITOR,
    }),
  };

  const mockNoteRepository = {
    createOrGetNote: jest.fn().mockResolvedValue(mockNote),
    updateNote: jest.fn().mockResolvedValue({
      note: { ...mockNote, content: 'Updated content', version: 2 },
      versionMatched: true,
    }),
    saveCrdtState: jest.fn().mockResolvedValue({ ...mockNote, version: 2 }),
    getNoteVersion: jest.fn().mockResolvedValue(1),
  };

  const mockSocketAuthMiddleware = {
    validateToken: jest.fn().mockReturnValue({ userId: 'user-456' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoteGateway,
        {
          provide: RoomService,
          useValue: mockRoomService,
        },
        {
          provide: NoteRepository,
          useValue: mockNoteRepository,
        },
        {
          provide: SocketAuthMiddleware,
          useValue: mockSocketAuthMiddleware,
        },
      ],
    }).compile();

    gateway = module.get<NoteGateway>(NoteGateway);
    gateway.server = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
      emit: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('RBAC & Room Membership', () => {
    it('should assign role on join_room and broadcast presence', async () => {
      const mockSocket: any = {
        id: 'sock-1',
        data: { userId: 'user-456' },
        join: jest.fn(),
        emit: jest.fn(),
      };

      const result = await gateway.handleJoinRoom(mockSocket, {
        roomName: 'design-sync',
      });

      expect(result.status).toBe('success');
      expect(result.data.userRole).toBe(Role.EDITOR);
      expect(mockSocket.data.role).toBe(Role.EDITOR);
      expect(gateway.server.to).toHaveBeenCalledWith('room-uuid-123');
    });

    it('should reject update_note when user has VIEWER role', async () => {
      const mockSocket: any = {
        id: 'sock-viewer',
        data: { userId: 'viewer-user', role: Role.VIEWER },
      };

      await expect(
        gateway.handleUpdateNote(mockSocket, {
          roomName: 'design-sync',
          content: 'Hacked content',
          clientVersion: 1,
        }),
      ).rejects.toThrow(WsException);
    });

    it('should reject yjs_update when user has VIEWER role', async () => {
      const mockSocket: any = {
        id: 'sock-viewer',
        data: { userId: 'viewer-user', role: Role.VIEWER },
      };

      await expect(
        gateway.handleYjsUpdate(mockSocket, {
          roomName: 'design-sync',
          update: 'AQIDBA==',
        }),
      ).rejects.toThrow(WsException);
    });
  });

  describe('Yjs CRDT Realtime Pipeline', () => {
    it('should respond to yjs_sync_step_1 with binary state diff and server vector', async () => {
      const mockSocket: any = {
        id: 'sock-1',
        data: { userId: 'user-456', role: Role.EDITOR },
      };

      const clientDoc = new Y.Doc();
      const clientVector = Y.encodeStateVector(clientDoc);
      const clientVectorB64 = Buffer.from(clientVector).toString('base64');

      const response = await gateway.handleYjsSyncStep1(mockSocket, {
        roomName: 'design-sync',
        stateVector: clientVectorB64,
      });

      expect(response.status).toBe('success');
      expect(response.data.update).toBeDefined();
      expect(response.data.serverStateVector).toBeDefined();
    });

    it('should apply valid yjs_update and broadcast to peers in room', async () => {
      const mockSocket: any = {
        id: 'sock-editor',
        data: { userId: 'user-456', role: Role.EDITOR },
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      };

      const clientDoc = new Y.Doc();
      clientDoc.getText('content').insert(0, 'Hello CRDT!');
      const updateBytes = Y.encodeStateAsUpdate(clientDoc);
      const updateB64 = Buffer.from(updateBytes).toString('base64');

      const response = await gateway.handleYjsUpdate(mockSocket, {
        roomName: 'design-sync',
        update: updateB64,
      });

      expect(response.status).toBe('success');
      expect(mockSocket.to).toHaveBeenCalledWith('room-uuid-123');
    });
  });
});
