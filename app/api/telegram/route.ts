import { NextRequest, NextResponse } from 'next/server';
import TelegramBot from 'node-telegram-bot-api';
import { handleTextMessage, handleVoiceMessage } from '@/lib/telegram';

// Хранилище состояний пользователей (в продакшене лучше использовать Redis или БД)
const userStates = new Map<number, any>();

// Инициализация бота
let bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN не настроен');
  }

  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
  }

  return bot;
}

export async function POST(request: NextRequest) {
  try {
    // Проверка секрета webhook
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const providedSecret = request.headers.get('x-telegram-bot-api-secret-token');
    
    if (webhookSecret && providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Проверка токена бота
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN не настроен');
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    const telegramBot = getBot();
    
    // Обработка обновления от Telegram
    if (body.message) {
      const msg = body.message;
      const chatId = msg.chat.id;
      
      // Обработка команд
      if (msg.text === '/start') {
        console.log('Отправляю сообщение в чат:', chatId);
        await telegramBot.sendMessage(chatId, 
          '👋 Привет! Я помогу создать задачу для Jira.\n\n' +
          'Просто напиши описание задачи, начав с названия команды:\n' +
          '• Разработка\n• Дизайн\n• Аналитика\n• Эксперты\n• UX\n• Поиск\n• Рекомендации\n\n' +
          'Пример: "Разработка: нужно добавить кнопку сортировки"'
        );
        return NextResponse.json({ ok: true });
      }
      
      if (msg.text === '/help') {
        console.log('Отправляю сообщение в чат:', chatId);
        await telegramBot.sendMessage(chatId,
          '📝 Как пользоваться:\n\n' +
          '1. Напиши название команды и описание задачи\n' +
          '2. Я задам уточняющие вопросы если нужно\n' +
          '3. Получишь готовую задачу для Jira\n\n' +
          'Команды: /start, /help, /teams'
        );
        return NextResponse.json({ ok: true });
      }
      
      if (msg.text === '/teams') {
        console.log('Отправляю сообщение в чат:', chatId);
        const { loadTemplates } = await import('@/lib/templates');
        const teams = loadTemplates();
        const teamsList = teams.map(t => `• ${t.name}`).join('\n');
        await telegramBot.sendMessage(chatId, `📋 Доступные команды:\n\n${teamsList}`);
        return NextResponse.json({ ok: true });
      }

      // Текстовое сообщение
      if (msg.text) {
        await handleTextMessage(msg.text, chatId, telegramBot, userStates);
      }
      
      // Голосовое сообщение
      if (msg.voice) {
        await handleVoiceMessage(msg.voice.file_id, chatId, telegramBot, userStates, process.env.TELEGRAM_BOT_TOKEN);
      }
    }

    // Обработка callback query (кнопки)
    if (body.callback_query) {
      const query = body.callback_query;
      const chatId = query.message?.chat.id;
      
      if (query.data?.startsWith('team_') && chatId) {
        const teamId = query.data.replace('team_', '');
        const { loadTemplates } = await import('@/lib/templates');
        const teams = loadTemplates();
        const team = teams.find(t => t.id === teamId);
        
        if (team) {
          const selectedTeam = team.subtypes.length > 0
            ? { teamId: team.id, subtypeId: team.subtypes[0].id }
            : { teamId: team.id };
          
          const state = userStates.get(chatId) || {};
          state.selectedTeam = selectedTeam;
          userStates.set(chatId, state);
          
          // Используем processTask
          const { processTask } = await import('@/lib/telegram');
          if (state.userText) {
            await processTask(state.userText, selectedTeam, chatId, telegramBot, userStates);
          }
        }
        
        await telegramBot.answerCallbackQuery(query.id);
      } else if (query.data?.startsWith('copy_')) {
        await telegramBot.answerCallbackQuery(query.id, { text: 'Используйте кнопку копирования в сообщении' });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Ошибка в Telegram webhook:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
    
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message },
      { status: 500 }
    );
  }
}

// GET для проверки webhook
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Telegram webhook endpoint is active',
    hasToken: !!process.env.TELEGRAM_BOT_TOKEN
  });
}

