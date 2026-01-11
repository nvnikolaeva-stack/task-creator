'use client';

import { useState, useEffect, useRef } from 'react';
import { isSpeechRecognitionSupported, getSpeechRecognition, setupSpeechRecognition } from '@/lib/speech';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  onError: (error: string) => void;
}

export default function VoiceRecorder({ onTranscript, onError }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported());
    if (isSpeechRecognitionSupported()) {
      recognitionRef.current = getSpeechRecognition();
      if (recognitionRef.current) {
        setupSpeechRecognition(
          recognitionRef.current,
          (text) => {
            setIsRecording(false);
            onTranscript(text);
          },
          (error) => {
            setIsRecording(false);
            onError(error);
          }
        );
      }
    }
  }, [onTranscript, onError]);

  const handleStartRecording = () => {
    if (!recognitionRef.current) {
      onError('Распознавание речи не поддерживается. Используйте Chrome для голосового ввода.');
      return;
    }

    try {
      recognitionRef.current.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error('Ошибка при запуске записи голоса:', {
        message: error?.message,
        error: error,
        stack: error?.stack,
      });
      onError('Не удалось начать запись. Попробуйте еще раз.');
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">
          Используйте Chrome для голосового ввода
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={isRecording ? handleStopRecording : handleStartRecording}
      className={`
        w-full min-h-[48px] px-6 py-4 rounded-lg font-medium text-white
        transition-all duration-200 flex items-center justify-center gap-3
        ${isRecording 
          ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
          : 'bg-accent hover:bg-blue-600'
        }
      `}
    >
      {isRecording ? (
        <>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V7a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Остановить запись</span>
        </>
      ) : (
        <>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
          </svg>
          <span>Записать голос</span>
        </>
      )}
    </button>
  );
}

