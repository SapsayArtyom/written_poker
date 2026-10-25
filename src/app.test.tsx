// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter } from 'react-router-dom';
import App from './App.js';
import * as backend from './services/localBackend.js';
import { buildRoundPlan, biddingOrder } from './game/rounds.js';
import { ROUND_KIND } from './game/constants.js';
import type { Player, Room } from './types.js';

/**
 * Сквозной прогон приложения в jsdom на локальном бэкенде:
 * вход → лобби → стол → старт игры → заказ → взятки → расписка,
 * отдельно — мизерный раунд, который идёт без заказа.
 */

function mount() {
  return render(
    <HashRouter>
      <App />
    </HashRouter>,
  );
}

const other = (i: number, name: string): Player => ({
  uid: `u${i}`,
  name,
  photoURL: null,
  isGuest: true,
});

/** Есть ли среди столов стол с таким названием. */
function readRoomByName(name: string): boolean {
  let found = false;
  backend.subscribeRooms((rooms) => {
    found = rooms.some((r) => r.name === name);
  })();
  return found;
}

/** Снимок комнаты из того же бэкенда, что использует приложение. */
function readRoom(): Room {
  let room: Room | null = null;
  backend.subscribeRooms((rooms) => {
    // В тестах стол всегда один: либо дефолтный, либо созданный админом.
    room = rooms.at(-1) ?? null;
  })();
  if (!room) throw new Error('Комната не найдена');
  return room;
}

beforeEach(async () => {
  await backend.signOut();
  localStorage.clear();
  window.location.hash = '';
});

afterEach(cleanup);

/** Создаёт стол в режиме «один ведёт стол» и заходит в него админом. */
async function createSingleTable(user: ReturnType<typeof userEvent.setup>, players: string[]) {
  await user.click(await screen.findByRole('button', { name: 'Новый стол' }));
  await user.type(screen.getByLabelText('Название стола'), 'Мой стол');
  await user.click(screen.getByRole('radio', { name: /Один ведёт стол/ }));
  await user.click(screen.getByRole('button', { name: 'Создать' }));

  // Админ уже сидит первым игроком — остальных добавляем руками.
  expect(await screen.findByText('вы админ')).toBeTruthy();
  for (const name of players) {
    await user.type(screen.getByLabelText('Имя нового игрока'), name);
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    await screen.findByRole('button', { name: `Переименовать ${name}` });
  }
}

async function loginAs(name: string) {
  const user = userEvent.setup();
  mount();
  await user.type(await screen.findByLabelText('Имя за столом'), name);
  await user.click(screen.getByRole('button', { name: 'Играть' }));
  return user;
}

/** Логинится как Аня, садится за стол, добирает остальных и стартует игру. */
async function startGameWith(names: string[]) {
  const user = await loginAs('Аня');
  await user.click(await screen.findByRole('button', { name: /Общий стол/ }));
  await user.click(await screen.findByRole('button', { name: 'Сесть за стол' }));
  for (const [i, name] of names.entries()) {
    await backend.joinRoom('default', other(i + 1, name));
  }
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Начать партию/ }).hasAttribute('disabled')).toBe(false),
  );
  await user.click(screen.getByRole('button', { name: /Начать партию/ }));
  return user;
}

describe('вход и лобби', () => {
  it('пускает в лобби и показывает дефолтный стол', async () => {
    await loginAs('Хэрри');

    expect(await screen.findByText('Лобби')).toBeTruthy();
    expect(await screen.findByText('Общий стол')).toBeTruthy();
    // В локальном режиме честно предупреждаем, где лежат данные.
    expect(screen.getByText(/Локальный режим/)).toBeTruthy();
    expect(screen.getByText('Хэрри')).toBeTruthy();
  });

  it('в локальном режиме кнопки Google нет', async () => {
    mount();
    await screen.findByLabelText('Имя за столом');
    expect(screen.queryByRole('button', { name: /Google/ })).toBe(null);
  });
});

describe('стол и первый раунд', () => {
  it('не даёт стартовать втроём и играет раунд вчетвером', async () => {
    const user = await loginAs('Аня');
    await user.click(await screen.findByRole('button', { name: /Общий стол/ }));
    await user.click(await screen.findByRole('button', { name: 'Сесть за стол' }));
    expect(await screen.findByText('вы хост')).toBeTruthy();

    await backend.joinRoom('default', other(1, 'Боря'));
    await backend.joinRoom('default', other(2, 'Вера'));

    // Втроём колода не раздаётся — старт заблокирован.
    await screen.findByText('Боря');
    await waitFor(() => {
      expect(screen.getByText(/Нужно чётное число игроков/)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Начать партию/ }).hasAttribute('disabled')).toBe(true);
    });

    await backend.joinRoom('default', other(3, 'Гоша'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Начать партию/ }).hasAttribute('disabled')).toBe(false),
    );
    expect(screen.getByText(/Раздаём по 9 карт — всего 36 раундов/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Начать партию/ }));

    // Первый раунд: одна карта. Раздаёт Аня — значит заказ начинает Боря,
    // а сама Аня заказывает последней.
    expect(await screen.findByText(/раунд 1 из 36/i)).toBeTruthy();
    expect(screen.getByText(/Раздаёт/)).toBeTruthy();
    expect(await screen.findByText('Заказ за Боря — вы хост')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: 'Заказать 1' }));

    for (const name of ['Вера', 'Гоша']) {
      expect(await screen.findByText(`Заказ за ${name} — вы хост`)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'пас' }));
      await user.click(screen.getByRole('button', { name: 'Заказать пас' }));
    }

    // Раздающему нельзя добить сумму заказов до 1 — пас заблокирован.
    expect(await screen.findByText('Ваш заказ')).toBeTruthy();
    expect(screen.getByText(/Нельзя заказать 0/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'пас' }).hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: 'Заказать 1' }));

    // Фаза взяток: единственную взятку отдаём хосту.
    expect(await screen.findByText('Кто сколько взял')).toBeTruthy();
    expect(screen.getByText('Осталось распределить взяток: 1')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ещё 1' }).hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Больше взяток у Боря' }));
    await waitFor(() => expect(screen.getByText('Все 1 взяток распределены')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Закрыть раунд' }));

    // Второй раунд раздаёт следующий игрок, значит заказ начинает третий.
    expect(await screen.findByText(/раунд 2 из 36/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Заказ за Вера — вы хост')).toBeTruthy());
  });

  it('несдержанный пас даёт по очку за взятку и попадает в расписку', async () => {
    const user = await startGameWith(['Боря']);

    // Вдвоём первый раунд — одна карта. Раздаёт Аня, заказ начинает Боря.
    // Оба пасуют: раздающей 1 заказать уже нельзя.
    expect(await screen.findByText('Заказ за Боря — вы хост')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'пас' }));
    await user.click(screen.getByRole('button', { name: 'Заказать пас' }));

    await screen.findByText('Ваш заказ');
    expect(screen.getByRole('button', { name: '1' }).hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'пас' }));
    await user.click(screen.getByRole('button', { name: 'Заказать пас' }));

    // Взятку кто-то обязан взять — пас Ани не сдержан, это +1, у Бори пас цел: +5.
    await screen.findByText('Кто сколько взял');
    await user.click(screen.getByRole('button', { name: 'Больше взяток у Аня' }));
    await user.click(screen.getByRole('button', { name: 'Закрыть раунд' }));

    await screen.findByText(/раунд 2 из 44/i);
    // «Расписка» есть и в переключателе разделов — берём именно заголовок карточки.
    const sheet = screen
      .getByText('Расписка', { selector: '.card__title' })
      .closest('.card') as HTMLElement;
    expect(within(sheet).getByText('0/1')).toBeTruthy();
    expect(within(sheet).getByText('0/0')).toBeTruthy();
    expect(within(sheet).getAllByText('1').length).toBeGreaterThan(0);
    expect(within(sheet).getAllByText('5').length).toBeGreaterThan(0);
  });
});

/**
 * Доигрывает раунды вдвоём прямо через бэкенд — так тесты добираются
 * до дальних раундов, не щёлкая по 44 раза.
 */
async function playRoundsViaBackend(count: number): Promise<void> {
  const order = readRoom().game!.playerOrder;
  const plan = buildRoundPlan(order.length);

  for (let i = readRoom().game!.roundIndex; i < Math.min(count, plan.length); i += 1) {
    const round = plan[i];
    if (round.hasBidding) {
      // Оба пасуют: запрещено только значение, добивающее сумму до числа карт.
      for (const uid of biddingOrder(order, i)) {
        await backend.submitBid('default', { actorUid: uid, targetUid: uid, value: 0 });
      }
    }
    await backend.submitRoundResults('default', {
      actorUid: order[0],
      tricks: { [order[0]]: round.cards, [order[1]]: 0 },
    });
  }
}

describe('мизера', () => {
  async function fastForwardToMisere(): Promise<void> {
    const plan = buildRoundPlan(readRoom().game!.playerOrder.length);
    await playRoundsViaBackend(plan.findIndex((r) => r.kind === ROUND_KIND.MISERE));
  }

  it('раунд идёт без заказа, сразу на подсчёте взяток', async () => {
    const user = await startGameWith(['Боря']);
    await screen.findByText(/раунд 1 из 44/i);

    await fastForwardToMisere();

    expect(await screen.findByText('Мизера')).toBeTruthy();
    expect(screen.getByText(/Мизера: заказа нет/)).toBeTruthy();
    expect(screen.getByText('Кто сколько взял')).toBeTruthy();
    // Заказа нет — значит нет ни сетки выбора, ни подписи «Ваш заказ».
    expect(screen.queryByText('Ваш заказ')).toBe(null);
    expect(screen.queryByRole('button', { name: 'пас' })).toBe(null);

    // Все 18 взяток забирает Боря: у него −360, у Ани +50.
    for (let i = 0; i < 18; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Больше взяток у Боря' }));
    }
    await waitFor(() => expect(screen.getByText('Все 18 взяток распределены')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Закрыть раунд' }));

    const misere = readRoom().history.at(-1)!;
    expect(misere.kind).toBe(ROUND_KIND.MISERE);
    expect(misere.bids).toEqual({});
    expect(Object.values(misere.scores).sort((a, b) => a - b)).toEqual([-360, 50]);
  });
});

describe('мобильная обвязка', () => {
  it('за столом есть переключатель разделов и липкая панель действия', async () => {
    await startGameWith(['Боря']);
    await screen.findByText(/раунд 1 из 44/i);

    // Переключатель «Ход / Расписка» — на телефоне разделы не влезают рядом.
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Ход', 'Расписка']);

    // Главное действие живёт в липкой панели снизу.
    const bar = document.querySelector('.actionbar');
    expect(bar).toBeTruthy();
    expect(within(bar as HTMLElement).getByRole('button', { name: /Выберите заказ|Заказать/ })).toBeTruthy();

    // Страница оставляет место под панель, чтобы та не накрывала контент.
    expect(document.querySelector('main')!.className).toContain('page--with-actionbar');
  });

  it('переключение на расписку скрывает панель хода', async () => {
    const user = await startGameWith(['Боря']);
    await screen.findByText(/раунд 1 из 44/i);

    await user.click(screen.getByRole('tab', { name: 'Расписка' }));

    const movePane = screen.getByText('Заказы', { selector: '.card__title' }).closest('.pane--hidden');
    expect(movePane).toBeTruthy();
    expect(document.querySelector('main')!.className).not.toContain('page--with-actionbar');
  });
});

describe('конец партии', () => {
  it('показывает итоги, а затем уводит партию в архив стола', async () => {
    const user = await startGameWith(['Боря']);
    await screen.findByText(/раунд 1 из 44/i);

    await playRoundsViaBackend(44);

    expect(await screen.findByText('Партия 1 завершена')).toBeTruthy();
    expect(screen.getByText(/Победитель —/)).toBeTruthy();
    // Раздел «Ход» на финале превращается в «Итоги».
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Итоги', 'Расписка']);
    // Сбрасывать партию, которая и так закончена, не предлагаем.
    expect(screen.queryByRole('button', { name: 'Сбросить партию' })).toBe(null);

    const finished = readRoom();
    expect(finished.status).toBe('finished');
    expect(finished.history).toHaveLength(44);

    // Возврат к столу: партия уходит в архив, состав остаётся.
    await user.click(screen.getByRole('button', { name: 'К столу — новая партия' }));

    expect(await screen.findByText('Сыгранные партии')).toBeTruthy();
    expect(screen.getByText('Партия 1')).toBeTruthy();
    expect(screen.getByText('44 раундов')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Начать партию 2' })).toBeTruthy();

    const room = readRoom();
    expect(room.status).toBe('waiting');
    expect(room.games).toHaveLength(1);
    expect(room.games![0].rounds).toBe(44);
    expect(room.games![0].results).toHaveLength(2);
    expect(room.history).toHaveLength(0);
    expect(room.players).toHaveLength(2);
  });
});

describe('режим «один ведёт стол»', () => {
  it('админ собирает состав: добавляет, переименовывает, переставляет, убирает', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря', 'Вера']);

    // Порядок хода — это порядок строк.
    const seats = () =>
      Array.from(document.querySelectorAll('.prow__name')).map((n) => n.textContent);
    expect(seats()).toEqual(['Аня', 'Боря', 'Вера']);

    // Переименование по нажатию на имя.
    await user.click(screen.getByRole('button', { name: 'Переименовать Вера' }));
    const field = screen.getByLabelText('Новое имя для Вера');
    await user.clear(field);
    await user.type(field, 'Вероника');
    await user.click(screen.getByRole('button', { name: 'ОК' }));
    await waitFor(() => expect(seats()).toEqual(['Аня', 'Боря', 'Вероника']));

    // Двойники не проходят.
    await user.type(screen.getByLabelText('Имя нового игрока'), 'боря');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    expect(await screen.findByText(/уже есть Боря/)).toBeTruthy();

    // Перестановка по кругу.
    await user.click(screen.getByRole('button', { name: 'Боря ниже по кругу' }));
    await waitFor(() => expect(seats()).toEqual(['Аня', 'Вероника', 'Боря']));

    // Втроём стартовать нельзя, вчетвером — можно.
    expect(screen.getByRole('button', { name: /Начать партию/ }).hasAttribute('disabled')).toBe(true);
    await user.clear(screen.getByLabelText('Имя нового игрока'));
    await user.type(screen.getByLabelText('Имя нового игрока'), 'Гоша');
    await user.click(screen.getByRole('button', { name: 'Добавить' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Начать партию/ }).hasAttribute('disabled')).toBe(false),
    );

    // Лишнего убираем.
    await user.click(screen.getByRole('button', { name: 'Убрать Гоша' }));
    await waitFor(() => expect(seats()).toEqual(['Аня', 'Вероника', 'Боря']));
  });

  it('админ ведёт раунд: заказ в один тап, взятки, очки', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря', 'Вера', 'Гоша']);
    await user.click(screen.getByRole('button', { name: /Начать партию/ }));

    expect(await screen.findByText(/раунд 1 из 36/i)).toBeTruthy();

    // Раздаёт первый в списке, поэтому заказ начинает второй.
    expect(screen.getByText('Раздаёт', { exact: false })).toBeTruthy();
    expect(screen.getByText('Заказ: Боря')).toBeTruthy();
    // Заказ пишется сразу по нажатию цифры — подтверждать не нужно.
    expect(screen.queryByRole('button', { name: /Выберите заказ/ })).toBe(null);
    await user.click(screen.getByRole('button', { name: '1' }));

    expect(await screen.findByText('Заказ: Вера')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'пас' }));
    await screen.findByText('Заказ: Гоша');
    await user.click(screen.getByRole('button', { name: 'пас' }));

    // Раздающая заказывает последней и не может добить сумму до одной карты.
    await screen.findByText('Заказ: Аня');
    expect(screen.getByRole('button', { name: 'пас' }).hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: '1' }));

    // Взятки вводит тот же админ.
    expect(await screen.findByText('Кто сколько взял')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Больше взяток у Боря' }));
    await user.click(screen.getByRole('button', { name: 'Закрыть раунд' }));

    expect(await screen.findByText(/раунд 2 из 36/i)).toBeTruthy();
    const sheet = screen
      .getByText('Расписка', { selector: '.card__title' })
      .closest('.card') as HTMLElement;
    await user.click(within(sheet).getByRole('button', { name: 'Показать итог' }));
    expect(within(sheet).getByText('1/1')).toBeTruthy();
    expect(within(sheet).getAllByText('-10').length).toBeGreaterThan(0);
  });

  it('ошибочный заказ отменяется', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря']);
    await user.click(screen.getByRole('button', { name: /Начать партию/ }));
    await screen.findByText(/раунд 1 из 44/i);

    // Раздаёт Аня, значит заказывает Боря.
    expect(await screen.findByText('Заказ: Боря')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'пас' }));
    expect(await screen.findByText('Заказ: Аня')).toBeTruthy();

    // Случайную отмену приложение сначала переспрашивает.
    await user.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Не надо' }));
    expect(screen.getByText('Заказ: Аня')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отменить заказ' }));
    expect(await screen.findByText('Заказ: Боря')).toBeTruthy();
  });

  it('за таким столом нельзя сесть самому', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря']);
    expect(screen.queryByRole('button', { name: 'Сесть за стол' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Позвать' })).toBe(null);
    await user.click(screen.getByRole('link', { name: 'В лобби' }));
    expect(await screen.findByText('один ведёт')).toBeTruthy();
  });
});

describe('стол между партиями', () => {
  it('стол переименовывается и удаляется', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря']);

    // Переименование.
    const field = screen.getByLabelText('Название стола');
    await user.clear(field);
    await user.type(field, 'Дачная игра');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));
    await waitFor(() => expect(readRoomByName('Дачная игра')).toBeTruthy());

    // Удаление спрашивает подтверждение и возвращает в лобби.
    await user.click(screen.getByRole('button', { name: 'Удалить стол' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
    expect(screen.queryByRole('dialog')).toBe(null);

    await user.click(screen.getByRole('button', { name: 'Удалить стол' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Удалить' }),
    );

    expect(await screen.findByText('Лобби')).toBeTruthy();
    expect(screen.queryByText('Дачная игра')).toBe(null);
  });

  it('перед новой партией можно поменять очерёдность', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря', 'Вера', 'Гоша']);

    const seats = () =>
      Array.from(document.querySelectorAll('.prow__name')).map((n) => n.textContent);
    expect(seats()).toEqual(['Аня', 'Боря', 'Вера', 'Гоша']);

    await user.click(screen.getByRole('button', { name: 'Гоша выше по кругу' }));
    await waitFor(() => expect(seats()).toEqual(['Аня', 'Боря', 'Гоша', 'Вера']));

    await user.click(screen.getByRole('button', { name: /Начать партию/ }));
    // Раздаёт первый в списке, заказ начинает второй.
    expect(await screen.findByText('Заказ: Боря')).toBeTruthy();
    expect(readRoom().game!.playerOrder).toEqual(['p1', 'p2', 'p4', 'p3']);
  });
});

describe('возврат к прошлому раунду', () => {
  it('спрашивает подтверждение, чтобы не сработал случайно', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря']);
    await user.click(screen.getByRole('button', { name: /Начать партию/ }));

    // Первый раунд: оба пасуют, взятку забирает Аня.
    await screen.findByText('Заказ: Боря');
    await user.click(screen.getByRole('button', { name: 'пас' }));
    await screen.findByText('Заказ: Аня');
    await user.click(screen.getByRole('button', { name: 'пас' }));
    await screen.findByText('Кто сколько взял');
    await user.click(screen.getByRole('button', { name: 'Больше взяток у Аня' }));
    await user.click(screen.getByRole('button', { name: 'Закрыть раунд' }));

    // Второй раунд: набираем взятки и жмём «Назад».
    await screen.findByText(/раунд 2 из 44/i);
    await screen.findByText('Заказ: Аня');
    await user.click(screen.getByRole('button', { name: 'пас' }));
    // Аня спасовала, значит Боре нельзя заказать все 2 карты — берём 1.
    await screen.findByText('Заказ: Боря');
    expect(screen.getByRole('button', { name: '2' }).hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: '1' }));
    await screen.findByText('Кто сколько взял');

    await user.click(screen.getByRole('button', { name: 'Назад' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('Вернуться к прошлому раунду?');
    expect(dialog.textContent).toContain('будут стёрты');

    // Отказ ничего не меняет.
    await user.click(within(dialog).getByRole('button', { name: 'Остаться' }));
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(readRoom().history).toHaveLength(1);
    expect(screen.getByText(/раунд 2 из 44/i)).toBeTruthy();

    // Согласие открывает прошлый раунд заново.
    await user.click(screen.getByRole('button', { name: 'Назад' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Вернуться назад' }),
    );
    await waitFor(() => expect(readRoom().history).toHaveLength(0));
    expect(screen.getByText(/раунд 1 из 44/i)).toBeTruthy();
  });
});

describe('расписка', () => {
  it('итог скрыт до нажатия, колонки одной ширины, в строке раунда — раздающий', async () => {
    const user = await loginAs('Аня');
    await createSingleTable(user, ['Боря']);
    await user.click(screen.getByRole('button', { name: /Начать партию/ }));
    await screen.findByText(/раунд 1 из 44/i);

    await user.click(screen.getByRole('tab', { name: 'Расписка' }));
    const sheet = screen
      .getByText('Расписка', { selector: '.card__title' })
      .closest('.card') as HTMLElement;

    // Итог спрятан, пока его не попросили.
    expect(within(sheet).getAllByText('•••').length).toBe(2);
    await user.click(within(sheet).getByRole('button', { name: 'Показать итог' }));
    expect(within(sheet).queryByText('•••')).toBe(null);
    await user.click(within(sheet).getByRole('button', { name: 'Скрыть итог' }));
    expect(within(sheet).getAllByText('•••').length).toBe(2);

    // Колонки игроков одной ширины.
    const cols = Array.from(sheet.querySelectorAll('col')).map(
      (c) => (c as HTMLElement).style.width,
    );
    expect(cols.slice(1)).toEqual(['46px', '46px', '46px', '46px']);
    expect(sheet.querySelector('table')!.className).toContain('sheet');

    // Раздающий помечен первой буквой имени: вдвоём это А, Б, А, Б…
    const dealers = Array.from(sheet.querySelectorAll('.rc__dealer')).map((n) => n.textContent);
    expect(dealers.slice(0, 4)).toEqual(['А', 'Б', 'А', 'Б']);
    expect(dealers).toHaveLength(44);
  });
});

describe('возврат на страницу', () => {
  it('восстанавливает текущий раунд из хранилища', async () => {
    await startGameWith(['Боря']);
    expect(await screen.findByText(/раунд 1 из 44/i)).toBeTruthy();

    cleanup();
    mount();

    expect(await screen.findByText(/раунд 1 из 44/i)).toBeTruthy();
    expect(screen.getAllByText('Аня').length).toBeGreaterThan(0);
  });
});
