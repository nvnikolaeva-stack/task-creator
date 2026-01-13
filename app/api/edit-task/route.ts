import { NextRequest, NextResponse } from 'next/server';
import { editTask } from '@/lib/openrouter';

export async function POST(request: NextRequest) {
  try {
    const { currentTask, editInstructions, teamId, subtypeId } = await request.json();
    
    if (!currentTask || !editInstructions) {
      return NextResponse.json({ error: 'Отсутствуют обязательные поля' }, { status: 400 });
    }
    
    const result = await editTask(currentTask, editInstructions, teamId, subtypeId);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Ошибка редактирования:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

