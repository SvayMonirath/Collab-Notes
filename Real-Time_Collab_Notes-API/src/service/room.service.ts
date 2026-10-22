import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, Room, RoomMember } from 'generated/prisma/client';
import { CreateRoomRequest } from 'src/dto/request/room.request';
import { RoomRepository } from 'src/repository/room.repository';

@Injectable()
export class RoomService {
  constructor(private readonly roomRepository: RoomRepository) {}

  async create_room(
    dto: CreateRoomRequest,
    ownerUserId?: string,
  ): Promise<{ data: Room }> {
    if (await this.roomRepository.get_room_by_name(dto.name)) {
      throw new BadRequestException('Room name already exists');
    }

    const room: Room = await this.roomRepository.create_room(dto, ownerUserId);
    return { data: room };
  }

  async get_room_by_name(name: string): Promise<{ data: Room }> {
    const room: Room | null = await this.roomRepository.get_room_by_name(name);

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return { data: room };
  }

  async get_room_by_id(id: string): Promise<{ data: Room }> {
    const room = await this.roomRepository.get_room_by_id(id);
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return { data: room };
  }

  async get_member(roomId: string, userId: string): Promise<RoomMember | null> {
    return await this.roomRepository.get_member(roomId, userId);
  }

  async ensure_member(
    roomId: string,
    userId: string,
    defaultRole: Role = Role.EDITOR,
  ): Promise<RoomMember> {
    const existing = await this.roomRepository.get_member(roomId, userId);
    if (existing) {
      return existing;
    }
    return await this.roomRepository.add_member(roomId, userId, defaultRole);
  }

  async add_member(
    roomId: string,
    userId: string,
    role: Role,
  ): Promise<{ data: RoomMember }> {
    await this.get_room_by_id(roomId);
    const member = await this.roomRepository.add_member(roomId, userId, role);
    return { data: member };
  }

  async list_user_rooms(userId: string): Promise<{ data: Room[] }> {
    const rooms = await this.roomRepository.get_user_rooms(userId);
    return { data: rooms };
  }

  async list_all_rooms(): Promise<{ data: Room[] }> {
    const rooms = await this.roomRepository.list_all_rooms();
    return { data: rooms };
  }
}
