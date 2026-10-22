import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma/prisma.service';
import { Note } from 'generated/prisma/client';

@Injectable()
export class NoteRepository {
  constructor(private readonly db: PrismaService) {}

  async getNoteByRoomId(roomId: string): Promise<Note | null> {
    return await this.db.note.findFirst({
      where: {
        roomId,
      },
    });
  }

  async createOrGetNote(roomId: string): Promise<Note> {
    let note = await this.getNoteByRoomId(roomId);

    if (!note) {
      note = await this.db.note.create({
        data: {
          roomId,
          content: '',
          version: 0,
        },
      });
    }

    return note;
  }

  async updateNote(
    roomId: string,
    content: string,
    expectedVersion: number,
  ): Promise<{ note: Note; versionMatched: boolean }> {
    const note = await this.getNoteByRoomId(roomId);

    if (!note) {
      const newNote = await this.createOrGetNote(roomId);
      return {
        note: await this.db.note.update({
          where: { id: newNote.id },
          data: { content, version: 1 },
        }),
        versionMatched: true,
      };
    }

    const versionMatched = note.version === expectedVersion;

    if (!versionMatched) {
      return { note, versionMatched: false };
    }

    const updated = await this.db.note.update({
      where: { id: note.id },
      data: {
        content,
        version: note.version + 1,
      },
    });

    return { note: updated, versionMatched: true };
  }

  async saveCrdtState(
    roomId: string,
    crdtState: Uint8Array | Buffer,
    textContent?: string,
    authorId?: string,
  ): Promise<Note> {
    const note = await this.createOrGetNote(roomId);
    const buffer = Buffer.from(crdtState);

    const updated = await this.db.note.update({
      where: { id: note.id },
      data: {
        crdtState: buffer,
        content: textContent !== undefined ? textContent : note.content,
        version: note.version + 1,
      },
    });

    // Save snapshot in history
    await this.db.noteHistory.create({
      data: {
        noteId: note.id,
        authorId: authorId ?? null,
        content: updated.content,
        crdtState: buffer,
        version: updated.version,
      },
    });

    return updated;
  }

  async getNoteVersion(roomId: string): Promise<number> {
    const note = await this.getNoteByRoomId(roomId);
    return note?.version ?? 0;
  }
}
