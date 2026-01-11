import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Генератор задач для Jira',
  description: 'Создание задач для Jira с помощью LLM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <Link href="/" className="flex items-center px-4 text-xl font-bold text-accent">
                  Генератор задач
                </Link>
                <div className="flex space-x-4 ml-8">
                  <Link
                    href="/"
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-accent hover:border-b-2 hover:border-accent"
                  >
                    Главная
                  </Link>
                  <Link
                    href="/templates"
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-accent hover:border-b-2 hover:border-accent"
                  >
                    Шаблоны
                  </Link>
                  <Link
                    href="/history"
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-accent hover:border-b-2 hover:border-accent"
                  >
                    История
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-accent hover:border-b-2 hover:border-accent"
                  >
                    Настройки
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

