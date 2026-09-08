import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMembership } from './entities/chat-membership.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { Team } from '../teams/entities/team.entity';
import { Technician } from '../technicians/entities/technician.entity';
import { User } from '../auth/entities/user.entity';
import { Mission } from '../missions/entities/mission.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MatrixClient } from './matrix.client';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom) private readonly rooms: Repository<ChatRoom>,
    @InjectRepository(ChatMembership) private readonly memberships: Repository<ChatMembership>,
    @InjectRepository(ChatMessage) private readonly messages: Repository<ChatMessage>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Technician) private readonly technicians: Repository<Technician>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    private readonly notifications: NotificationsService,
    private readonly matrix: MatrixClient,
  ) {}

  status() {
    return {
      transport: 'nest-postgres',
      matrix: this.matrix.isEnabled() ? 'configured' : 'off',
    };
  }

  async matrixPing() {
    return this.matrix.ping();
  }

  /** Assure Remontée + salons équipes, rattache l'utilisateur. */
  async ensureMyRooms(companyId: string, userId: string) {
    const remontee = await this.ensureRemontee(companyId);
    await this.ensureMembership(companyId, remontee.id, userId);

    const user = await this.users.findOne({ where: { id: userId, companyId } });
    const tech = await this.technicians.findOne({ where: { companyId, userId, active: true } });
    const isBroad =
      user?.role === 'admin' || user?.role === 'direction' || user?.role === 'magasinier';

    const teams = await this.teams.find({ where: { companyId }, order: { name: 'ASC' } });
    for (const team of teams) {
      const room = await this.ensureTeamRoom(companyId, team);
      if (isBroad || tech?.teamId === team.id) {
        await this.ensureMembership(companyId, room.id, userId);
      }
    }

    return this.listMyRooms(companyId, userId);
  }

  async listRooms(companyId: string, userId: string) {
    const mine = await this.memberships.find({ where: { companyId, userId } });
    if (mine.length === 0) return this.ensureMyRooms(companyId, userId);
    return this.listMyRooms(companyId, userId);
  }

  private async listMyRooms(companyId: string, userId: string) {
    const mine = await this.memberships.find({ where: { companyId, userId } });
    const roomIds = mine.map((m) => m.roomId);
    if (roomIds.length === 0) return [];
    const rooms = await this.rooms.find({
      where: { companyId, id: In(roomIds) },
      order: { lastMessageAt: 'DESC', title: 'ASC' },
    });
    return rooms.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      alias: r.alias,
      teamId: r.teamId,
      missionId: r.missionId,
      lastMessageAt: r.lastMessageAt,
      lastMessagePreview: r.lastMessagePreview,
      matrixRoomId: r.matrixRoomId,
    }));
  }

  async roomForMission(
    companyId: string,
    userId: string,
    missionId: string,
    opts?: { missionRoom?: boolean },
  ) {
    const mission = await this.missions.findOne({ where: { companyId, id: missionId } });
    if (!mission) throw new NotFoundException('Mission introuvable');
    await this.ensureMyRooms(companyId, userId);

    if (opts?.missionRoom) {
      const room = await this.ensureMissionRoom(companyId, mission);
      await this.ensureMembership(companyId, room.id, userId);
      return { roomId: room.id, title: room.title, kind: room.kind };
    }

    if (mission.teamId) {
      const team = await this.teams.findOne({ where: { companyId, id: mission.teamId } });
      if (team) {
        const room = await this.ensureTeamRoom(companyId, team);
        await this.ensureMembership(companyId, room.id, userId);
        return { roomId: room.id, title: room.title, kind: room.kind };
      }
    }
    const remontee = await this.ensureRemontee(companyId);
    await this.ensureMembership(companyId, remontee.id, userId);
    return { roomId: remontee.id, title: remontee.title, kind: remontee.kind };
  }

  /** Salon mission opt-in (pas créé automatiquement). */
  async ensureMissionRoom(companyId: string, mission: Mission) {
    const alias = `mission-${mission.id.slice(0, 8)}`;
    let room = await this.rooms.findOne({ where: { companyId, alias } });
    if (!room) {
      const short =
        mission.sonatelDossierNumber ||
        mission.clientSite?.slice(0, 28) ||
        mission.id.slice(0, 8);
      room = await this.rooms.save(
        this.rooms.create({
          companyId,
          kind: 'mission',
          title: `Mission ${short}`,
          alias,
          teamId: mission.teamId,
          missionId: mission.id,
          matrixRoomId: null,
        }),
      );
    }
    return room;
  }

  async listMessages(companyId: string, userId: string, roomId: string, limit = 50) {
    await this.assertMember(companyId, userId, roomId);
    const rows = await this.messages.find({
      where: { companyId, roomId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
    });
    const senderIds = [...new Set(rows.map((m) => m.senderId).filter(Boolean))] as string[];
    const senders = senderIds.length
      ? await this.users.find({ where: { id: In(senderIds) } })
      : [];
    const byId = new Map(senders.map((u) => [u.id, u]));
    return rows.reverse().map((m) => ({
      id: m.id,
      roomId: m.roomId,
      body: m.body,
      photoUrl: m.photoUrl,
      createdAt: m.createdAt,
      senderId: m.senderId,
      source: m.source || 'app',
      senderName:
        m.senderDisplayName ||
        (m.senderId ? byId.get(m.senderId)?.fullName || byId.get(m.senderId)?.email : null) ||
        (m.source === 'whatsapp' ? 'WhatsApp' : '—'),
      mine: !!m.senderId && m.senderId === userId,
    }));
  }

  async postMessage(
    companyId: string,
    userId: string,
    roomId: string,
    dto: { body: string; photoUrl?: string },
  ) {
    await this.assertMember(companyId, userId, roomId);
    const body = (dto.body || '').trim();
    if (!body && !dto.photoUrl) throw new BadRequestException('Message vide');

    const msg = await this.messages.save(
      this.messages.create({
        companyId,
        roomId,
        senderId: userId,
        senderDisplayName: null,
        source: 'app',
        body: body || '(photo)',
        photoUrl: dto.photoUrl ?? null,
      }),
    );

    const room = await this.rooms.findOne({ where: { companyId, id: roomId } });
    await this.touchRoom(room, msg);
    await this.notifyMembers(companyId, roomId, userId, room?.title || 'Nouveau message', msg.body);

    const sender = await this.users.findOne({ where: { id: userId } });
    return {
      id: msg.id,
      roomId: msg.roomId,
      body: msg.body,
      photoUrl: msg.photoUrl,
      createdAt: msg.createdAt,
      senderId: msg.senderId,
      source: 'app',
      senderName: sender?.fullName || sender?.email || '—',
      mine: true,
    };
  }

  /**
   * Ingress Remontée (WhatsApp / bridge) : poste dans le salon Remontée du tenant.
   * Pas de membership check — réservé au bridge authentifié par secret.
   */
  async ingestToRemontee(
    companyId: string,
    dto: { body: string; photoUrl?: string; senderName?: string; source?: string },
  ) {
    const room = await this.ensureRemontee(companyId);
    const body = (dto.body || '').trim() || (dto.photoUrl ? '(photo Remontée)' : '');
    if (!body && !dto.photoUrl) throw new BadRequestException('Message vide');

    const msg = await this.messages.save(
      this.messages.create({
        companyId,
        roomId: room.id,
        senderId: null,
        senderDisplayName: dto.senderName?.trim() || 'WhatsApp Remontée',
        source: dto.source || 'whatsapp',
        body,
        photoUrl: dto.photoUrl ?? null,
      }),
    );
    await this.touchRoom(room, msg);
    await this.notifyMembers(
      companyId,
      room.id,
      null,
      'Remontée WhatsApp',
      `${msg.senderDisplayName}: ${msg.body.slice(0, 80)}`,
    );
    return {
      roomId: room.id,
      messageId: msg.id,
      title: room.title,
    };
  }

  private async touchRoom(room: ChatRoom | null, msg: ChatMessage) {
    if (!room) return;
    room.lastMessageAt = msg.createdAt;
    room.lastMessagePreview = msg.body.slice(0, 120);
    await this.rooms.save(room);
  }

  private async notifyMembers(
    companyId: string,
    roomId: string,
    excludeUserId: string | null,
    title: string,
    preview: string,
  ) {
    const members = await this.memberships.find({ where: { companyId, roomId } });
    for (const m of members) {
      if (excludeUserId && m.userId === excludeUserId) continue;
      for (const channel of ['in_app', 'push'] as const) {
        try {
          await this.notifications.send({
            companyId,
            type: 'chat' as never,
            channel,
            userId: m.userId,
            title,
            body: preview,
            data: { roomId },
          });
        } catch {
          /* optional */
        }
      }
    }
  }

  async ensureRemontee(companyId: string) {
    const alias = `remontee-${companyId.slice(0, 8)}`;
    let room = await this.rooms.findOne({ where: { companyId, alias } });
    if (!room) {
      room = await this.rooms.save(
        this.rooms.create({
          companyId,
          kind: 'remontee',
          title: 'Remontée',
          alias,
          teamId: null,
          missionId: null,
          matrixRoomId: null,
        }),
      );
    }
    const users = await this.users.find({ where: { companyId, active: true } });
    for (const u of users) {
      await this.ensureMembership(companyId, room.id, u.id);
    }
    return room;
  }

  private async ensureTeamRoom(companyId: string, team: Team) {
    const alias = `team-${team.id.slice(0, 8)}`;
    let room = await this.rooms.findOne({ where: { companyId, alias } });
    if (!room) {
      room = await this.rooms.save(
        this.rooms.create({
          companyId,
          kind: 'team',
          title: `Équipe ${team.name}`,
          alias,
          teamId: team.id,
          missionId: null,
          matrixRoomId: null,
        }),
      );
    }
    return room;
  }

  private async ensureMembership(companyId: string, roomId: string, userId: string) {
    const existing = await this.memberships.findOne({ where: { companyId, roomId, userId } });
    if (existing) return existing;
    return this.memberships.save(this.memberships.create({ companyId, roomId, userId }));
  }

  private async assertMember(companyId: string, userId: string, roomId: string) {
    const m = await this.memberships.findOne({ where: { companyId, roomId, userId } });
    if (!m) throw new ForbiddenException('Salon non autorisé');
  }
}
