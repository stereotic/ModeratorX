/**
 * Human-readable formatters for Telegram messages.
 */

import type { AccountListItem } from '../../application/use-cases/accounts/list-accounts.use-case.js';
import type { TweetListItem } from '../../application/use-cases/tweets/list-tweets.use-case.js';
import type { UserSettingsEntity } from '../../domain/entities/user-settings.entity.js';
import type { ActionLogEntity } from '../../domain/entities/action-log.entity.js';
import type { UserStatistics } from '../../shared/types.js';
import { isAppError } from '../../shared/errors.js';

export function formatWelcome(firstName: string | null): string {
  const name = firstName ?? 'друг';
  return (
    `👋 Привет, *${name}*!\n\n` +
    `Добро пожаловать в *X Comment Moderator* — твоего AI-ассистента для модерации комментариев.\n\n` +
    `▸ Подключи X аккаунт\n` +
    `▸ Добавь посты для отслеживания\n` +
    `▸ GPT сам ответит на позитив и скроет негатив\n\n` +
    `Используй меню ниже или /help.`
  );
}

export function formatHelp(): string {
  return (
    `*🤖 Команды*\n\n` +
    `/start — главное меню\n` +
    `/accounts — X аккаунты\n` +
    `/tweets — отслеживаемые посты\n` +
    `/settings — настройки\n` +
    `/stats — статистика\n` +
    `/logs — последние действия\n` +
    `/help — это сообщение\n\n` +
    `*📋 Как это работает*\n\n` +
    `1. Подключи X аккаунт через OAuth\n` +
    `2. Добавь URL своего поста\n` +
    `3. Запусти мониторинг\n` +
    `4. Бот сам: *позитив* → ответит · *негатив* → скроет · *нейтрально* → пропустит`
  );
}

export function formatAccounts(accounts: AccountListItem[]): string {
  if (accounts.length === 0) {
    return '📭 X‑аккаунты ещё не подключены.\nНажми *Подключить X аккаунт*, чтобы добавить.';
  }

  const lines = accounts.map((account, index) => {
    const status = account.isActive ? '🟢 активен' : '🔴 неактивен';
    const name = account.displayName ? ` (_${account.displayName}_)` : '';
    return `${index + 1}. @${account.twitterUsername}${name} — ${status}`;
  });

  return `*🔗 Подключенные аккаунты (${accounts.length})*\n\n${lines.join('\n')}`;
}

export function formatTweets(items: TweetListItem[]): string {
  if (items.length === 0) {
    return '📭 Посты ещё не добавлены.\nНажми *Добавить пост* и отправь URL твита.';
  }

  const lines = items.map((item, index) => {
    const flag = item.tweet.isMonitoring ? '🟢' : '⏸️';
    const status = item.tweet.isMonitoring ? 'отслеживается' : 'на паузе';
    const preview = (item.tweet.tweetText ?? '').slice(0, 60).replaceAll('\n', ' ');
    return (
      `${index + 1}. ${flag} *@${item.accountUsername}* — _${status}_\n` +
      `   🆔 \`${item.tweet.tweetId}\`\n` +
      `   💬 ${preview || '(нет текста)'}`
    );
  });

  return `*📊 Отслеживаемые посты (${items.length})*\n\n${lines.join('\n\n')}`;
}

export function formatSettings(settings: UserSettingsEntity, config: {
  minInterval: number;
  maxInterval: number;
}): string {
  const prompt = settings.gptPrompt
    ? settings.gptPrompt.slice(0, 200) + (settings.gptPrompt.length > 200 ? '…' : '')
    : '_системный промпт по умолчанию_';

  return (
    `*⚙️ Настройки*\n\n` +
    `▸ *Режим:* \`${settings.moderationMode}\`\n` +
    `▸ *Интервал:* ${settings.checkIntervalSec}с (${config.minInterval}–${config.maxInterval})\n` +
    `▸ *Порог:* ${settings.confidenceThreshold}\n\n` +
    `*🧠 GPT промпт:*\n${prompt}`
  );
}

export function formatStats(stats: UserStatistics): string {
  return (
    `*📈 Статистика*\n\n` +
    `▸ *Аккаунтов:* ${stats.connectedAccounts}\n` +
    `▸ *Постов:* ${stats.totalMonitoredTweets} (активных задач: ${stats.activeMonitoringJobs})\n\n` +
    `*📝 Проанализировано ответов:* ${stats.totalRepliesAnalyzed}\n` +
    `   👍 позитивных: ${stats.totalPositive}\n` +
    `   👎 негативных: ${stats.totalNegative}\n` +
    `   ⚪ нейтральных: ${stats.totalNeutral}\n\n` +
    `*💬 Отправлено ответов:* ${stats.totalRepliesPosted}\n` +
    `*🚫 Скрыто ответов:* ${stats.totalRepliesHidden}`
  );
}

const ACTION_EMOJI: Record<string, string> = {
  REPLY_POSTED: '💬',
  REPLY_HIDDEN: '🚫',
  ANALYSIS_COMPLETED: '🤖',
  MONITORING_STARTED: '▶️',
  MONITORING_STOPPED: '⏹️',
  TOKEN_REFRESHED: '🔄',
  ACCOUNT_CONNECTED: '🔗',
  ACCOUNT_DISCONNECTED: '🔗',
  TWEET_ADDED: '📌',
  TWEET_REMOVED: '🗑️',
  SETTINGS_UPDATED: '⚙️',
  ERROR: '❌',
};

export function formatLogs(logs: ActionLogEntity[]): string {
  if (logs.length === 0) {
    return '📭 Действий ещё не было.';
  }

  const lines = logs.map((entry) => {
    const emoji = ACTION_EMOJI[entry.action] ?? (entry.isSuccess ? '✅' : '❌');
    const time = entry.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    const displayAction = entry.action.replaceAll('_', '·');
    const err = entry.isSuccess ? '' : entry.errorMessage ? ` — ${entry.errorMessage}` : '';
    return `${emoji} ${time} ${displayAction}${err}`;
  });

  return `📋 Последние действия\n\n${lines.join('\n')}`;
}

export function formatError(error: unknown): string {
  if (isAppError(error)) {
    return `⚠️ ${error.message}`;
  }

  return '⚠️ Что-то пошло не так. Попробуй ещё раз.';
}
