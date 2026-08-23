import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Player } from '../types.js';

/** Минимальный localStorage + window, чтобы прогнать локальный бэкенд в node. */
function installBrowserStubs(): void {
  const data = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => data.set(k, String(v)),
    removeItem: (k: string) => data.delete(k),
    clear: () => data.clear(),
  };
  (globalThis as Record<string, unknown>).window = { addEventListener: () => undefined };
}

type Backend = typeof import('./localBackend.js');
let backend: Backend;

const player = (i: number): Player => ({
  uid: `u${i}`,
  name: `И${i}`,
  photoURL: null,
  isGuest: true,
});

beforeEach(async () => {
  installBrowserStubs();
  // Модуль читает localStorage при загрузке — сбрасываем реестр модулей,
  // чтобы каждый тест получил свежую «страницу» с чистым хранилищем.
  vi.resetModules();
  backend = await import('./localBackend.js');
});

describe('локальный бэкенд', () => {
  it('вход гостем отдаёт профиль и уведомляет слушателя', async () => {
    const seen: (unknown | null)[] = [];
    backend.observeAuth((u) => seen.push(u));

    const user = await backend.signInAsGuest('Хэрри');
    expect(user.displayName).toBe('Хэрри');
    expect(backend.toPlayerProfile(user)).toMatchObject({ name: 'Хэрри', isGuest: true });

    await new Promise((r) => setTimeout(r, 0));
    expect((seen.at(-1) as { displayName: string }).displayName).toBe('Хэрри');

    await backend.signOut();
    expect(seen.at(-1)).toBe(null);
  });

  it('вход через Google в локальном режиме недоступен', async () => {
    await expect(backend.signInWithGoogle()).rejects.toThrow(/только с подключённым Firebase/);
  });

  it('дефолтная комната создаётся один раз', async () => {
    const snapshots: unknown[][] = [];
    backend.subscribeRooms((list) => snapshots.push(list));

    await backend.ensureDefaultRoom();
    await backend.ensureDefaultRoom();

    expect(snapshots.at(-1)).toHaveLength(1);
    expect(snapshots.at(-1)![0]).toMatchObject({ id: 'default', isDefault: true, status: 'waiting' });
  });

  it('первый севший становится хостом, лишние игроки отклоняются', async () => {
    await backend.ensureDefaultRoom();

    let room: { players: Player[]; hostId: string | null } | null = null;
    backend.subscribeRoom('default', (r) => {
      room = r as never;
    });

    for (let i = 0; i < 6; i += 1) await backend.joinRoom('default', player(i));
    expect(room!.players).toHaveLength(6);
    expect(room!.hostId).toBe('u0');

    await expect(backend.joinRoom('default', player(6))).rejects.toThrow(/максимум 6/);
  });

  it('повторный вход тем же uid не дублирует игрока', async () => {
    await backend.ensureDefaultRoom();
    await backend.joinRoom('default', player(0));
    await backend.joinRoom('default', player(0));

    let room: { players: Player[] } | null = null;
    backend.subscribeRoom('default', (r) => {
      room = r as never;
    });
    expect(room!.players).toHaveLength(1);
  });

  it('играет раунд от старта до очков', async () => {
    await backend.ensureDefaultRoom();
    for (let i = 0; i < 4; i += 1) await backend.joinRoom('default', player(i));

    let room: {
      status: string;
      game: { playerOrder: string[]; phase: string; roundIndex: number };
      history: { scores: Record<string, number> }[];
    } | null = null;
    backend.subscribeRoom('default', (r) => {
      room = r as never;
    });

    await backend.startGame('default', 'u0');
    expect(room!.status).toBe('playing');
    expect(room!.game.playerOrder).toEqual(['u0', 'u1', 'u2', 'u3']);

    // Первый раунд — одна карта. Раздаёт u0, поэтому заказ начинает u1.
    await backend.submitBid('default', { actorUid: 'u1', targetUid: 'u1', value: 1 });
    await backend.submitBid('default', { actorUid: 'u2', targetUid: 'u2', value: 0 });
    await backend.submitBid('default', { actorUid: 'u3', targetUid: 'u3', value: 0 });

    // Раздающий заказывает последним и не может добить сумму заказов до 1.
    await expect(
      backend.submitBid('default', { actorUid: 'u0', targetUid: 'u0', value: 0 }),
    ).rejects.toThrow(/сумма заказов/);

    await backend.submitBid('default', { actorUid: 'u0', targetUid: 'u0', value: 1 });
    expect(room!.game.phase).toBe('results');

    await backend.submitRoundResults('default', {
      actorUid: 'u0',
      tricks: { u1: 1, u0: 0, u2: 0, u3: 0 },
    });

    expect(room!.history[0].scores).toEqual({ u1: 10, u2: 5, u3: 5, u0: -10 });
    expect(room!.game.roundIndex).toBe(1);
    expect(room!.game.phase).toBe('bidding');
  });

  it('нельзя выйти из-за стола во время игры', async () => {
    await backend.ensureDefaultRoom();
    for (let i = 0; i < 2; i += 1) await backend.joinRoom('default', player(i));
    await backend.startGame('default', 'u0');
    await expect(backend.leaveRoom('default', 'u1')).rejects.toThrow(/посреди игры/);
  });

  it('состояние переживает перезагрузку страницы', async () => {
    await backend.ensureDefaultRoom();
    await backend.joinRoom('default', player(0));

    // Новый импорт при том же localStorage = перезагрузка страницы.
    vi.resetModules();
    const reloaded = await import('./localBackend.js');
    let room: { players: Player[] } | null = null;
    reloaded.subscribeRoom('default', (r) => {
      room = r as never;
    });
    expect(room!.players).toEqual([player(0)]);
  });
});
