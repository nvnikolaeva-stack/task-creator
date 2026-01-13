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
      patterns: ['технический рисерч', 'тех рисерч', 'техрисерч'],
      team: { teamId: 'development', subtypeId: 'tech_research' }
    },
    {
      patterns: ['разработка', 'разраб', 'разрабы', 'разработку', 'таска', 'задача на разработку', 'задача разработка', 'девелопмент', 'бэкенд', 'фронтенд', 'backend', 'frontend'],
      team: { teamId: 'development', subtypeId: 'task' }
    },
    {
      patterns: ['выгрузка', 'выгрузку'],
      team: { teamId: 'analytics', subtypeId: 'export' }
    },
    {
      patterns: ['дашборд', 'дашборда', 'dashboard'],
      team: { teamId: 'analytics', subtypeId: 'dashboard' }
    },
    {
      patterns: ['аб тест', 'аб-тест', 'ab тест', 'ab-тест', 'сплит тест'],
      team: { teamId: 'analytics', subtypeId: 'ab_design' }
    },
    {
      patterns: ['аналитика', 'аналитик', 'аналитику', 'аналитике', 'рисерч', 'исследование данных'],
      team: { teamId: 'analytics', subtypeId: 'research' }
    },
    {
      patterns: ['дизайн', 'дизайну', 'дизайнер', 'дизайнеру', 'макет', 'макеты', 'дизу'],
      team: { teamId: 'design' }
    },
    {
      patterns: ['эксперт', 'экспертам', 'эксперту', 'экспертов', 'экспертная'],
      team: { teamId: 'experts' }
    },
    {
      patterns: ['юкс', 'ux', 'юх', 'ю экс', 'исследование пользователей', 'пользовательское исследование', 'usability'],
      team: { teamId: 'ux' }
    },
    {
      patterns: ['поиск', 'поиску', 'поиске', 'серч', 'search'],
      team: { teamId: 'search' }
    },
    {
      patterns: ['рекомендации', 'рекомендашки', 'рекам', 'рекомендациям', 'recommendations'],
      team: { teamId: 'recommendations' }
    },
  ];

  // Проверяем первые 150 символов
  const firstPart = lowerText.substring(0, 150);
  
  for (const { patterns, team } of keywords) {
    for (const pattern of patterns) {
      if (firstPart.includes(pattern)) {
        return team;
      }
    }
  }

  return null;
}

// Транскрибация голосового сообщения через Deepgram Nova-2
async function transcribeVoice(fileId: string, bot: TelegramBot, botToken: string): Promise<string> {
  console.log('=== Транскрибация через Deepgram ===');
  
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
  
  const audioResponse = await fetch(fileUrl);
  if (!audioResponse.ok) {
    throw new Error('Не удалось скачать аудио');
  }
  
  const audioBuffer = await audioResponse.arrayBuffer();
  
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey) {
    throw new Error('DEEPGRAM_API_KEY не настроен');
  }
  
  const response = await fetch(
    'https://api.deepgram.com/v1/listen?language=ru&model=nova-2&smart_format=true&punctuate=true',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'audio/ogg',
      },
      body: audioBuffer,
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Ошибка Deepgram:', error);
    throw new Error('Ошибка распознавания речи');
  }
  
  const result = await response.json();
  const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';
  
  console.log('Результат Deepgram:', transcript);
  return transcript;
}

// Постобработка транскрибации через LLM для исправления ошибок и определения команды
// ЗАКОММЕНТИРОВАНО: убрана LLM постобработка, используется только Whisper
/*
async function postProcessTranscription(rawText: string): Promise<{ correctedText: string; detectedTeam: string | null }> {
  console.log('=== Постобработка текста через LLM ===');
  
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { correctedText: rawText, detectedTeam: null };
  }
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://task-creator.vercel.app',
        'X-Title': 'Task Creator Bot',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4',
        messages: [{
          role: 'user',
          content: `Ты помощник для исправления ошибок распознавания речи.

Исходный текст (распознанная речь): "${rawText}"

Задачи:
1. Исправь очевидные ошибки распознавания
2. Определи команду, на которую ставится задача

Возможные команды:
- разработка (синонимы: разраб, разрабы, девелопмент, таска)
- дизайн (синонимы: дизу, дизайнер, макет)
- аналитика (синонимы: аналитик, аналитику, данные)
- эксперты (синонимы: экспертам, эксперту)
- ux (синонимы: юкс, исследование, ресерч пользователей)
- поиск (синонимы: поиску, серч)
- рекомендации (синонимы: рекомендашки, рекам)

Ответь ТОЛЬКО в формате JSON:
{
  "correctedText": "исправленный текст",
  "detectedTeam": "id команды или null"
}

Без дополнительных пояснений, только JSON.`
        }],
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      console.error('Ошибка LLM постобработки');
      return { correctedText: rawText, detectedTeam: null };
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // Парсим JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log('Результат постобработки:', result);
      return {
        correctedText: result.correctedText || rawText,
        detectedTeam: result.detectedTeam || null,
      };
    }
    
    return { correctedText: rawText, detectedTeam: null };
  } catch (error) {
    console.error('Ошибка постобработки:', error);
    return { correctedText: rawText, detectedTeam: null };
  }
}
*/

// Парсинг ответов из одного сообщения (для голосового режима)
function parseAnswersFromText(text: string, questionCount: number): string[] {
  const answers: string[] = [];
  
  // Пробуем разбить по номерам "1.", "2." и т.д.
  const parts = text.split(/\d+[\.\)]\s*/);
  
  if (parts.length > 1) {
    // Убираем пустой первый элемент
    for (let i = 1; i < parts.length && answers.length < questionCount; i++) {
      const answer = parts[i].trim();
      answers.push(normalizeAnswer(answer));
    }
  } else {
    // Пробуем разбить по переносам строк
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (answers.length < questionCount) {
        answers.push(normalizeAnswer(line.trim()));
      }
    }
  }
  
  // Дополняем недостающие ответы
  while (answers.length < questionCount) {
    answers.push('[не указано]');
  }
  
  return answers;
}

// Нормализация ответа (обработка "не знаю" и т.д.)
function normalizeAnswer(answer: string): string {
  const skipPhrases = ['не знаю', 'незнаю', '-', 'пропустить', 'skip', 'нет', 'хз', 'без понятия'];
  if (skipPhrases.some(phrase => answer.toLowerCase().includes(phrase))) {
    return '[не указано]';
  }
  return answer;
}

// Обработка текстового сообщения
export async function handleTextMessage(
  text: string,
  chatId: number,
  bot: TelegramBot,
  userState: Map<number, any>
): Promise<void> {
  const state = userState.get(chatId) || {};
  state.isVoiceInput = false; // Текстовый режим
  userState.set(chatId, state);

  // Если ожидается редактирование задачи
  if (state.waitingForEdit && state.lastGeneratedTask) {
    await bot.sendMessage(chatId, '✏️ Редактирую задачу...');
    
    try {
      const { editTask } = await import('./openrouter');
      const result = await editTask(
        state.lastGeneratedTask,
        text,
        state.selectedTeam?.teamId || '',
        state.selectedTeam?.subtypeId
      );
      
      state.lastGeneratedTask = result.editedTask;
      state.waitingForEdit = false;
      
      // Обновляем команду если изменилась
      if (result.newTeamId) {
        state.selectedTeam = {
          teamId: result.newTeamId,
          subtypeId: result.newSubtypeId,
        };
      }
      
      userState.set(chatId, state);
      
      // Отправляем обновлённую задачу
      await bot.sendMessage(chatId, `📋 Обновлённая задача:\n\n\`\`\`\n${result.editedTask}\n\`\`\``, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📋 Скопировать', callback_data: 'copy_task' },
              { text: '✏️ Редактировать', callback_data: 'edit_task' }
            ]
          ]
        }
      });
    } catch (error: any) {
      console.error('Ошибка редактирования:', error);
      await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
    }
    return;
  }

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

  // Если ожидается ответ на все вопросы (голосовой режим)
  if (state.waitingForAllAnswers) {
    // Парсим ответы из одного сообщения
    const answers = parseAnswersFromText(text, state.questions.length);
    state.answers = answers;
    state.waitingForAllAnswers = false;
    userState.set(chatId, state);
    
    const allAnswers = answers.join('\n\n');
    await generateAndSendTask(state.userText, state.selectedTeam, allAnswers, chatId, bot, userState);
    return;
  }

  // Если ожидается ответ на уточняющий вопрос (текстовый режим)
  if (state.waitingForAnswer && state.currentQuestionIndex !== undefined) {
    const answers = state.answers || [];
    
    // Проверяем на "не знаю", "незнаю", "-", "пропустить"
    const skipPhrases = ['не знаю', 'незнаю', '-', 'пропустить', 'skip', 'пропуск', 'нет ответа'];
    const isSkip = skipPhrases.some(phrase => text.toLowerCase().trim() === phrase);
    
    if (isSkip) {
      answers[state.currentQuestionIndex] = '[не указано]';
    } else {
      answers[state.currentQuestionIndex] = text;
    }
    
    state.answers = answers;
    state.currentQuestionIndex++;

    if (state.currentQuestionIndex < state.questions.length) {
      // Следующий вопрос
      await bot.sendMessage(
        chatId,
        `Вопрос ${state.currentQuestionIndex + 1} из ${state.questions.length}:\n\n${state.questions[state.currentQuestionIndex]}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '⏭ Пропустить', callback_data: 'skip_question' }
            ]]
          }
        }
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
    let state = userState.get(chatId) || {};
    
    // Если ожидается ответ на все вопросы (голосовой режим)
    if (state.waitingForAllAnswers) {
      await bot.sendMessage(chatId, '🎤 Распознаю ответы...');
      
      const transcribedText = await transcribeVoice(fileId, bot, botToken);
      
      if (!transcribedText || transcribedText.trim().length === 0) {
        await bot.sendMessage(chatId, '❌ Не удалось распознать речь. Попробуйте говорить чётче или отправьте текстом.');
        return;
      }
      
      // Обрабатываем как текстовое сообщение БЕЗ постобработки
      await handleTextMessage(transcribedText, chatId, bot, userState);
      return;
    }
    
    await bot.sendMessage(chatId, '🎤 Распознаю голос...');
    
    // Транскрибируем через Deepgram
    const transcribedText = await transcribeVoice(fileId, bot, botToken);
    
    if (!transcribedText || transcribedText.trim().length === 0) {
      await bot.sendMessage(chatId, '❌ Не удалось распознать речь. Попробуйте говорить чётче или отправьте текстом.');
      return;
    }
    
    // Проверяем, ожидается ли редактирование
    state = userState.get(chatId) || {};
    
    if (state.waitingForEdit && state.lastGeneratedTask) {
      await bot.sendMessage(chatId, `📝 Распознано: "${transcribedText}"\n\n✏️ Редактирую задачу...`);
      
      try {
        const { editTask } = await import('./openrouter');
        const result = await editTask(
          state.lastGeneratedTask,
          transcribedText,
          state.selectedTeam?.teamId || '',
          state.selectedTeam?.subtypeId
        );
        
        state.lastGeneratedTask = result.editedTask;
        state.waitingForEdit = false;
        
        if (result.newTeamId) {
          state.selectedTeam = {
            teamId: result.newTeamId,
            subtypeId: result.newSubtypeId,
          };
        }
        
        userState.set(chatId, state);
        
        await bot.sendMessage(chatId, `📋 Обновлённая задача:\n\n\`\`\`\n${result.editedTask}\n\`\`\``, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📋 Скопировать', callback_data: 'copy_task' },
                { text: '✏️ Редактировать', callback_data: 'edit_task' }
              ]
            ]
          }
        });
      } catch (error: any) {
        console.error('Ошибка редактирования:', error);
        await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
      }
      return;
    }
    
    // Показываем распознанный текст БЕЗ постобработки
    await bot.sendMessage(chatId, `📝 Распознано:\n"${transcribedText}"`);
    
    // Устанавливаем флаг голосового ввода
    state.isVoiceInput = true;
    state.userText = transcribedText;
    userState.set(chatId, state);
    
    // Определяем команду из текста напрямую
    let detectedTeam = detectTeamFromText(transcribedText);
    
    if (!detectedTeam) {
      // Пробуем через LLM только для определения команды
      try {
        const teams = loadTemplates();
        detectedTeam = await detectTeam(transcribedText, teams);
      } catch (error) {
        console.error('Ошибка определения команды:', error);
      }
    }
    
    if (detectedTeam) {
      state.selectedTeam = detectedTeam;
      userState.set(chatId, state);
      await processTask(transcribedText, detectedTeam, chatId, bot, userState);
    } else {
      // Команда не определена — показываем кнопки выбора
      const teams = loadTemplates();
      await bot.sendMessage(
        chatId,
        '❓ Не удалось определить команду. Выберите:',
        {
          reply_markup: {
            inline_keyboard: teams.map(team => [{
              text: team.name,
              callback_data: `team_${team.id}`
            }])
          }
        }
      );
      state.waitingForTeam = true;
      userState.set(chatId, state);
    }
    
  } catch (error: any) {
    console.error('Ошибка обработки голоса:', error);
    await bot.sendMessage(chatId, `❌ Ошибка: ${error.message}\n\nПопробуйте отправить текстом.`);
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
      
      // Определяем режим ввода (голос или текст)
      const isVoiceMode = state.isVoiceInput === true;
      
      if (isVoiceMode) {
        // Голосовой режим — все вопросы сразу
        const questionsList = checkResult.questions
          .map((q, i) => `${i + 1}. ${q}`)
          .join('\n');
        
        await bot.sendMessage(
          chatId,
          `📝 Нужны уточнения (${checkResult.questions.length} вопросов):\n\n${questionsList}\n\n🎤 Запишите голосовое сообщение с ответами на все вопросы по порядку.\n\nИли напишите "не знаю" / "-" для пунктов, которые неизвестны.`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '⏭ Пропустить все вопросы', callback_data: 'skip_all_questions' }
              ]]
            }
          }
        );
        
        state.waitingForAllAnswers = true;
        state.questions = checkResult.questions;
        state.userText = text;
        state.selectedTeam = team;
        userState.set(chatId, state);
      } else {
        // Текстовый режим — по одному вопросу
        state.waitingForAnswer = true;
        state.currentQuestionIndex = 0;
        state.questions = checkResult.questions;
        state.answers = [];
        state.userText = text;
        state.selectedTeam = team;
        userState.set(chatId, state);

        await bot.sendMessage(
          chatId,
          `Нужны уточнения (${checkResult.questions.length} вопросов):\n\nВопрос 1 из ${checkResult.questions.length}:\n\n${checkResult.questions[0]}`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '⏭ Пропустить', callback_data: 'skip_question' }
              ]]
            }
          }
        );
      }
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

    // Сохраняем задачу в state для возможности редактирования
    const state = userState.get(chatId) || {};
    state.lastGeneratedTask = task;
    state.selectedTeam = team;
    userState.set(chatId, state);
    
    // Отправляем задачу с кнопками редактирования
    await bot.sendMessage(chatId, `📋 Готовая задача:\n\n\`\`\`\n${task}\n\`\`\``, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 Скопировать', callback_data: 'copy_task' },
            { text: '✏️ Редактировать', callback_data: 'edit_task' }
          ]
        ]
      }
    });
    
    // НЕ очищаем state полностью, только флаги вопросов
    state.waitingForAnswer = false;
    state.waitingForAllAnswers = false;
    state.questions = undefined;
    state.answers = undefined;
    userState.set(chatId, state);
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
    } else if (query.data === 'skip_question') {
      // Пропустить текущий вопрос (текстовый режим)
      const state = userState.get(chatId) || {};
      if (state.waitingForAnswer && state.currentQuestionIndex !== undefined) {
        const answers = state.answers || [];
        answers[state.currentQuestionIndex] = '[не указано]';
        state.answers = answers;
        state.currentQuestionIndex++;
        
        if (state.currentQuestionIndex < state.questions.length) {
          await bot.sendMessage(
            chatId,
            `Вопрос ${state.currentQuestionIndex + 1} из ${state.questions.length}:\n\n${state.questions[state.currentQuestionIndex]}`,
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: '⏭ Пропустить', callback_data: 'skip_question' }
                ]]
              }
            }
          );
        } else {
          state.waitingForAnswer = false;
          const allAnswers = answers.join('\n\n');
          await generateAndSendTask(state.userText, state.selectedTeam, allAnswers, chatId, bot, userState);
        }
        userState.set(chatId, state);
      }
      await bot.answerCallbackQuery(query.id);
      return;
    } else if (query.data === 'skip_all_questions') {
      // Пропустить все вопросы (голосовой режим)
      const state = userState.get(chatId) || {};
      state.waitingForAllAnswers = false;
      const answers = state.questions.map(() => '[не указано]');
      await generateAndSendTask(state.userText, state.selectedTeam, answers.join('\n\n'), chatId, bot, userState);
      await bot.answerCallbackQuery(query.id);
      return;
    } else if (query.data === 'copy_task' || query.data?.startsWith('copy_')) {
      await bot.answerCallbackQuery(query.id, { text: 'Задача скопирована в буфер обмена!' });
    } else if (query.data === 'edit_task') {
      const state = userState.get(chatId) || {};
      state.waitingForEdit = true;
      userState.set(chatId, state);
      
      await bot.sendMessage(
        chatId,
        '✏️ Опишите изменения голосом или текстом.\n\nПримеры:\n• "Добавь в критерии приёмки пункт про тестирование"\n• "Убери раздел про метрики"\n• "Измени платформу на iOS"\n• "Переформулируй проблему короче"\n• "Измени команду на дизайн"',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '❌ Отмена', callback_data: 'cancel_edit' }
            ]]
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
      return;
    } else if (query.data === 'cancel_edit') {
      const state = userState.get(chatId) || {};
      state.waitingForEdit = false;
      userState.set(chatId, state);
      await bot.sendMessage(chatId, 'Редактирование отменено.');
      await bot.answerCallbackQuery(query.id);
      return;
    }
  });
}

