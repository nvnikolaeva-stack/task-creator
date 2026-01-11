'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [botToken, setBotToken] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Загружаем сохранённые значения
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('telegram_bot_token');
      const savedSecret = localStorage.getItem('telegram_webhook_secret');
      if (savedToken) setBotToken(savedToken);
      if (savedSecret) setWebhookSecret(savedSecret);
      
      // Определяем URL для webhook
      const currentUrl = window.location.origin;
      setWebhookUrl(`${currentUrl}/api/telegram`);
    }
  }, []);

  const handleConnect = async () => {
    if (!botToken) {
      alert('Введите токен бота');
      return;
    }

    setLoading(true);
    try {
      // Проверяем токен через API Telegram
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();

      if (!data.ok) {
        throw new Error('Неверный токен бота');
      }

      // Сохраняем в localStorage
      localStorage.setItem('telegram_bot_token', botToken);
      if (webhookSecret) {
        localStorage.setItem('telegram_webhook_secret', webhookSecret);
      }

      // Настраиваем webhook
      const secretToken = webhookSecret || generateSecret();
      const webhookResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${secretToken}`
      );
      const webhookData = await webhookResponse.json();

      if (webhookData.ok) {
        setIsConnected(true);
        alert('Бот успешно подключен!');
      } else {
        throw new Error(webhookData.description || 'Ошибка настройки webhook');
      }
    } catch (error: any) {
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const generateSecret = (): string => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleDisconnect = async () => {
    if (!botToken) return;

    setLoading(true);
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`);
      setIsConnected(false);
      localStorage.removeItem('telegram_bot_token');
      localStorage.removeItem('telegram_webhook_secret');
      setBotToken('');
      setWebhookSecret('');
      alert('Бот отключен');
    } catch (error: any) {
      alert(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-text">Настройки Telegram бота</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-text mb-4">Подключение бота</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Токен бота (TELEGRAM_BOT_TOKEN)
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                           text-text"
              />
              <p className="text-xs text-gray-500 mt-1">
                Получите токен у @BotFather в Telegram
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Секретный токен webhook (TELEGRAM_WEBHOOK_SECRET)
              </label>
              <input
                type="text"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Случайная строка для безопасности"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent
                           text-text"
              />
              <button
                onClick={() => setWebhookSecret(generateSecret())}
                className="mt-2 text-sm text-accent hover:underline"
              >
                Сгенерировать случайный
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                URL webhook
              </label>
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg 
                           bg-gray-50 text-text"
              />
              <p className="text-xs text-gray-500 mt-1">
                Этот URL нужно указать в настройках webhook
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConnect}
                disabled={loading || !botToken}
                className="flex-1 min-h-[48px] px-6 py-3 bg-accent text-white rounded-lg 
                           font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Подключение...' : isConnected ? 'Обновить настройки' : 'Подключить бота'}
              </button>
              {isConnected && (
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-6 py-3 border border-red-300 text-red-600 rounded-lg 
                             font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Отключить
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-text mb-4">Инструкция по настройке</h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <p className="font-medium mb-2">1. Создайте бота:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Откройте Telegram и найдите @BotFather</li>
                <li>Отправьте команду /newbot</li>
                <li>Следуйте инструкциям для создания бота</li>
                <li>Скопируйте полученный токен</li>
              </ol>
            </div>

            <div>
              <p className="font-medium mb-2">2. Настройте переменные окружения:</p>
              <p className="ml-4 font-mono text-xs bg-gray-100 p-2 rounded">
                TELEGRAM_BOT_TOKEN=ваш_токен<br />
                TELEGRAM_WEBHOOK_SECRET=случайная_строка
              </p>
            </div>

            <div>
              <p className="font-medium mb-2">3. Настройте webhook:</p>
              <p className="ml-4">
                После подключения бота webhook настроится автоматически. 
                Убедитесь, что ваше приложение доступно по HTTPS (или используйте ngrok для разработки).
              </p>
            </div>

            <div>
              <p className="font-medium mb-2">4. Проверка работы:</p>
              <p className="ml-4">
                Отправьте боту команду /start в Telegram. Если бот ответил — всё работает!
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-text mb-4">Статус</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">
                {isConnected ? 'Бот подключен' : 'Бот не подключен'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm">
                {process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ? 'OpenRouter API настроен' : 'OpenRouter API не настроен'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

