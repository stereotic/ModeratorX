/**
 * Inline keyboard builders for Telegram menus.
 * Callback data stays under Telegram's 64-byte limit.
 */

import { InlineKeyboard } from 'grammy';

export const CallbackData = {
  menuMain: 'm:main',
  menuAccounts: 'm:acc',
  menuTweets: 'm:tw',
  menuSettings: 'm:set',
  menuStats: 'm:st',
  menuLogs: 'm:log',
  menuHelp: 'm:help',

  accAdd: 'a:add',
  accList: 'a:list',
  accDelPrefix: 'a:d:',

  twAdd: 't:add',
  twPickAccPrefix: 't:a:',
  twDelPrefix: 't:d:',
  twStartPrefix: 't:s:',
  twStopPrefix: 't:x:',

  setPrompt: 's:p',
  setInterval: 's:i',
  setConfidence: 's:c',
  setModeMenu: 's:m',
  setModePrefix: 's:m:',
} as const;

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔗 Аккаунты', CallbackData.menuAccounts)
    .text('📊 Посты', CallbackData.menuTweets)
    .row()
    .text('⚙️ Настройки', CallbackData.menuSettings)
    .text('📈 Статистика', CallbackData.menuStats)
    .row()
    .text('📋 Действия', CallbackData.menuLogs)
    .text('❓ Помощь', CallbackData.menuHelp);
}

export function accountsMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔗 Подключить X аккаунт', CallbackData.accAdd)
    .row()
    .text('📋 Мои аккаунты', CallbackData.accList)
    .row()
    .text('« Назад', CallbackData.menuMain);
}

export function settingsMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🧠 GPT промпт', CallbackData.setPrompt)
    .text('⏱ Интервал', CallbackData.setInterval)
    .row()
    .text('🎯 Порог', CallbackData.setConfidence)
    .text('⚙️ Режим', CallbackData.setModeMenu)
    .row()
    .text('« Назад', CallbackData.menuMain);
}

export function moderationModeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('AUTO', `${CallbackData.setModePrefix}AUTO`)
    .text('NOTIFY_ONLY', `${CallbackData.setModePrefix}NOTIFY_ONLY`)
    .row()
    .text('DRY_RUN', `${CallbackData.setModePrefix}DRY_RUN`)
    .row()
    .text('« Назад', CallbackData.menuSettings);
}

export function backToMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('« Главное меню', CallbackData.menuMain);
}
