// Работа с OpenRouter API
// На сервере: прямой вызов к OpenRouter API
// На клиенте: через API route /api/openrouter

import { getProjectContext } from './projectContext';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-001';
const API_ROUTE = '/api/openrouter';

const SYSTEM_PROMPT = `Ты — помощник по созданию задач для Jira. 

КРИТИЧЕСКИ ВАЖНО при заполнении раздела "Контекст" или "Проблема":
1. Используй ТОЛЬКО информацию из описания пользователя
2. НЕ придумывай детали, которых нет в описании
3. Формулируй кратко и по существу
4. Если пользователь сказал "выгрузить данные за 2025 год" — напиши именно это
5. Сохраняй терминологию пользователя (названия метрик, платформ, сервисов)

Формат JTBD для проблемы:
"Когда [конкретная ситуация из описания], я хочу [конкретное действие], чтобы [конкретный результат]"

НЕ ДЕЛАЙ:
- Не добавляй "улучшение пользовательского опыта" если об этом не сказано
- Не обобщай конкретные данные
- Не меняй формулировки пользователя на "более красивые"

Правила написания текста:
1. Пиши просто и понятно, как Максим Ильяхов
2. Избегай канцелярита, штампов и воды
3. Не придумывай названия сервисов, таблиц, метрик — если они не упомянуты явно
4. Используй короткие предложения
5. Каждый пункт — одна мысль
6. Если чего-то не знаешь из контекста — оставь плейсхолдер [уточнить: что именно]

ВАЖНО: 
- Если в дополнительной информации указано '[не указано]' — оставь в шаблоне плейсхолдер [уточнить] или прочерк, НЕ придумывай значения.
- Не выдумывай названия сервисов, таблиц, метрик.
- Если информации нет — честно оставь пустым или напиши [требует уточнения].

Формат ответа:
- Используй заголовки с ## для разделов
- Используй маркированные списки где уместно
- Не добавляй лишних разделов, которых нет в шаблоне`;

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Определить команду и подтип из текста
export async function detectTeam(
  userText: string,
  availableTeams: Array<{ id: string; name: string; subtypes?: Array<{ id: string; name: string }> }>
): Promise<{ teamId: string; subtypeId?: string } | null> {

  const teamsList = availableTeams.map(team => {
    const subtypes = team.subtypes?.map(s => `  - ${s.name} (${s.id})`).join('\n') || '';
    return `- ${team.name} (${team.id})${subtypes ? '\n' + subtypes : ''}`;
  }).join('\n');

  const prompt = `
${getProjectContext()}

Проанализируй следующий текст и определи, какая команда и подтип задачи подходят лучше всего.

Доступные команды:
${teamsList}

Текст пользователя: "${userText}"

Правила определения:
1. Если упоминается "выгрузка", "выгрузить" → analytics/export
2. Если упоминается "дашборд", "отчёт" → analytics/dashboard
3. Если упоминается "АБ-тест", "эксперимент" → analytics/ab_design
4. Если упоминается "проанализировать", "исследовать данные" → analytics/research
5. Если упоминается "разметить", "категоризация" → experts
6. Если упоминается "макет", "дизайн экрана" → design
7. Если упоминается "реализовать", "добавить", "исправить баг" → development/task

Ответь ТОЛЬКО в формате JSON:
{
  "teamId": "id_команды",
  "subtypeId": "id_подтипа или null"
}
`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const isServer = typeof window === 'undefined' && apiKey;

    let response: Response;

    if (isServer) {
      // Прямой вызов OpenRouter API на сервере
      console.log('Запрос к OpenRouter API напрямую (detectTeam)');
      
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
          'X-Title': 'Jira Task Creator',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } else {
      // Через API route на клиенте
      console.log('Запрос к серверному API route (detectTeam)');
      
      response = await fetch(API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'detectTeam',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Не удалось прочитать ответ' }));
      console.error('API ошибка при определении команды:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData,
      });
      throw new Error(`API ошибка: ${response.status} ${response.statusText}. ${errorData.error || errorData.details || 'Неизвестная ошибка'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.error('Пустой ответ от API при определении команды:', data);
      throw new Error('Пустой ответ от API');
    }

    // Парсим JSON из ответа
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        if (result.teamId && result.teamId !== 'null') {
          return {
            teamId: result.teamId,
            subtypeId: result.subtypeId && result.subtypeId !== 'null' ? result.subtypeId : undefined,
          };
        }
      } catch (parseError) {
        console.error('Ошибка парсинга JSON при определении команды:', {
          content,
          parseError,
        });
        throw new Error('Не удалось распарсить ответ от API');
      }
    }

    return null;
  } catch (error: any) {
    console.error('Ошибка при определении команды:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
    throw error;
  }
}

// Проверить достаточность информации и задать вопросы
export async function checkInformationAndAskQuestions(
  userText: string,
  template: string
): Promise<{ sufficient: boolean; questions?: string[]; totalQuestions?: number }> {

  const prompt = `Проверь, достаточно ли информации в следующем тексте для заполнения шаблона задачи.

Текст пользователя: "${userText}"

Шаблон задачи:
${template}

Ответь в формате JSON:
{
  "sufficient": true/false,
  "questions": ["вопрос 1", "вопрос 2", ...] (только если sufficient = false),
  "totalQuestions": 5 (количество вопросов, только если sufficient = false)
}

ВАЖНО:
- Если информации недостаточно, верни ВСЕ вопросы сразу (не по одному)
- Максимум 7 вопросов. Если нужно больше — объедини похожие вопросы
- Каждый вопрос должен быть коротким и конкретным (не больше 10 слов)
- Вопросы должны быть понятными и требовать конкретного ответа
- Если информации достаточно, верни sufficient: true и пустой массив questions`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const isServer = typeof window === 'undefined' && apiKey;

    let response: Response;

    if (isServer) {
      // Прямой вызов OpenRouter API на сервере
      console.log('Запрос к OpenRouter API напрямую (checkInformationAndAskQuestions)');
      
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
          'X-Title': 'Jira Task Creator',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } else {
      // Через API route на клиенте
      console.log('Запрос к серверному API route (checkInformationAndAskQuestions)');
      
      response = await fetch(API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'checkInformationAndAskQuestions',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Не удалось прочитать ответ' }));
      console.error('API ошибка при проверке информации:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData,
      });
      throw new Error(`API ошибка: ${response.status} ${response.statusText}. ${errorData.error || errorData.details || 'Неизвестная ошибка'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.error('Пустой ответ от API при проверке информации:', data);
      throw new Error('Пустой ответ от API');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        const questions = result.questions || [];
        // Ограничиваем количество вопросов до 7
        const limitedQuestions = questions.slice(0, 7);
        return {
          sufficient: result.sufficient === true,
          questions: limitedQuestions,
          totalQuestions: limitedQuestions.length,
        };
      } catch (parseError) {
        console.error('Ошибка парсинга JSON при проверке информации:', {
          content,
          parseError,
        });
        throw new Error('Не удалось распарсить ответ от API');
      }
    }

    return { sufficient: true, questions: [], totalQuestions: 0 };
  } catch (error: any) {
    console.error('Ошибка при проверке информации:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
    throw error;
  }
}

// Сгенерировать задачу по шаблону
export async function generateTask(
  userText: string,
  template: string,
  additionalInfo?: string
): Promise<string> {

  const fullText = additionalInfo 
    ? `${userText}\n\nДополнительная информация:\n${additionalInfo}`
    : userText;

  const prompt = `Создай задачу для Jira на основе следующего описания, заполнив шаблон.

Описание от пользователя:
${fullText}

Шаблон задачи:
${template}

Заполни шаблон, используя информацию из описания. Если какой-то информации нет, оставь плейсхолдер [уточнить: что именно].`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const isServer = typeof window === 'undefined' && apiKey;

    let response: Response;

    if (isServer) {
      // Прямой вызов OpenRouter API на сервере
      console.log('Запрос к OpenRouter API напрямую (generateTask)');
      
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
          'X-Title': 'Jira Task Creator',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });
    } else {
      // Через API route на клиенте
      console.log('Запрос к серверному API route (generateTask)');
      
      response = await fetch(API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateTask',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Не удалось прочитать ответ' }));
      console.error('API ошибка при генерации задачи:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData,
      });
      throw new Error(`API ошибка: ${response.status} ${response.statusText}. ${errorData.error || errorData.details || 'Неизвестная ошибка'}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) {
      console.error('Пустой ответ от API при генерации задачи:', data);
      throw new Error('Пустой ответ от API');
    }

    return content;
  } catch (error: any) {
    console.error('Ошибка при генерации задачи:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
    throw error;
  }
}

// Редактирование задачи
export async function editTask(
  currentTask: string,
  editInstructions: string,
  currentTeamId: string,
  currentSubtypeId?: string
): Promise<{ editedTask: string; newTeamId?: string; newSubtypeId?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('API ключ не настроен');
  }

  const prompt = `Ты помощник по редактированию задач для Jira.

Текущая задача:
\`\`\`
${currentTask}
\`\`\`

Текущая команда: ${currentTeamId}${currentSubtypeId ? ` / ${currentSubtypeId}` : ''}

Инструкция пользователя по редактированию:
"${editInstructions}"

Возможные типы правок:
- Добавить информацию в раздел
- Удалить раздел или пункт
- Изменить платформу (iOS, Android, Backend, Desktop)
- Переформулировать текст
- Изменить команду или тип задачи
- Исправить опечатки
- Уточнить критерии приёмки
- Добавить/убрать метрики

Правила:
1. Внеси изменения согласно инструкции
2. Сохрани структуру и форматирование задачи
3. Если инструкция неясная — постарайся понять намерение и применить
4. Если нужно изменить команду/тип — укажи новые значения

Ответь в формате JSON:
{
  "editedTask": "полный текст отредактированной задачи",
  "newTeamId": "новый id команды или null если не изменился",
  "newSubtypeId": "новый id подтипа или null"
}

Только JSON, без пояснений.`;

  const isServer = typeof window === 'undefined' && apiKey;
  let response: Response;

  if (isServer) {
    // Прямой вызов OpenRouter API на сервере
    console.log('Запрос к OpenRouter API напрямую (editTask)');
    
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
        'X-Title': 'Task Creator',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
      }),
    });
  } else {
    // Через API route на клиенте
    console.log('Запрос к серверному API route (editTask)');
    
    response = await fetch(API_ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'editTask',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Не удалось прочитать ответ' }));
    console.error('API ошибка при редактировании задачи:', {
      status: response.status,
      statusText: response.statusText,
      body: errorData,
    });
    throw new Error(`API ошибка: ${response.status} ${response.statusText}. ${errorData.error || errorData.details || 'Неизвестная ошибка'}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    console.error('Пустой ответ от API при редактировании задачи:', data);
    throw new Error('Пустой ответ от API');
  }
  
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      return {
        editedTask: result.editedTask || currentTask,
        newTeamId: result.newTeamId && result.newTeamId !== 'null' ? result.newTeamId : undefined,
        newSubtypeId: result.newSubtypeId && result.newSubtypeId !== 'null' ? result.newSubtypeId : undefined,
      };
    } catch (parseError) {
      console.error('Ошибка парсинга JSON при редактировании:', parseError);
      throw new Error('Не удалось распарсить ответ от API');
    }
  }
  
  return { editedTask: currentTask };
}

// Генерация предложенных ответов на вопросы
export async function generateSuggestedAnswers(
  userText: string,
  template: string,
  questions: string[]
): Promise<{ question: string; suggestedAnswer: string }[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('API ключ не найден для generateSuggestedAnswers');
    return questions.map(q => ({ question: q, suggestedAnswer: '[не удалось предложить]' }));
  }

  console.log('=== Генерация предложенных ответов ===');
  console.log('Текст пользователя:', userText.substring(0, 100) + '...');
  console.log('Количество вопросов:', questions.length);

  const prompt = `Ты анализируешь описание задачи и ОБЯЗАТЕЛЬНО предлагаешь ответы на вопросы.

ОПИСАНИЕ ЗАДАЧИ:
"${userText}"

ВОПРОСЫ:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

ПРАВИЛА (СТРОГО СОБЛЮДАЙ):
1. ЗАПРЕЩЕНО писать "требует уточнения", "[требует уточнения]", "не указано" и подобное
2. ВСЕГДА предлагай конкретный ответ, даже если приходится делать разумное предположение
3. Если в описании есть прямой ответ — используй его ДОСЛОВНО
4. Если прямого ответа нет — ПРЕДПОЛОЖИ на основе контекста

ПРИМЕРЫ ПРАВИЛЬНЫХ ПРЕДЛОЖЕНИЙ:
- Вопрос "Какой срок?" → если не указан, предложи: "Текущий спринт" или "2 недели"
- Вопрос "Какие платформы?" → если не указаны, предложи: "Все платформы (iOS, Android, Web)"
- Вопрос "Кто ответственный?" → если не указан, предложи: "Определить с тимлидом"
- Вопрос "Какие метрики?" → предложи типичные: "Конверсия, DAU, время на странице"

ИЗВЛЕЧЕНИЕ ИЗ ТЕКСТА:
- "за 2025 год" → период: "Январь-Декабрь 2025"
- "Android, iOS и десктоп" → платформы: "Android, iOS, Desktop"
- "по месяцам" → группировка: "Помесячная разбивка"
- "для анализа влияния" → цель: "Анализ влияния продуктовых изменений"
- "Xat" → метрика: "Xat (текстовый поиск, поиск с аджестами, карточка айтема)"

Ответь ТОЛЬКО в JSON:
{
  "answers": [
    { "question": "вопрос", "suggestedAnswer": "КОНКРЕТНЫЙ ответ или предположение" }
  ]
}`;

  const isServer = typeof window === 'undefined' && apiKey;
  let response: Response;

  if (isServer) {
    // Прямой вызов OpenRouter API на сервере
    console.log('Запрос к OpenRouter API напрямую (generateSuggestedAnswers)');
    
    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
        'X-Title': 'Task Creator',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,  // Повышаем для более креативных предложений
      }),
    });
  } else {
    // Через API route на клиенте
    console.log('Запрос к серверному API route (generateSuggestedAnswers)');
    
    response = await fetch(API_ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generateSuggestedAnswers',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  }

  try {
    if (!response.ok) {
      console.error('Ошибка API:', response.status);
      return questions.map(q => ({ question: q, suggestedAnswer: 'Предложите ваш вариант' }));
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      
      // Проверяем и заменяем пустые/плохие ответы
      const cleanedAnswers = (result.answers || []).map((item: any, i: number) => {
        let answer = item.suggestedAnswer || '';
        
        // Заменяем плохие ответы на дефолтные
        const badPhrases = ['требует уточнения', 'не указано', 'неизвестно', 'не определено', '[', ']'];
        const hasBadPhrase = badPhrases.some(phrase => answer.toLowerCase().includes(phrase));
        
        if (!answer || hasBadPhrase) {
          answer = 'Предложите ваш вариант';
        }
        
        return {
          question: questions[i] || item.question,
          suggestedAnswer: answer
        };
      });
      
      return cleanedAnswers;
    }
    
    return questions.map(q => ({ question: q, suggestedAnswer: 'Предложите ваш вариант' }));
    
  } catch (error) {
    console.error('Ошибка generateSuggestedAnswers:', error);
    return questions.map(q => ({ question: q, suggestedAnswer: 'Предложите ваш вариант' }));
  }
}

