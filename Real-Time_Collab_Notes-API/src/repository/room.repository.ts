import { Injectable } from '@nestjs/common';
import { Role, Room, RoomMember } from 'generated/prisma/client';
import { CreateRoomRequest } from 'src/dto/request/room.request';
import { PrismaService } from 'prisma/prisma/prisma.service';

@Injectable()
export class RoomRepository {
  constructor(private readonly db: PrismaService) {}

  async create_room(dto: CreateRoomRequest, ownerUserId?: string): Promise<Room> {
    const room = await this.db.room.create({
      data: {
        name: dto.name,
      },
    });

    if (ownerUserId) {
      await this.db.roomMember.create({
        data: {
          roomId: room.id,
          userId: ownerUserId,
          role: Role.OWNER,
        },
      });
    }

    return room;
  }

  async get_room_by_name(name: string): Promise<Room | null> {
    return await this.db.room.findFirst({
      where: {
        name: name,
      },
    });
  }

  async get_room_by_id(id: string): Promise<Room | null> {
    return await this.db.room.findUnique({
      where: { id },
    });
  }

  async get_member(roomId: string, userId: string): Promise<RoomMember | null> {
    return await this.db.roomMember.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
    });
  }

  async add_member(
    roomId: string,
    userId: string,
    role: Role = Role.EDITOR,
  ): Promise<RoomMember> {
    return await this.db.roomMember.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId,
        },
      },
      update: {
        role,
      },
      create: {
        roomId,
        userId,
        role,
      },
    });
  }

  async get_room_members(roomId: string): Promise<RoomMember[]> {
    return await this.db.roomMember.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get_user_rooms(userId: string): Promise<Room[]> {
    const memberships = await this.db.roomMember.findMany({
      where: { userId },
      include: { room: true },
    });
    return memberships.map((m) => m.room);
  }

  async list_all_rooms(): Promise<Room[]> {
    return await this.db.room.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }
}
