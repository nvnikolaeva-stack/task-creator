import { NextRequest, NextResponse } from 'next/server';
import { generateTask, detectTeam } from '@/lib/openrouter';
import { getTeams, getTemplate } from '@/lib/templates';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Отправка сообщения в Telegram
async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    })
  });
}

// Обработчик webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;
    
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }
    
    const chatId = message.chat.id;
    const text = message.text;
    
    // Команда /start
    if (text === '/start') {
      await sendMessage(chatId, 
        '👋 Привет! Я помогу создать задачу для Jira.\n\n' +
        'Просто напиши описание задачи, начав с названия команды:\n' +
        '• Разработка\n• Дизайн\n• Аналитика\n• Эксперты\n• UX\n• Поиск\n• Рекомендации\n\n' +
        'Пример: "Разработка: нужно добавить кнопку сортировки"'
      );
      return NextResponse.json({ ok: true });
    }
    
    // Команда /help
    if (text === '/help') {
      await sendMessage(chatId,
        '📝 Как пользоваться:\n\n' +
        '1. Напиши название команды и описание задачи\n' +
        '2. Я задам уточняющие вопросы если нужно\n' +
        '3. Получишь готовую задачу для Jira\n\n' +
        'Команды: /start, /help, /teams'
      );
      return NextResponse.json({ ok: true });
    }
    
    // Команда /teams
    if (text === '/teams') {
      const teams = getTeams();
      const teamsList = teams.map(t => `• ${t.name}`).join('\n');
      await sendMessage(chatId, `📋 Доступные команды:\n\n${teamsList}`);
      return NextResponse.json({ ok: true });
    }
    
    // Обработка текста задачи
    await sendMessage(chatId, '⏳ Обрабатываю...');
    
    const teams = getTeams();
    const detected = await detectTeam(text, teams);
    
    if (!detected) {
      await sendMessage(chatId, 
        '❓ Не удалось определить команду.\n\n' +
        'Начни сообщение с названия команды, например:\n' +
        '"Разработка: нужно сделать..."'
      );
      return NextResponse.json({ ok: true });
    }
    
    const template = getTemplate(detected.teamId, detected.subtypeId);
    const task = await generateTask(text, template);
    
    const teamName = teams.find(t => t.id === detected.teamId)?.name || detected.teamId;
    
    await sendMessage(chatId, `✅ *Команда: ${teamName}*\n\n${task}`);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook is active' });
}
