'use client';

import { useState } from 'react';
import VoiceRecorder from '@/components/VoiceRecorder';
import TextInput from '@/components/TextInput';
import TeamSelector from '@/components/TeamSelector';
import TaskResult from '@/components/TaskResult';
import QuestionStep from '@/components/QuestionStep';
import QuestionsList from '@/components/QuestionsList';
import { checkInformationAndAskQuestions, generateTask } from '@/lib/openrouter';
import { getTemplate, loadTemplates } from '@/lib/templates';
import { saveTaskToHistory } from '@/lib/storage';
import type { SelectedTeam, ProcessingState } from '@/types';

type InputMode = 'voice' | 'text';

export default function Home() {
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [userText, setUserText] = useState('');
  const [textInputTeam, setTextInputTeam] = useState<SelectedTeam | null>(null);
  const [voiceDetectedTeam, setVoiceDetectedTeam] = useState<SelectedTeam | null>(null);
  const [voiceManualTeam, setVoiceManualTeam] = useState<SelectedTeam | null>(null);
  const [finalTeam, setFinalTeam] = useState<SelectedTeam | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [generatedTask, setGeneratedTask] = useState('');
  const [state, setState] = useState<ProcessingState>('idle');
  const [error, setError] = useState('');

  const teams = loadTemplates();

  // Определение команды из первых слов (для голосового ввода)
  const detectTeamFromText = (text: string): SelectedTeam | null => {
    const lowerText = text.toLowerCase();
    
    // Ключевые слова для команд (проверяем в порядке приоритета)
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

    // Проверяем первые 100 символов для быстрого определения
    const firstPart = lowerText.substring(0, 100);
    
    for (const { patterns, team } of keywords) {
      for (const pattern of patterns) {
        if (firstPart.includes(pattern)) {
          return team;
        }
      }
    }

    return null;
  };

  const processWithTeam = async (text: string, team: SelectedTeam) => {
    setFinalTeam(team);
    setState('processing');
    setError('');

    try {
      const template = getTemplate(team.teamId, team.subtypeId);
      if (!template) {
        throw new Error('Шаблон не найден');
      }

      // Проверить достаточность информации
      const checkResult = await checkInformationAndAskQuestions(text, template);
      
      if (!checkResult.sufficient && checkResult.questions && checkResult.questions.length > 0) {
        setQuestions(checkResult.questions);
        setTotalQuestions(checkResult.totalQuestions || checkResult.questions.length);
        setCurrentQuestionIndex(0);
        setQuestionAnswers([]);
        setState('idle');
      } else {
        // Информации достаточно, генерируем задачу
        await generateTaskFinal(text, team);
      }
    } catch (err: any) {
      console.error('Ошибка в processWithTeam:', {
        message: err?.message,
        error: err,
        stack: err?.stack,
      });
      setError(err?.message || 'Ошибка при обработке задачи');
      setState('error');
    }
  };

  const handleVoiceTranscript = async (text: string) => {
    setUserText(text);
    
    // Автоопределение команды из первых слов
    const detected = detectTeamFromText(text);
    
    if (detected) {
      setVoiceDetectedTeam(detected);
      setVoiceManualTeam(null);
      await processWithTeam(text, detected);
    } else {
      // Команда не распознана - показываем выбор вручную
      setVoiceDetectedTeam(null);
      setVoiceManualTeam(null);
      setState('idle');
    }
  };

  const handleVoiceTeamSelect = async (team: SelectedTeam) => {
    setVoiceManualTeam(team);
    if (userText) {
      await processWithTeam(userText, team);
    }
  };

  const handleTextSubmit = async (text: string) => {
    if (!textInputTeam) {
      setError('Выберите команду');
      return;
    }

    setUserText(text);
    await processWithTeam(text, textInputTeam);
  };

  // Обработка ответа на один вопрос (для текстового ввода - пошагово)
  const handleQuestionAnswer = async (answer: string) => {
    const newAnswers = [...questionAnswers, answer];
    setQuestionAnswers(newAnswers);
    
    if (currentQuestionIndex < questions.length - 1) {
      // Переходим к следующему вопросу
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Все вопросы отвечены
      const allAnswers = newAnswers.join('\n\n');
      setAdditionalInfo(allAnswers);
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setQuestionAnswers([]);
      await generateTaskFinal();
    }
  };

  // Обработка всех ответов сразу (для голосового ввода)
  const handleAllQuestionsAnswer = async (answers: string) => {
    try {
      setAdditionalInfo(answers);
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setQuestionAnswers([]);
      await generateTaskFinal();
    } catch (err: any) {
      console.error('Ошибка в handleAllQuestionsAnswer:', {
        message: err?.message,
        error: err,
        stack: err?.stack,
      });
      setError(err?.message || 'Ошибка при обработке ответов');
      setState('error');
    }
  };

  const generateTaskFinal = async (text?: string, team?: SelectedTeam) => {
    const taskText = text || userText;
    const taskTeam = team || finalTeam;
    
    if (!taskTeam) return;

    setState('processing');
    setError('');

    try {
      const template = getTemplate(taskTeam.teamId, taskTeam.subtypeId);
      if (!template) {
        throw new Error('Шаблон не найден');
      }

      const task = await generateTask(taskText, template, additionalInfo);
      setGeneratedTask(task);
      setState('ready');

      // Сохраняем в историю
      const teamName = teams.find(t => t.id === taskTeam.teamId)?.name || taskTeam.teamId;
      const subtypeName = taskTeam.subtypeId
        ? teams.find(t => t.id === taskTeam.teamId)?.subtypes.find(s => s.id === taskTeam.subtypeId)?.name
        : undefined;
      saveTaskToHistory(task, teamName, subtypeName);
    } catch (err: any) {
      console.error('Ошибка в generateTaskFinal:', {
        message: err?.message,
        error: err,
        stack: err?.stack,
      });
      setError(err?.message || 'Ошибка при генерации задачи');
      setState('error');
    }
  };

  const handleRegenerate = async () => {
    try {
      await generateTaskFinal();
    } catch (err: any) {
      console.error('Ошибка в handleRegenerate:', {
        message: err?.message,
        error: err,
        stack: err?.stack,
      });
    }
  };

  const handleCopy = () => {
    // Toast будет показан в компоненте TaskResult
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
    setState('error');
  };

  const reset = () => {
    setUserText('');
    setTextInputTeam(null);
    setVoiceDetectedTeam(null);
    setVoiceManualTeam(null);
    setFinalTeam(null);
    setQuestions([]);
    setTotalQuestions(0);
    setCurrentQuestionIndex(0);
    setQuestionAnswers([]);
    setAdditionalInfo('');
    setGeneratedTask('');
    setState('idle');
    setError('');
  };

  const getTeamDisplayName = (team: SelectedTeam | null): string => {
    if (!team) return '';
    const teamObj = teams.find(t => t.id === team.teamId);
    if (!teamObj) return team.teamId;
    
    const subtypeName = team.subtypeId
      ? teamObj.subtypes.find(s => s.id === team.subtypeId)?.name
      : undefined;
    
    return subtypeName ? `${teamObj.name} - ${subtypeName}` : teamObj.name;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold text-text">Создать задачу для Jira</h1>

      {!generatedTask && (
        <div className="space-y-6">
          {/* Переключатель способа ввода */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => {
                setInputMode('voice');
                reset();
              }}
              className={`px-6 py-3 font-medium transition-colors ${
                inputMode === 'voice'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Голосом
            </button>
            <button
              onClick={() => {
                setInputMode('text');
                reset();
              }}
              className={`px-6 py-3 font-medium transition-colors ${
                inputMode === 'text'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Текстом
            </button>
          </div>

          {/* Сценарий 1: Голосовой ввод */}
          {inputMode === 'voice' && (
            <div className="space-y-6">
              <VoiceRecorder onTranscript={handleVoiceTranscript} onError={handleError} />
              
              <p className="text-sm text-gray-600 text-center">
                Начните с названия команды, например: «Разработка, нужно сделать...»
              </p>

              {/* Если команда не распознана - показать выбор */}
              {userText && !voiceDetectedTeam && !voiceManualTeam && !generatedTask && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                  <p className="text-sm text-yellow-800 mb-4">
                    Не удалось определить команду. Выберите вручную:
                  </p>
                  <TeamSelector 
                    selectedTeam={voiceManualTeam} 
                    onSelect={handleVoiceTeamSelect} 
                  />
                </div>
              )}

              {/* Если команда распознана - показать её */}
              {voiceDetectedTeam && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Определено:</span> {getTeamDisplayName(voiceDetectedTeam)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Сценарий 2: Текстовый ввод */}
          {inputMode === 'text' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-text mb-4">Выберите команду</h2>
                <TeamSelector 
                  selectedTeam={textInputTeam} 
                  onSelect={setTextInputTeam} 
                />
              </div>

              <TextInput 
                onSubmit={handleTextSubmit} 
                initialValue={userText}
                disabled={!textInputTeam}
              />
            </div>
          )}
        </div>
      )}

      {/* Пошаговые вопросы для текстового ввода */}
      {inputMode === 'text' && questions.length > 0 && currentQuestionIndex < questions.length && (
        <QuestionStep
          question={questions[currentQuestionIndex]}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={totalQuestions || questions.length}
          onAnswer={handleQuestionAnswer}
        />
      )}

      {/* Групповые вопросы для голосового ввода */}
      {inputMode === 'voice' && questions.length > 0 && (
        <QuestionsList
          questions={questions}
          onAnswer={handleAllQuestionsAnswer}
          onError={handleError}
        />
      )}

      {state === 'processing' && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          <p className="mt-4 text-gray-600">Обработка...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => {
              setError('');
              if (state === 'error') setState('idle');
            }}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Закрыть
          </button>
        </div>
      )}

      {generatedTask && (
        <div className="space-y-4">
          {finalTeam && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Команда:</span> {getTeamDisplayName(finalTeam)}
              </p>
            </div>
          )}
          <TaskResult task={generatedTask} onCopy={handleCopy} onRegenerate={handleRegenerate} />
          <button
            onClick={reset}
            className="w-full px-6 py-3 border border-gray-300 text-text rounded-lg 
                       font-medium hover:bg-gray-50 transition-colors"
          >
            Создать новую задачу
          </button>
        </div>
      )}
    </div>
  );
}
