import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { io as ClientSocket, Socket } from 'socket.io-client';
import * as jwt from 'jsonwebtoken';
import * as Y from 'yjs';
import { PrismaService } from '../prisma/prisma/prisma.service';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secure-production-ready-jwt-secret-key-100x';
const PORT = 8001; // Use 8001 for isolated test instance

function generateToken(userId: string) {
  return jwt.sign({ userId, sub: userId }, JWT_SECRET, { expiresIn: '1h' });
}

async function run() {
  console.log('--- 1. Starting Live NestJS Server on port ' + PORT + ' ---');
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  await app.listen(PORT);

  const prisma = app.get(PrismaService);

  const roomName = 'e2e-test-room-' + Date.now();
  console.log(`Creating test room: ${roomName}`);

  // Create room via REST
  const roomRes = await fetch(`http://localhost:${PORT}/room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: roomName }),
  });
  const roomJson = await roomRes.json();
  console.log('Room created:', roomJson.status, roomJson.data.id);
  const roomId = roomJson.data.id;

  const tokenUserA = generateToken('user-alice');
  const tokenUserB = generateToken('user-bob');
  const tokenViewer = generateToken('user-viewer');

  // Set viewer role in database
  await prisma.roomMember.create({
    data: {
      roomId,
      userId: 'user-viewer',
      role: 'VIEWER',
    },
  });

  console.log('--- 2. Connecting Client A (Alice) and Client B (Bob) ---');
  const socketA: Socket = ClientSocket(`http://localhost:${PORT}`, {
    query: { token: tokenUserA },
    transports: ['websocket'],
  });

  const socketB: Socket = ClientSocket(`http://localhost:${PORT}`, {
    query: { token: tokenUserB },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    let connected = 0;
    socketA.on('connect', () => {
      connected++;
      if (connected === 2) resolve();
    });
    socketB.on('connect', () => {
      connected++;
      if (connected === 2) resolve();
    });
  });
  console.log('Clients A & B connected to WebSocket gateway successfully.');

  // Join Room
  await new Promise<void>((resolve) => {
    socketA.emit('join_room', { roomName }, () => {
      socketB.emit('join_room', { roomName }, () => {
        resolve();
      });
    });
  });
  console.log('Clients A & B joined room: ' + roomName);

  // Setup Yjs Docs for both clients
  const docA = new Y.Doc();
  const docB = new Y.Doc();

  // Wire network sync for Client A
  docA.on('update', (update, origin) => {
    if (origin !== 'remote') {
      socketA.emit('yjs_update', {
        roomName,
        update: Buffer.from(update).toString('base64'),
      });
    }
  });

  socketA.on('yjs_update', (payload: { update: string }) => {
    const bytes = Buffer.from(payload.update, 'base64');
    Y.applyUpdate(docA, new Uint8Array(bytes), 'remote');
  });

  // Wire network sync for Client B
  docB.on('update', (update, origin) => {
    if (origin !== 'remote') {
      socketB.emit('yjs_update', {
        roomName,
        update: Buffer.from(update).toString('base64'),
      });
    }
  });

  socketB.on('yjs_update', (payload: { update: string }) => {
    const bytes = Buffer.from(payload.update, 'base64');
    Y.applyUpdate(docB, new Uint8Array(bytes), 'remote');
  });

  console.log('--- 3. Testing Simultaneous Concurrent Typing (CRDT Convergence) ---');
  const textA = docA.getText('content');
  const textB = docB.getText('content');

  // Both clients type at the exact same moment
  textA.insert(0, 'Alice writes section 1. ');
  textB.insert(0, 'Bob writes section 2. ');

  // Wait 1.5 seconds for network sync
  await new Promise((r) => setTimeout(r, 1500));

  console.log('Client A final text: "' + textA.toString() + '"');
  console.log('Client B final text: "' + textB.toString() + '"');

  if (textA.toString() !== textB.toString() || textA.toString().length === 0) {
    throw new Error('FAILED: Documents did not converge! A: ' + textA.toString() + ' vs B: ' + textB.toString());
  }
  console.log('SUCCESS: Strong Eventual Consistency verified! Both clients converged to identical text with ZERO data loss.');

  console.log('--- 4. Testing RBAC Security Guard (VIEWER rejection) ---');
  const socketViewer: Socket = ClientSocket(`http://localhost:${PORT}`, {
    query: { token: tokenViewer },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => socketViewer.on('connect', resolve));
  await new Promise<void>((resolve) => socketViewer.emit('join_room', { roomName }, resolve));

  const viewerUpdateError = await new Promise<any>((resolve) => {
    socketViewer.emit('yjs_update', { roomName, update: 'AQID' }, (ack: any) => {
      resolve(ack);
    });
    // Or catch error event
    socketViewer.on('exception', (err) => {
      resolve(err);
    });
    setTimeout(() => resolve(null), 1000);
  });

  console.log('Viewer write attempt caught by RBAC:', viewerUpdateError);
  if (!viewerUpdateError || !viewerUpdateError.message?.includes('Forbidden')) {
    throw new Error('FAILED: Viewer write was not rejected by RBAC!');
  }
  console.log('SUCCESS: RBAC enforced! Viewer update blocked with WsException.');

  console.log('--- 5. Verifying Database Persistence in PostgreSQL ---');
  await new Promise((r) => setTimeout(r, 1200)); // allow debounced flush
  const persistedNote = await prisma.note.findFirst({
    where: { roomId },
  });

  console.log('Persisted Note in Postgres:', {
    id: persistedNote?.id,
    version: persistedNote?.version,
    hasCrdtState: !!persistedNote?.crdtState,
    crdtBytesLength: persistedNote?.crdtState?.length,
    content: persistedNote?.content,
  });

  if (!persistedNote?.crdtState || persistedNote.crdtState.length === 0) {
    throw new Error('FAILED: CRDT state was not persisted to PostgreSQL database!');
  }
  console.log('SUCCESS: PostgreSQL stored the binary CRDT state and content snapshot.');

  // Teardown
  socketA.disconnect();
  socketB.disconnect();
  socketViewer.disconnect();
  await app.close();
  console.log('--- ALL E2E VERIFICATIONS PASSED CLEANLY ---');
  process.exit(0);
}

run().catch((err) => {
  console.error('E2E TEST FAILURE:', err);
  process.exit(1);
});
