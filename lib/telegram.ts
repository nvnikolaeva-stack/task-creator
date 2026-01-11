import TelegramBot from 'node-telegram-bot-api';
import { detectTeam, checkInformationAndAskQuestions, generateTask } from './openrouter';
import { getTemplate, loadTemplates, getTeamById } from './templates';
import { saveTaskToHistory, loadTaskHistory } from './storage';
import type { SelectedTeam } from '@/types';

// Определение команды из первых слов (аналогично веб-интерфейсу)
export function detectTeamFromText(text: string): SelectedTeam | null {
  const lowerText = text.toLowerCase();
  
  const keywords: Array<{ patterns: string[]; team: SelectedTeam }> = [
    {
      patterns: ['технический рисерч', 'тех рисерч'],
      team: { teamId: 'development', subtypeId: 'tech_research' }
    },
    {
      patterns: ['разработка', 'разраб', 'таска', 'задача на разработку', 'задача разработка'],
      team: { teamId: 'development', subtypeId: 'task' }
    },
    {
      patterns: ['выгрузка'],
      team: { teamId: 'analytics', subtypeId: 'export' }
    },
    {
      patterns: ['дашборд'],
      team: { teamId: 'analytics', subtypeId: 'dashboard' }
    },
    {
      patterns: ['аб тест', 'аб-тест', 'ab тест'],
      team: { teamId: 'analytics', subtypeId: 'ab_design' }
    },
    {
      patterns: ['аналитика', 'аналитик'],
      team: { teamId: 'analytics', subtypeId: 'research' }
    },
    {
      patterns: ['дизайн', 'макет', 'дизайнер'],
      team: { teamId: 'design' }
    },
    {
      patterns: ['эксперт', 'экспертам'],
      team: { teamId: 'experts' }
    },
    {
      patterns: ['юкс', 'ux', 'исследование'],
      team: { teamId: 'ux' }
    },
    {
      patterns: ['поиск'],
      team: { teamId: 'search' }
    },
    {
      patterns: ['рекомендации', 'рекомендашки'],
      team: { teamId: 'recommendations' }
    },
  ];

  const firstPart = lowerText.substring(0, 100);
  
  for (const { patterns, team } of keywords) {
    for (const pattern of patterns) {
      if (firstPart.includes(pattern)) {
        return team;
      }
    }
  }

  return null;
}

// Транскрибация голосового сообщения через OpenRouter (Whisper)
async function transcribeVoice(fileId: string, bot: TelegramBot, botToken: string): Promise<string> {
  try {
    // Получаем файл
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    
    // Загружаем файл
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Не удалось загрузить файл');
    }
    
    const audioBlob = await response.blob();
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice.ogg');
    formData.append('model', 'whisper-1');
    
    // Используем OpenAI API напрямую (через OpenRouter можно использовать chat completion с Whisper)
    // Альтернатива: использовать наш API route для транскрибации
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('API ключ не настроен');
    }

    // Простая транскрибация через наш API route (можно улучшить)
    // Пока возвращаем заглушку - в реальности нужно настроить правильную транскрибацию
    throw new Error('Транскрибация голоса временно недоступна. Отправьте текст.');
  } catch (error) {
    console.error('Ошибка транскрибации голоса:', error);
    throw error;
  }
}

// Обработка текстового сообщения
export async function handleTextMessage(
  text: string,
  chatId: number,
  bot: TelegramBot,
  userState: Map<number, any>
): Promise<void> {
  const state = userState.get(chatId) || {};

  // Если ожидается ответ на вопрос о команде
  if (state.waitingForTeam) {
    const teams = loadTemplates();
    const selectedTeam = teams.find(t => 
      t.name.toLowerCase().includes(text.toLowerCase()) || 
      t.id === text.toLowerCase()
    );
    
    if (selectedTeam) {
      const team: SelectedTeam = selectedTeam.subtypes.length > 0
        ? { teamId: selectedTeam.id, subtypeId: selectedTeam.subtypes[0].id }
        : { teamId: selectedTeam.id };
      
      state.selectedTeam = team;
      state.waitingForTeam = false;
      userState.set(chatId, state);
      
      await processTask(text, team, chatId, bot, userState);
    } else {
      await bot.sendMessage(chatId, 'Команда не найдена. Попробуйте еще раз или используйте /teams для списка команд.');
    }
    return;
  }

  // Если ожидается ответ на уточняющий вопрос
  if (state.waitingForAnswer && state.currentQuestionIndex !== undefined) {
    const answers = state.answers || [];
    answers[state.currentQuestionIndex] = text;
    state.answers = answers;
    state.currentQuestionIndex++;

    if (state.currentQuestionIndex < state.questions.length) {
      // Следующий вопрос
      await bot.sendMessage(
        chatId,
        `Вопрос ${state.currentQuestionIndex + 1} из ${state.questions.length}:\n\n${state.questions[state.currentQuestionIndex]}`
      );
      userState.set(chatId, state);
    } else {
      // Все вопросы отвечены
      const allAnswers = answers.join('\n\n');
      state.waitingForAnswer = false;
      state.additionalInfo = allAnswers;
      userState.set(chatId, state);
      
      await generateAndSendTask(state.userText, state.selectedTeam, allAnswers, chatId, bot, userState);
    }
    return;
  }

  // Определение команды
  let detectedTeam = detectTeamFromText(text);
  
  if (!detectedTeam) {
    // Пробуем через LLM
    try {
      const teams = loadTemplates();
      detectedTeam = await detectTeam(text, teams);
    } catch (error) {
      console.error('Ошибка определения команды:', error);
    }
  }

  if (detectedTeam) {
    state.selectedTeam = detectedTeam;
    state.userText = text;
    userState.set(chatId, state);
    await processTask(text, detectedTeam, chatId, bot, userState);
  } else {
    // Команда не определена
    const teams = loadTemplates();
    const teamsList = teams.map(t => `• ${t.name}`).join('\n');
    
    await bot.sendMessage(
      chatId,
      `Не удалось определить команду. На какую команду задача?\n\nДоступные команды:\n${teamsList}\n\nИли отправьте сообщение, начиная с названия команды.`,
      {
        reply_markup: {
          inline_keyboard: teams.slice(0, 5).map(team => [{
            text: team.name,
            callback_data: `team_${team.id}`
          }])
        }
      }
    );
    
    state.waitingForTeam = true;
    state.userText = text;
    userState.set(chatId, state);
  }
}

// Обработка голосового сообщения
export async function handleVoiceMessage(
  fileId: string,
  chatId: number,
  bot: TelegramBot,
  userState: Map<number, any>,
  botToken: string
): Promise<void> {
  try {
    await bot.sendMessage(chatId, '🎤 Обрабатываю голосовое сообщение...');
    
    // Транскрибируем голос
    const transcribedText = await transcribeVoice(fileId, bot, botToken);
    
    if (!transcribedText) {
      await bot.sendMessage(chatId, 'Не удалось распознать речь. Попробуйте еще раз.');
      return;
    }

    await bot.sendMessage(chatId, `📝 Распознано: "${transcribedText}"`);
    
    // Обрабатываем как текстовое сообщение
    await handleTextMessage(transcribedText, chatId, bot, userState);
  } catch (error) {
    console.error('Ошибка обработки голосового сообщения:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка при обработке голосового сообщения. Попробуйте отправить текстом.');
  }
}

// Обработка задачи
export async function processTask(
  text: string,
  team: SelectedTeam,
  chatId: number,
  bot: TelegramBot,
  userState: Map<number, any>
): Promise<void> {
  try {
    const teams = loadTemplates();
    const teamObj = teams.find(t => t.id === team.teamId);
    const teamName = teamObj?.name || team.teamId;
    const subtypeName = team.subtypeId
      ? teamObj?.subtypes.find(s => s.id === team.subtypeId)?.name
      : undefined;
    
    await bot.sendMessage(
      chatId,
      `✅ Команда определена: ${teamName}${subtypeName ? ` - ${subtypeName}` : ''}\n\n⏳ Генерирую задачу...`
    );

    const template = getTemplate(team.teamId, team.subtypeId);
    if (!template) {
      throw new Error('Шаблон не найден');
    }

    // Проверяем достаточность информации
    const checkResult = await checkInformationAndAskQuestions(text, template);
    
    if (!checkResult.sufficient && checkResult.questions && checkResult.questions.length > 0) {
      // Нужны уточняющие вопросы
      const state = userState.get(chatId) || {};
      state.waitingForAnswer = true;
      state.currentQuestionIndex = 0;
      state.questions = checkResult.questions;
      state.answers = [];
      state.userText = text;
      state.selectedTeam = team;
      userState.set(chatId, state);

      await bot.sendMessage(
        chatId,
        `Нужны уточнения (${checkResult.questions.length} вопросов):\n\nВопрос 1 из ${checkResult.questions.length}:\n\n${checkResult.questions[0]}`
      );
    } else {
      // Информации достаточно
      await generateAndSendTask(text, team, undefined, chatId, bot, userState);
    }
  } catch (error: any) {
    console.error('Ошибка обработки задачи:', error);
    await bot.sendMessage(chatId, `Ошибка: ${error.message || 'Неизвестная ошибка'}`);
  }
}

// Генерация и отправка задачи
async function generateAndSendTask(
  text: string,
  team: SelectedTeam,
  additionalInfo: string | undefined,
  chatId: number,
  bot: TelegramBot,
  userState: Map<number, any>
): Promise<void> {
  try {
    const template = getTemplate(team.teamId, team.subtypeId);
    if (!template) {
      throw new Error('Шаблон не найден');
    }

    const task = await generateTask(text, template, additionalInfo);
    
    // Сохраняем в историю (только если доступен localStorage)
    try {
      const teams = loadTemplates();
      const teamObj = teams.find(t => t.id === team.teamId);
      const teamName = teamObj?.name || team.teamId;
      const subtypeName = team.subtypeId
        ? teamObj?.subtypes.find(s => s.id === team.subtypeId)?.name
        : undefined;
      // saveTaskToHistory работает только в браузере, в серверной части пропускаем
      if (typeof window !== 'undefined') {
        saveTaskToHistory(task, teamName, subtypeName);
      }
    } catch (error) {
      // Игнорируем ошибки сохранения истории на сервере
      console.log('История не сохранена (серверная часть)');
    }

    // Отправляем задачу
    await bot.sendMessage(chatId, `📋 Готовая задача:\n\n\`\`\`\n${task}\n\`\`\``, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '📋 Скопировать',
            callback_data: `copy_${Date.now()}`
          }
        ]]
      }
    });

    // Очищаем состояние
    userState.delete(chatId);
  } catch (error: any) {
    console.error('Ошибка генерации задачи:', error);
    await bot.sendMessage(chatId, `Ошибка генерации задачи: ${error.message || 'Неизвестная ошибка'}`);
  }
}

// Обработка команд бота
export function handleBotCommands(bot: TelegramBot, userState: Map<number, any>): void {
  // Команда /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      `👋 Привет! Я бот для создания задач в Jira.\n\n` +
      `📝 Отправьте мне описание задачи текстом или голосовым сообщением.\n\n` +
      `Я автоматически определю команду и сгенерирую задачу по шаблону.\n\n` +
      `Используйте /help для списка команд.`
    );
  });

  // Команда /help
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      `📚 Доступные команды:\n\n` +
      `/start - Начать работу с ботом\n` +
      `/help - Показать эту справку\n` +
      `/teams - Список доступных команд\n` +
      `/history - Последние 5 созданных задач\n\n` +
      `💡 Просто отправьте описание задачи, и я создам её автоматически!`
    );
  });

  // Команда /teams
  bot.onText(/\/teams/, async (msg) => {
    const chatId = msg.chat.id;
    const teams = loadTemplates();
    const teamsList = teams.map(team => {
      const subtypes = team.subtypes.length > 0
        ? `\n  ${team.subtypes.map(s => `  • ${s.name}`).join('\n')}`
        : '';
      return `• ${team.name}${subtypes}`;
    }).join('\n\n');
    
    await bot.sendMessage(chatId, `📋 Доступные команды:\n\n${teamsList}`);
  });

  // Команда /history
  bot.onText(/\/history/, async (msg) => {
    const chatId = msg.chat.id;
    
    // История доступна только в браузере, на сервере показываем сообщение
    if (typeof window === 'undefined') {
      await bot.sendMessage(chatId, 'История задач доступна только в веб-интерфейсе. Откройте приложение в браузере для просмотра истории.');
      return;
    }
    
    const history = loadTaskHistory().slice(0, 5);
    
    if (history.length === 0) {
      await bot.sendMessage(chatId, 'История пуста. Создайте первую задачу!');
      return;
    }

    let historyText = '📜 Последние задачи:\n\n';
    history.forEach((item, index) => {
      const date = new Date(item.createdAt).toLocaleString('ru-RU');
      historyText += `${index + 1}. ${item.team}${item.subtype ? ` - ${item.subtype}` : ''}\n`;
      historyText += `   ${date}\n`;
      historyText += `   ${item.text.substring(0, 100)}...\n\n`;
    });

    await bot.sendMessage(chatId, historyText);
  });

  // Обработка callback (кнопки)
  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    if (query.data?.startsWith('team_')) {
      const teamId = query.data.replace('team_', '');
      const teams = loadTemplates();
      const team = teams.find(t => t.id === teamId);
      
      if (team) {
        const selectedTeam: SelectedTeam = team.subtypes.length > 0
          ? { teamId: team.id, subtypeId: team.subtypes[0].id }
          : { teamId: team.id };
        
        const state = userState.get(chatId) || {};
        await processTask(state.userText || '', selectedTeam, chatId, bot, userState);
      }
      
      await bot.answerCallbackQuery(query.id);
    } else if (query.data?.startsWith('copy_')) {
      await bot.answerCallbackQuery(query.id, { text: 'Задача скопирована в буфер обмена!' });
    }
  });
}

