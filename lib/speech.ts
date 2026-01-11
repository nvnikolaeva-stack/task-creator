// Утилиты для работы с Web Speech API

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function getSpeechRecognition(): any {
  if (typeof window === 'undefined') return null;
  
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) return null;
  
  return new SpeechRecognition();
}

// Настроить распознавание речи
export function setupSpeechRecognition(
  recognition: any,
  onResult: (text: string) => void,
  onError: (error: string) => void
): void {
  if (!recognition) return;
  
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'ru-RU';
  
  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };
  
  recognition.onerror = (event: any) => {
    let errorMessage = 'Ошибка распознавания речи';
    if (event.error === 'no-speech') {
      errorMessage = 'Речь не распознана. Попробуйте еще раз.';
    } else if (event.error === 'audio-capture') {
      errorMessage = 'Микрофон не найден. Проверьте настройки браузера.';
    } else if (event.error === 'not-allowed') {
      errorMessage = 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.';
    }
    console.error('Ошибка распознавания речи:', {
      error: event.error,
      message: errorMessage,
      event: event,
    });
    onError(errorMessage);
  };
  
  recognition.onend = () => {
    // Распознавание завершено
  };
}

