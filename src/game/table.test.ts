import { describe, it, expect } from 'vitest';
import {
  addPlayerPatch,
  assertCanDeleteRoom,
  joinPatch,
  leavePatch,
  movePatch,
  removePlayerPatch,
  renamePlayerPatch,
  renameRoomPatch,
} from './table.js';
import {
  applyPatch,
  bidPatch,
  closeRoundPatch,
  startGamePatch,
} from './engine.js';
import { selectRoomView } from './view.js';
import { biddingOrder } from './rounds.js';
import { DEFAULT_RULES } from './scoring.js';
import { GAME_PHASE, ROOM_MODE, ROOM_STATUS } from './constants.js';
import type { Player, Room, Uid } from '../types.js';

const ADMIN: Uid = 'admin-uid';

/** Стол в режиме «один ведёт стол»: админ не игрок, игроки добавлены руками. */
function adminRoom(names: string[] = []): Room {
  return {
    id: 'r1',
    name: 'Стол',
    mode: ROOM_MODE.SINGLE,
    hostId: ADMIN,
    status: ROOM_STATUS.WAITING,
    players: names.map((name, i) => ({
      uid: `p${i + 1}`,
      name,
      photoURL: null,
      isGuest: true,
      isLocal: true,
    })),
    rules: DEFAULT_RULES,
    game: null,
    history: [],
  };
}

const player = (uid: Uid, name: string): Player => ({
  uid,
  name,
  photoURL: null,
  isGuest: false,
});

describe('админ добавляет игроков', () => {
  it('первый добавленный получает место 1', () => {
    const room = applyPatch(adminRoom(), addPlayerPatch(adminRoom(), ADMIN, 'Аня'));
    expect(room.players).toEqual([
      { uid: 'p1', name: 'Аня', photoURL: null, isGuest: true, isLocal: true },
    ]);
  });

  it('имена обрезаются по краям и не могут быть пустыми', () => {
    const room = applyPatch(adminRoom(), addPlayerPatch(adminRoom(), ADMIN, '  Боря  '));
    expect(room.players[0].name).toBe('Боря');
    expect(() => addPlayerPatch(adminRoom(), ADMIN, '   ')).toThrow(/не может быть пустым/);
  });

  it('одинаковые имена не пускает — иначе в расписке не разобраться', () => {
    const room = adminRoom(['Аня']);
    expect(() => addPlayerPatch(room, ADMIN, 'аня')).toThrow(/уже есть Аня/);
  });

  it('больше шести игроков за стол не сажает', () => {
    const room = adminRoom(['1', '2', '3', '4', '5', '6']);
    expect(() => addPlayerPatch(room, ADMIN, '7')).toThrow(/максимум 6/);
  });

  it('места переиспользуются после удаления', () => {
    let room = adminRoom(['Аня', 'Боря']);
    room = applyPatch(room, removePlayerPatch(room, ADMIN, 'p1'));
    room = applyPatch(room, addPlayerPatch(room, ADMIN, 'Вера'));
    expect(room.players.map((p) => [p.uid, p.name])).toEqual([
      ['p2', 'Боря'],
      ['p1', 'Вера'],
    ]);
  });

  it('состав меняет только админ', () => {
    const room = adminRoom(['Аня']);
    expect(() => addPlayerPatch(room, 'someone', 'Боря')).toThrow(/только админ/);
    expect(() => renamePlayerPatch(room, 'someone', 'p1', 'Х')).toThrow(/только админ/);
    expect(() => removePlayerPatch(room, 'someone', 'p1')).toThrow(/только админ/);
  });
});

describe('админ правит состав', () => {
  it('переименование меняет только имя, место остаётся', () => {
    const room = adminRoom(['Аня', 'Боря']);
    const next = applyPatch(room, renamePlayerPatch(room, ADMIN, 'p1', 'Анна')!);
    expect(next.players.map((p) => [p.uid, p.name])).toEqual([
      ['p1', 'Анна'],
      ['p2', 'Боря'],
    ]);
  });

  it('переименование в то же имя ничего не пишет', () => {
    const room = adminRoom(['Аня']);
    expect(renamePlayerPatch(room, ADMIN, 'p1', 'Аня')).toBe(null);
  });

  it('переименовать в имя другого игрока нельзя', () => {
    const room = adminRoom(['Аня', 'Боря']);
    expect(() => renamePlayerPatch(room, ADMIN, 'p2', 'Аня')).toThrow(/уже есть Аня/);
  });

  it('порядок хода переставляется', () => {
    const room = adminRoom(['Аня', 'Боря', 'Вера', 'Гоша']);
    const next = applyPatch(room, movePatch(room, 'p3', -1)!);
    expect(next.players.map((p) => p.name)).toEqual(['Аня', 'Вера', 'Боря', 'Гоша']);
  });

  it('во время игры состав и порядок трогать нельзя', () => {
    const room = { ...adminRoom(['Аня', 'Боря']), status: ROOM_STATUS.PLAYING };
    expect(() => addPlayerPatch(room, ADMIN, 'Вера')).toThrow(/Игра идёт/);
    expect(() => removePlayerPatch(room, ADMIN, 'p1')).toThrow(/Игра идёт/);
    expect(() => movePatch(room, 'p1', 1)).toThrow(/Игра идёт/);
  });

  it('переименовать можно и посреди игры', () => {
    const room = { ...adminRoom(['Аня', 'Боря']), status: ROOM_STATUS.PLAYING };
    expect(renamePlayerPatch(room, ADMIN, 'p1', 'Анна')).not.toBe(null);
  });

  it('нет такого игрока — понятная ошибка', () => {
    const room = adminRoom(['Аня']);
    expect(() => renamePlayerPatch(room, ADMIN, 'p9', 'Х')).toThrow(/Такого игрока/);
    expect(() => removePlayerPatch(room, ADMIN, 'p9')).toThrow(/Такого игрока/);
  });
});

describe('режимы не смешиваются', () => {
  it('в режиме админа игрок не может сесть сам', () => {
    expect(() => joinPatch(adminRoom(), player('u1', 'Сам'))).toThrow(/добавляет админ/);
  });

  it('в обычном режиме игрок садится сам и становится хостом', () => {
    const room: Room = { ...adminRoom(), mode: ROOM_MODE.ONLINE, hostId: null };
    const next = applyPatch(room, joinPatch(room, player('u1', 'Аня'))!);
    expect(next.hostId).toBe('u1');
    expect(next.players).toHaveLength(1);
  });

  it('в обычном режиме выход из-за стола передаёт хоста дальше', () => {
    let room: Room = { ...adminRoom(), mode: ROOM_MODE.ONLINE, hostId: null };
    room = applyPatch(room, joinPatch(room, player('u1', 'Аня'))!);
    room = applyPatch(room, joinPatch(room, player('u2', 'Боря'))!);
    room = applyPatch(room, leavePatch(room, 'u1'));
    expect(room.hostId).toBe('u2');
  });
});

describe('игра, которую ведёт админ', () => {
  function started(): Room {
    const room = adminRoom(['Аня', 'Боря', 'Вера', 'Гоша']);
    return applyPatch(room, startGamePatch(room, ADMIN));
  }

  it('админ стартует игру, не будучи игроком', () => {
    const room = started();
    expect(room.status).toBe(ROOM_STATUS.PLAYING);
    expect(room.game!.playerOrder).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(room.players.some((p) => p.uid === ADMIN)).toBe(false);
  });

  it('админ вводит заказы за всех по очереди', () => {
    let room = started();
    const order = biddingOrder(room.game!.playerOrder, 0);
    for (const uid of order.slice(0, 3)) {
      room = applyPatch(room, bidPatch(room, { actorUid: ADMIN, targetUid: uid, value: 0 }));
    }
    // Трое спасовали, значит последнему нельзя заказать единственную карту.
    expect(() =>
      bidPatch(room, { actorUid: ADMIN, targetUid: order[3], value: 1 }),
    ).toThrow(/сумма заказов/);

    room = applyPatch(room, bidPatch(room, { actorUid: ADMIN, targetUid: order[3], value: 0 }));
    expect(room.game!.phase).toBe(GAME_PHASE.RESULTS);
  });

  it('порядок ввода нарушать нельзя даже админу', () => {
    const room = started();
    // Первым заказывает p2 — раздающий p1 заказывает последним.
    expect(() => bidPatch(room, { actorUid: ADMIN, targetUid: 'p1', value: 0 })).toThrow(
      /заказывает другой игрок/,
    );
  });

  it('админ закрывает раунд и очки считаются', () => {
    let room = started();
    // Раздаёт p1, значит заказ идёт p2 -> p3 -> p4 -> p1.
    for (const [uid, value] of [['p2', 1], ['p3', 0], ['p4', 0], ['p1', 1]] as const) {
      room = applyPatch(room, bidPatch(room, { actorUid: ADMIN, targetUid: uid, value }));
    }
    room = applyPatch(
      room,
      closeRoundPatch(room, { actorUid: ADMIN, tricks: { p2: 1, p1: 0, p3: 0, p4: 0 } }),
    );
    expect(room.history[0].scores).toEqual({ p2: 10, p3: 5, p4: 5, p1: -10 });
    expect(room.history[0].closedBy).toBe(ADMIN);
  });

  it('посторонний не может вводить за стол', () => {
    const room = started();
    expect(() => bidPatch(room, { actorUid: 'stranger', targetUid: 'p1', value: 0 })).toThrow(
      /не за этим столом/,
    );
  });

  it('во вью админ управляет столом, остальные только смотрят', () => {
    const room = started();
    const asAdmin = selectRoomView(room, ADMIN)!;
    expect(asAdmin.isSingleDevice).toBe(true);
    expect(asAdmin.isHost).toBe(true);
    expect(asAdmin.canControl).toBe(true);
    expect(asAdmin.amAtTable).toBe(false);

    const asGuest = selectRoomView(room, 'someone')!;
    expect(asGuest.canControl).toBe(false);
    expect(asGuest.isHost).toBe(false);
  });

  it('в обычном режиме управлять могут все за столом', () => {
    const room: Room = { ...adminRoom(['Аня']), mode: ROOM_MODE.ONLINE };
    expect(selectRoomView(room, 'p1')!.canControl).toBe(true);
    expect(selectRoomView(room, 'someone')!.canControl).toBe(true);
  });

  it('старый документ без режима считается обычным столом', () => {
    const room = { ...adminRoom(['Аня']) } as Partial<Room>;
    delete room.mode;
    const view = selectRoomView(room as Room, 'p1')!;
    expect(view.mode).toBe(ROOM_MODE.ONLINE);
    expect(view.isSingleDevice).toBe(false);
  });
});

describe('стол: имя и удаление', () => {
  it('переименование обрезает пробелы и требует непустое имя', () => {
    const room = adminRoom(['Аня']);
    expect(renameRoomPatch(room, ADMIN, '  Дачная игра  ')).toEqual({ name: 'Дачная игра' });
    expect(renameRoomPatch(room, ADMIN, room.name)).toBe(null);
    expect(() => renameRoomPatch(room, ADMIN, '   ')).toThrow(/не может быть пустым/);
  });

  it('переименовать может только админ, но даже в идущей партии', () => {
    const room = adminRoom(['Аня']);
    expect(() => renameRoomPatch(room, 'someone', 'Чужой')).toThrow(/только админ/);
    const playing = { ...room, status: ROOM_STATUS.PLAYING };
    expect(renameRoomPatch(playing, ADMIN, 'Новое')).toEqual({ name: 'Новое' });
  });

  it('удалять стол можно только админу и только вне партии', () => {
    const room = adminRoom(['Аня', 'Боря']);
    expect(() => assertCanDeleteRoom(room, ADMIN)).not.toThrow();
    expect(() => assertCanDeleteRoom(room, 'someone')).toThrow(/только админ/);
    expect(() => assertCanDeleteRoom({ ...room, status: ROOM_STATUS.PLAYING }, ADMIN)).toThrow(
      /Идёт партия/,
    );
  });
});
