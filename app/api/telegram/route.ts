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
      const data = query.data;
      
      console.log('=== Получен callback_query ===');
      console.log('chatId:', chatId);
      console.log('data:', data);
      
      if (!chatId) {
        return NextResponse.json({ ok: true });
      }
      
      try {
        // Показываем "печатает" сразу
        await telegramBot.sendChatAction(chatId, 'typing');
        
        // === НОВАЯ ЗАДАЧА ===
        if (data === 'new_task') {
          userStates.delete(chatId);
          await telegramBot.sendMessage(
            chatId,
            '🆕 Готов к новой задаче!\n\n' +
            '📝 Отправьте описание текстом или голосом.\n\n' +
            'Начните с названия команды:\n' +
            '• Разработка\n• Дизайн\n• Аналитика\n• Эксперты\n• UX\n• Поиск\n• Рекомендации'
          );
          await telegramBot.answerCallbackQuery(query.id, { text: '✅ Готов!' });
          return NextResponse.json({ ok: true });
        }
        
        // === РЕДАКТИРОВАТЬ ===
        if (data === 'edit_task') {
          const state = userStates.get(chatId) || {};
          if (!state.lastGeneratedTask) {
            await telegramBot.answerCallbackQuery(query.id, { text: '❌ Нет задачи' });
            return NextResponse.json({ ok: true });
          }
          state.waitingForEdit = true;
          userStates.set(chatId, state);
          await telegramBot.sendMessage(
            chatId,
            '✏️ Опишите изменения текстом или голосом:\n\n' +
            'Примеры:\n' +
            '• "Добавь критерий про тестирование"\n' +
            '• "Убери раздел метрик"\n' +
            '• "Измени платформу на iOS"',
            {
              reply_markup: {
                inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'cancel_edit' }]]
              }
            }
          );
          await telegramBot.answerCallbackQuery(query.id, { text: '✏️ Режим редактирования' });
          return NextResponse.json({ ok: true });
        }
        
        // === ОТМЕНА РЕДАКТИРОВАНИЯ ===
        if (data === 'cancel_edit') {
          const state = userStates.get(chatId) || {};
          state.waitingForEdit = false;
          userStates.set(chatId, state);
          await telegramBot.sendMessage(chatId, '❌ Редактирование отменено.');
          await telegramBot.answerCallbackQuery(query.id);
          return NextResponse.json({ ok: true });
        }
        
        // === СКОПИРОВАТЬ ===
        if (data === 'copy_task') {
          const state = userStates.get(chatId) || {};
          if (state.lastGeneratedTask) {
            await telegramBot.sendMessage(chatId, '📋 Скопируйте текст ниже:\n\n' + state.lastGeneratedTask);
            await telegramBot.answerCallbackQuery(query.id, { text: '📋 Текст отправлен' });
          } else {
            await telegramBot.answerCallbackQuery(query.id, { text: '❌ Задача не найдена' });
          }
          return NextResponse.json({ ok: true });
        }
        
        // === ПРИНЯТЬ ВСЕ ПРЕДЛОЖЕНИЯ ===
        if (data === 'accept_all_suggestions') {
          const state = userStates.get(chatId) || {};
          if (state.suggestedAnswers && state.userText && state.selectedTeam) {
            await telegramBot.sendChatAction(chatId, 'typing');
            
            const answers = state.suggestedAnswers.map((item: any) => item.suggestedAnswer);
            const questionsWithAnswers = state.questions
              .map((q: string, i: number) => `${q}: ${answers[i]}`)
              .join('\n\n');
            
            state.waitingForAnswerConfirmation = false;
            state.waitingForAllAnswers = false;
            userStates.set(chatId, state);
            
            await telegramBot.sendMessage(chatId, '⏳ Генерирую задачу...');
            
            const { generateAndSendTask } = await import('@/lib/telegram');
            await generateAndSendTask(state.userText, state.selectedTeam, questionsWithAnswers, chatId, telegramBot, userStates);
          }
          await telegramBot.answerCallbackQuery(query.id);
          return NextResponse.json({ ok: true });
        }
        
        // === ПРИНЯТЬ ОДНО ПРЕДЛОЖЕНИЕ ===
        if (data === 'accept_suggestion') {
          const state = userStates.get(chatId) || {};
          if (state.waitingForAnswer && state.currentQuestionIndex !== undefined && state.suggestedAnswers) {
            await telegramBot.sendChatAction(chatId, 'typing');
            
            const answers = state.answers || [];
            answers[state.currentQuestionIndex] = state.suggestedAnswers[state.currentQuestionIndex].suggestedAnswer;
            state.answers = answers;
            state.currentQuestionIndex++;
            
            if (state.currentQuestionIndex < state.questions.length) {
              const next = state.suggestedAnswers[state.currentQuestionIndex];
              await telegramBot.sendMessage(
                chatId,
                `Вопрос ${state.currentQuestionIndex + 1} из ${state.questions.length}:\n\n` +
                `❓ ${next.question}\n\n💡 Предложение: ${next.suggestedAnswer}`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '✅ Принять', callback_data: 'accept_suggestion' }],
                      [{ text: '⏭ Пропустить', callback_data: 'skip_question' }],
                      [{ text: '🆕 Новая задача', callback_data: 'new_task' }]
                    ]
                  }
                }
              );
            } else {
              state.waitingForAnswer = false;
              const questionsWithAnswers = state.questions
                .map((q: string, i: number) => `${q}: ${answers[i]}`)
                .join('\n\n');
              
              await telegramBot.sendMessage(chatId, '⏳ Генерирую задачу...');
              const { generateAndSendTask } = await import('@/lib/telegram');
              await generateAndSendTask(state.userText, state.selectedTeam, questionsWithAnswers, chatId, telegramBot, userStates);
            }
            userStates.set(chatId, state);
          }
          await telegramBot.answerCallbackQuery(query.id);
          return NextResponse.json({ ok: true });
        }
        
        // === ПРОПУСТИТЬ ВОПРОС ===
        if (data === 'skip_question') {
          const state = userStates.get(chatId) || {};
          if (state.waitingForAnswer && state.currentQuestionIndex !== undefined) {
            const answers = state.answers || [];
            answers[state.currentQuestionIndex] = '[не указано]';
            state.answers = answers;
            state.currentQuestionIndex++;
            
            if (state.currentQuestionIndex < state.questions.length) {
              const next = state.suggestedAnswers?.[state.currentQuestionIndex] || { question: state.questions[state.currentQuestionIndex], suggestedAnswer: '' };
              await telegramBot.sendMessage(
                chatId,
                `Вопрос ${state.currentQuestionIndex + 1} из ${state.questions.length}:\n\n` +
                `❓ ${next.question}\n\n💡 Предложение: ${next.suggestedAnswer}`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '✅ Принять', callback_data: 'accept_suggestion' }],
                      [{ text: '⏭ Пропустить', callback_data: 'skip_question' }],
                      [{ text: '🆕 Новая задача', callback_data: 'new_task' }]
                    ]
                  }
                }
              );
            } else {
              state.waitingForAnswer = false;
              const questionsWithAnswers = state.questions
                .map((q: string, i: number) => `${q}: ${answers[i]}`)
                .join('\n\n');
              
              await telegramBot.sendMessage(chatId, '⏳ Генерирую задачу...');
              const { generateAndSendTask } = await import('@/lib/telegram');
              await generateAndSendTask(state.userText, state.selectedTeam, questionsWithAnswers, chatId, telegramBot, userStates);
            }
            userStates.set(chatId, state);
          }
          await telegramBot.answerCallbackQuery(query.id);
          return NextResponse.json({ ok: true });
        }
        
        // === ПРОПУСТИТЬ ВСЕ ВОПРОСЫ ===
        if (data === 'skip_all_questions') {
          const state = userStates.get(chatId) || {};
          if (state.userText && state.selectedTeam) {
            await telegramBot.sendChatAction(chatId, 'typing');
            
            state.waitingForAllAnswers = false;
            state.waitingForAnswerConfirmation = false;
            userStates.set(chatId, state);
            
            await telegramBot.sendMessage(chatId, '⏳ Генерирую задачу без дополнительных ответов...');
            
            const { generateAndSendTask } = await import('@/lib/telegram');
            await generateAndSendTask(state.userText, state.selectedTeam, undefined, chatId, telegramBot, userStates);
          }
          await telegramBot.answerCallbackQuery(query.id);
          return NextResponse.json({ ok: true });
        }
        
        // === ВЫБОР КОМАНДЫ ===
        if (data?.startsWith('team_')) {
          const teamId = data.replace('team_', '');
          const state = userStates.get(chatId) || {};
          
          await telegramBot.sendChatAction(chatId, 'typing');
          
          const { loadTemplates } = await import('@/lib/templates');
          const teams = loadTemplates();
          const team = teams.find((t: any) => t.id === teamId);
          
          if (team && state.userText) {
            const selectedTeam = team.subtypes?.length > 0
              ? { teamId: team.id, subtypeId: team.subtypes[0].id }
              : { teamId: team.id };
            
            state.selectedTeam = selectedTeam;
            userStates.set(chatId, state);
            
            const { processTask } = await import('@/lib/telegram');
            await processTask(state.userText, selectedTeam, chatId, telegramBot, userStates);
          }
          await telegramBot.answerCallbackQuery(query.id);
          return NextResponse.json({ ok: true });
        }
        
        // === ПОКАЗАТЬ КОМАНДЫ ===
        if (data === 'show_teams') {
          const { loadTemplates } = await import('@/lib/templates');
          const teams = loadTemplates();
          const list = teams.map((t: any) => `• ${t.name}`).join('\n');
          await telegramBot.sendMessage(chatId, `📋 Команды:\n\n${list}`);
          await telegramBot.answerCallbackQuery(query.id);
          return NextResponse.json({ ok: true });
        }
        
        // Неизвестная команда
        console.log('Неизвестный callback:', data);
        await telegramBot.answerCallbackQuery(query.id);
        
      } catch (error) {
        console.error('Ошибка обработки callback:', error);
        await telegramBot.answerCallbackQuery(query.id, { text: '❌ Ошибка' });
      }
      
      return NextResponse.json({ ok: true });
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

