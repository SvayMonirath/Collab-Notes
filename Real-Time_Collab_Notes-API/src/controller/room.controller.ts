import {
  Controller,
  Body,
  Get,
  Post,
  Param,
  Headers,
} from '@nestjs/common';
import { Role } from 'generated/prisma/client';
import { CreateRoomRequest } from 'src/dto/request/room.request';
import { RoomService } from 'src/service/room.service';

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get()
  async listRooms() {
    const result = await this.roomService.list_all_rooms();
    return {
      status: 'success',
      data: result.data,
    };
  }

  @Post()
  async createRoom(
    @Body() createRoomDto: CreateRoomRequest,
    @Headers('x-user-id') userId?: string,
  ) {
    const result = await this.roomService.create_room(createRoomDto, userId);

    return {
      status: 'success',
      message: `Room ${result.data.id} created successfully`,
      data: result.data,
    };
  }

  @Get(':name')
  async getRoomByName(@Param('name') name: string) {
    const room = await this.roomService.get_room_by_name(name);
    return {
      status: 'success',
      message: `Room ${room.data.id} retrieved successfully`,
      data: room,
    };
  }

  @Post(':id/members')
  async addMember(
    @Param('id') roomId: string,
    @Body() body: { userId: string; role?: Role },
  ) {
    const result = await this.roomService.add_member(
      roomId,
      body.userId,
      body.role ?? Role.EDITOR,
    );
    return {
      status: 'success',
      data: result.data,
    };
  }
}
