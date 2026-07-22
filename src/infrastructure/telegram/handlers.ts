/**
 * Command and callback handlers for the Telegram bot.
 */

import { InlineKeyboard } from 'grammy';
import type { Bot } from 'grammy';
import type { BotContext } from './context.js';
import {
  CallbackData,
  accountsMenuKeyboard,
  backToMainKeyboard,
  mainMenuKeyboard,
  moderationModeKeyboard,
  settingsMenuKeyboard,
} from './keyboards.js';
import {
  formatAccounts,
  formatError,
  formatHelp,
  formatLogs,
  formatSettings,
  formatStats,
  formatTweets,
  formatWelcome,
} from './formatters.js';
import type { ModerationMode } from '../../domain/enums/index.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('TelegramHandlers');

/** Register all bot routes */
export function registerBotHandlers(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx) => {
    ctx.session.awaiting = null;
    ctx.session.selectedAccountId = null;

    await ctx.reply(formatWelcome(ctx.dbUser.firstName), {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(formatHelp(), {
      parse_mode: 'Markdown',
      reply_markup: backToMainKeyboard(),
    });
  });

  bot.command('accounts', async (ctx) => {
    await replyAccountsMenu(ctx);
  });

  bot.command('tweets', async (ctx) => {
    await replyTweetsMenu(ctx);
  });

  bot.command('settings', async (ctx) => {
    await replySettingsMenu(ctx);
  });

  bot.command('stats', async (ctx) => {
    await replyStats(ctx);
  });

  bot.command('logs', async (ctx) => {
    await replyLogs(ctx);
  });

  bot.callbackQuery(CallbackData.menuMain, async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaiting = null;
    await ctx.editMessageText(formatWelcome(ctx.dbUser.firstName), {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.callbackQuery(CallbackData.menuHelp, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(formatHelp(), {
      parse_mode: 'Markdown',
      reply_markup: backToMainKeyboard(),
    });
  });

  bot.callbackQuery(CallbackData.menuAccounts, async (ctx) => {
    await ctx.answerCallbackQuery();
    await replyAccountsMenu(ctx, true);
  });

  bot.callbackQuery(CallbackData.menuTweets, async (ctx) => {
    await ctx.answerCallbackQuery();
    await replyTweetsMenu(ctx, true);
  });

  bot.callbackQuery(CallbackData.menuSettings, async (ctx) => {
    await ctx.answerCallbackQuery();
    await replySettingsMenu(ctx, true);
  });

  bot.callbackQuery(CallbackData.menuStats, async (ctx) => {
    await ctx.answerCallbackQuery();
    await replyStats(ctx, true);
  });

  bot.callbackQuery(CallbackData.menuLogs, async (ctx) => {
    await ctx.answerCallbackQuery();
    await replyLogs(ctx, true);
  });

  bot.callbackQuery(CallbackData.accAdd, async (ctx) => {
    await ctx.answerCallbackQuery();

    const result = await ctx.container.useCases.accounts.startOAuth.execute({
      telegramId: ctx.dbUser.telegramId,
      telegramUsername: ctx.dbUser.telegramUsername ?? undefined,
      firstName: ctx.dbUser.firstName ?? undefined,
    });

    const keyboard = new InlineKeyboard()
      .url('🔗 Authorize on X', result.authorizationUrl)
      .row()
      .text('« Назад', CallbackData.menuAccounts);

    await ctx.reply(
      `🌐 Открой ссылку ниже, чтобы подключить X аккаунт.\nПосле авторизации возвращайся сюда — я подтвержу автоматически.`,
      { reply_markup: keyboard },
    );
  });

  bot.callbackQuery(CallbackData.accList, async (ctx) => {
    await ctx.answerCallbackQuery();
    await replyAccountList(ctx, true);
  });

  bot.callbackQuery(/^a:d:(.+)$/, async (ctx) => {
    const accountId = ctx.match[1];

    if (!accountId) {
      await ctx.answerCallbackQuery({ text: 'Неверный аккаунт' });
      return;
    }

    await ctx.container.useCases.accounts.disconnectAccount.execute({
      userId: ctx.dbUser.id,
      accountId,
    });

    await ctx.answerCallbackQuery({ text: 'Аккаунт отключён' });
    await replyAccountList(ctx, true);
  });

  bot.callbackQuery(CallbackData.twAdd, async (ctx) => {
    await ctx.answerCallbackQuery();

    const accounts = await ctx.container.useCases.accounts.listAccounts.execute(
      ctx.dbUser.id,
    );

    if (accounts.length === 0) {
      await ctx.reply('Сначала подключи X аккаунт.', {
        reply_markup: accountsMenuKeyboard(),
      });
      return;
    }

    const keyboard = new InlineKeyboard();

    for (const account of accounts) {
      keyboard.text(`@${account.twitterUsername}`, `${CallbackData.twPickAccPrefix}${account.id}`).row();
    }

    keyboard.text('« Назад', CallbackData.menuTweets);

    await ctx.reply(
      '📎 Выбери X аккаунт, которому принадлежит пост:',
      {
        reply_markup: keyboard,
      },
    );
  });

  bot.callbackQuery(/^t:a:(.+)$/, async (ctx) => {
    const accountId = ctx.match[1];

    if (!accountId) {
      await ctx.answerCallbackQuery({ text: 'Неверный аккаунт' });
      return;
    }

    ctx.session.selectedAccountId = accountId;
    ctx.session.awaiting = 'tweet_url';

    await ctx.answerCallbackQuery();
    await ctx.reply(
      '🔗 Отправь URL поста (или числовой ID твита).\n\nПример:\n`https://x.com/user/status/1234567890`',
      { parse_mode: 'Markdown' },
    );
  });

  bot.callbackQuery(/^t:d:(.+)$/, async (ctx) => {
    const tweetDbId = ctx.match[1];

    if (!tweetDbId) {
      await ctx.answerCallbackQuery({ text: 'Неверный пост' });
      return;
    }

    await ctx.container.useCases.tweets.removeTweet.execute({
      userId: ctx.dbUser.id,
      tweetDbId,
    });

    await ctx.answerCallbackQuery({ text: 'Пост удалён' });
    await replyTweetsMenu(ctx, true);
  });

  bot.callbackQuery(/^t:s:(.+)$/, async (ctx) => {
    const tweetDbId = ctx.match[1];

    if (!tweetDbId) {
      await ctx.answerCallbackQuery({ text: 'Неверный пост' });
      return;
    }

    await ctx.container.useCases.tweets.startMonitoring.execute({
      userId: ctx.dbUser.id,
      tweetDbId,
    });

    await ctx.answerCallbackQuery({ text: 'Мониторинг запущен' });
    await replyTweetsMenu(ctx, true);
  });

  bot.callbackQuery(/^t:x:(.+)$/, async (ctx) => {
    const tweetDbId = ctx.match[1];

    if (!tweetDbId) {
      await ctx.answerCallbackQuery({ text: 'Неверный пост' });
      return;
    }

    await ctx.container.useCases.tweets.stopMonitoring.execute({
      userId: ctx.dbUser.id,
      tweetDbId,
    });

    await ctx.answerCallbackQuery({ text: 'Мониторинг остановлен' });
    await replyTweetsMenu(ctx, true);
  });

  bot.callbackQuery(CallbackData.setPrompt, async (ctx) => {
    ctx.session.awaiting = 'gpt_prompt';
    await ctx.answerCallbackQuery();
    await ctx.reply(
      '🧠 Отправь новый GPT системный промпт для классификации и ответов.\n\nОтправь `-`, чтобы сбросить и использовать стандартный.',
      { parse_mode: 'Markdown' },
    );
  });

  bot.callbackQuery(CallbackData.setInterval, async (ctx) => {
    ctx.session.awaiting = 'check_interval';
    const { MIN_CHECK_INTERVAL, MAX_CHECK_INTERVAL } = ctx.container.config;
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `Отправь интервал проверки в секундах (${MIN_CHECK_INTERVAL}–${MAX_CHECK_INTERVAL}).`,
    );
  });

  bot.callbackQuery(CallbackData.setConfidence, async (ctx) => {
    ctx.session.awaiting = 'confidence';
    await ctx.answerCallbackQuery();
    await ctx.reply('Отправь порог уверенности числом от 0 до 1 (например `0.75`).', {
      parse_mode: 'Markdown',
    });
  });

  bot.callbackQuery(CallbackData.setModeMenu, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      '*⚙️ Режим модерации*\n\n' +
        '▸ `AUTO` — отвечать и скрывать автоматически\n' +
        '▸ `NOTIFY_ONLY` — классифицировать + уведомлять, без изменений в X\n' +
        '▸ `DRY_RUN` — только классификация',
      { parse_mode: 'Markdown', reply_markup: moderationModeKeyboard() },
    );
  });

  bot.callbackQuery(/^s:m:(AUTO|NOTIFY_ONLY|DRY_RUN)$/, async (ctx) => {
    const mode = ctx.match[1] as ModerationMode;

    await ctx.container.useCases.settings.updateSettings.execute({
      userId: ctx.dbUser.id,
      moderationMode: mode,
    });

    await ctx.answerCallbackQuery({ text: `Режим: ${mode}` });
    await replySettingsMenu(ctx, true);
  });

  bot.on('message:text', async (ctx) => {
    const awaiting = ctx.session.awaiting;

    if (!awaiting) {
      await ctx.reply('📋 Используй /start, чтобы открыть меню.', {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    const text = ctx.message.text.trim();

    try {
      if (awaiting === 'tweet_url') {
        const accountId = ctx.session.selectedAccountId;

        if (!accountId) {
          ctx.session.awaiting = null;
        await ctx.reply('⏱️ Сессия истекла. Пожалуйста, добавь пост заново.', {
          reply_markup: mainMenuKeyboard(),
        });
          return;
        }

        const tweet = await ctx.container.useCases.tweets.addTweet.execute({
          userId: ctx.dbUser.id,
          accountId,
          tweetUrlOrId: text,
        });

        ctx.session.awaiting = null;
        ctx.session.selectedAccountId = null;

        await ctx.reply(
          `✅ Пост добавлен: \`${tweet.tweetId}\`\n📂 Открой *Посты*, чтобы запустить мониторинг.`,
          { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() },
        );
        return;
      }

      if (awaiting === 'gpt_prompt') {
        const prompt = text === '-' ? null : text;
        await ctx.container.useCases.settings.updateSettings.execute({
          userId: ctx.dbUser.id,
          gptPrompt: prompt,
        });
        ctx.session.awaiting = null;
        await ctx.reply('✅ GPT промпт обновлён.', { reply_markup: settingsMenuKeyboard() });
        return;
      }

      if (awaiting === 'check_interval') {
        const seconds = Number.parseInt(text, 10);

        if (Number.isNaN(seconds) || seconds <= 0) {
          await ctx.reply('❌ Пожалуйста, отправь целое положительное число секунд.');
          return;
        }

        const { MIN_CHECK_INTERVAL, MAX_CHECK_INTERVAL } = ctx.container.config;

        if (seconds < MIN_CHECK_INTERVAL || seconds > MAX_CHECK_INTERVAL) {
          await ctx.reply(`❌ Интервал должен быть от ${MIN_CHECK_INTERVAL} до ${MAX_CHECK_INTERVAL} секунд.`);
          return;
        }

        await ctx.container.useCases.settings.updateSettings.execute({
          userId: ctx.dbUser.id,
          checkIntervalSec: seconds,
        });
        ctx.session.awaiting = null;
        await ctx.reply(`✅ Интервал проверки установлен: ${seconds}с.`, {
          reply_markup: settingsMenuKeyboard(),
        });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (awaiting === 'confidence') {
        const value = Number.parseFloat(text);

        if (Number.isNaN(value) || value < 0 || value > 1) {
          await ctx.reply('❌ Пожалуйста, отправь число от 0 до 1 (например `0.75`).', {
            parse_mode: 'Markdown',
          });
          return;
        }

        await ctx.container.useCases.settings.updateSettings.execute({
          userId: ctx.dbUser.id,
          confidenceThreshold: value,
        });
        ctx.session.awaiting = null;
        await ctx.reply(`✅ Порог уверенности установлен: ${value}.`, {
          reply_markup: settingsMenuKeyboard(),
        });
        return;
      }
    } catch (error) {
      log.error({ err: error }, 'Text input handler failed');
      await ctx.reply(formatError(error), { parse_mode: 'Markdown' });
    }
  });
}

async function replyAccountsMenu(ctx: BotContext, edit = false): Promise<void> {
  const text = '*🔗 Аккаунты*\n\nПодключай X аккаунты через OAuth (макс. лимит настроен).';
  const markup = accountsMenuKeyboard();

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: markup });
    return;
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: markup });
}

async function replyAccountList(ctx: BotContext, edit = false): Promise<void> {
  const accounts = await ctx.container.useCases.accounts.listAccounts.execute(ctx.dbUser.id);
  const text = formatAccounts(accounts);
  const keyboard = new InlineKeyboard();

  for (const account of accounts) {
    keyboard
      .text(`❌ @${account.twitterUsername}`, `${CallbackData.accDelPrefix}${account.id}`)
      .row();
  }

  keyboard.text('« Назад', CallbackData.menuAccounts);

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    return;
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function replyTweetsMenu(ctx: BotContext, edit = false): Promise<void> {
  const items = await ctx.container.useCases.tweets.listTweets.execute(ctx.dbUser.id);
  const text = formatTweets(items);
  const keyboard = new InlineKeyboard().text('➕ Добавить пост', CallbackData.twAdd).row();

  for (const item of items.slice(0, 8)) {
    const label = item.tweet.tweetId.slice(-8);
    if (item.tweet.isMonitoring) {
      keyboard.text(`⏹ …${label}`, `${CallbackData.twStopPrefix}${item.tweet.id}`);
    } else {
      keyboard.text(`▶️ …${label}`, `${CallbackData.twStartPrefix}${item.tweet.id}`);
    }
    keyboard.text(`🗑 …${label}`, `${CallbackData.twDelPrefix}${item.tweet.id}`).row();
  }

  keyboard.text('« Назад', CallbackData.menuMain);

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    return;
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function replySettingsMenu(ctx: BotContext, edit = false): Promise<void> {
  const settings = await ctx.container.useCases.settings.getSettings.execute(ctx.dbUser.id);
  const text = formatSettings(settings, {
    minInterval: ctx.container.config.MIN_CHECK_INTERVAL,
    maxInterval: ctx.container.config.MAX_CHECK_INTERVAL,
  });
  const markup = settingsMenuKeyboard();

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: markup });
    return;
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: markup });
}

async function replyStats(ctx: BotContext, edit = false): Promise<void> {
  const stats = await ctx.container.useCases.stats.getStats.execute(ctx.dbUser.id);
  const text = formatStats(stats);
  const markup = backToMainKeyboard();

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: markup });
    return;
  }

  await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: markup });
}

async function replyLogs(ctx: BotContext, edit = false): Promise<void> {
  const logs = await ctx.container.useCases.stats.getRecentActions.execute(ctx.dbUser.id);
  const text = formatLogs(logs);
  const markup = backToMainKeyboard();

  if (edit && ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: markup });
    return;
  }

  await ctx.reply(text, { reply_markup: markup });
}
