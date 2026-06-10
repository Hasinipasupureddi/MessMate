/** @jest-environment node */

import { PATCH } from '@/app/api/cooking-tasks/[id]/route';
import { updateCookingTaskStatus, uiCookingStatus } from '@/lib/api/cookingTasksMySQL';

jest.mock('@/lib/api/cookingTasksMySQL', () => ({
  updateCookingTaskStatus: jest.fn(),
  getCookingTask: jest.fn(),
  uiCookingStatus: jest.fn(),
}));

jest.mock('@/lib/auth/guards', () => ({ requireRole: jest.fn() }));
import { requireRole } from '@/lib/auth/guards';

const mockedRequireRole = jest.mocked(requireRole as any);

describe('Cooking task PATCH smoke coverage', () => {
  const mockedUpdateCookingTaskStatus = jest.mocked(updateCookingTaskStatus);
  const mockedUiCookingStatus = jest.mocked(uiCookingStatus);

  beforeEach(() => {
    jest.resetAllMocks();
    mockedRequireRole.mockResolvedValue({ ok: true, session: { sub: 'demo-staff-1', role: 'staff' } });
  });

  it('returns the updated task in UI format', async () => {
    mockedUpdateCookingTaskStatus.mockResolvedValue({
      id: 'task-003',
      task_date: '2026-05-14',
      meal_type: 'breakfast',
      task_name: 'Breakfast Idly',
      status: 'done',
      created_at: '2026-05-14T03:00:00.000Z',
      updated_at: '2026-05-14T04:00:00.000Z',
    });
    mockedUiCookingStatus.mockReturnValue('served');

    const request = new Request('http://localhost/api/cooking-tasks/task-003', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ready' }),
    });

    const response = await PATCH(request as never, { params: Promise.resolve({ id: 'task-003' }) });
    const body = await response.json();

    expect(mockedUpdateCookingTaskStatus).toHaveBeenCalledWith('task-003', 'ready');
    expect(response.status).toBe(200);
    expect(body).toEqual({
      row: {
        id: 'task-003',
        taskDate: '2026-05-14',
        mealType: 'breakfast',
        taskName: 'Breakfast Idly',
        status: 'served',
        createdAt: '2026-05-14T03:00:00.000Z',
        updatedAt: '2026-05-14T04:00:00.000Z',
      },
    });
  });

  it('rejects requests without a status field', async () => {
    const request = new Request('http://localhost/api/cooking-tasks/task-003', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await PATCH(request as never, { params: Promise.resolve({ id: 'task-003' }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ message: 'status field is required' });
  });
});