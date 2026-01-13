import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.0-flash-001';

export async function POST(request: NextRequest) {
  try {
    console.log('=== ОТЛАДКА API ===');
    console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'найден, длина: ' + process.env.OPENROUTER_API_KEY.length : 'НЕ НАЙДЕН');
    console.log('Все env переменные с OPENROUTER:', Object.keys(process.env).filter(k => k.includes('OPENROUTER')));
    
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY не настроен');
      return NextResponse.json(
        { error: 'API ключ не настроен на сервере' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, action } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Неверный формат запроса: требуется массив messages' },
        { status: 400 }
      );
    }

    console.log('Проксирование запроса к OpenRouter:', {
      action,
      messagesCount: messages.length,
      hasApiKey: !!apiKey,
    });

    // Отладка API ключа
    console.log('API Key первые 20 символов:', apiKey?.substring(0, 20));
    console.log('API Key последние 5 символов:', apiKey?.substring(apiKey.length - 5));

    // Формирование заголовков
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Jira Task Creator',
    };

    // Вывод headers с маскировкой ключа
    const maskedHeaders = {
      ...headers,
      'Authorization': headers.Authorization ? `Bearer ${headers.Authorization.substring(7, 27)}...${headers.Authorization.substring(headers.Authorization.length - 5)}` : 'не задан',
    };
    console.log('Заголовки запроса (с маскировкой ключа):', maskedHeaders);
    console.log('URL запроса:', OPENROUTER_API_URL);

    // Настройка таймаута для fetch (30 секунд)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: MODEL,
          messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Не удалось прочитать ответ');
        console.error('Ошибка OpenRouter API:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        
        return NextResponse.json(
          { 
            error: `OpenRouter API ошибка: ${response.status} ${response.statusText}`,
            details: errorText 
          },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Обработка ошибок соединения
      if (fetchError.name === 'AbortError' || fetchError.code === 'UND_ERR_CONNECT_TIMEOUT') {
        console.error('Таймаут соединения с OpenRouter:', fetchError);
        return NextResponse.json(
          { 
            error: 'Таймаут соединения с OpenRouter API. Проверьте интернет-соединение и попробуйте позже.',
            details: fetchError.message 
          },
          { status: 504 }
        );
      }
      
      if (fetchError.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
        console.error('Ошибка подключения к OpenRouter:', fetchError.cause);
        return NextResponse.json(
          { 
            error: 'Не удалось подключиться к OpenRouter API. Проверьте интернет-соединение.',
            details: fetchError.cause.message || fetchError.message 
          },
          { status: 503 }
        );
      }
      
      throw fetchError; // Пробрасываем другие ошибки дальше
    }

  } catch (error: any) {
    console.error('Ошибка в API route /api/openrouter:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
    
    return NextResponse.json(
      { 
        error: 'Внутренняя ошибка сервера',
        message: error?.message 
      },
      { status: 500 }
    );
  }
}

