/** @jest-environment node */

export {};

const emitMock = jest.fn();
const ioMock = {
  to: jest.fn(() => ({ emit: emitMock })),
};

jest.mock('../../../server/lib/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { emitToRooms, SOCKET_EVENTS } = require('../../../server/socket/index.js');

describe('Socket routing contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes complaint events to staff, warden, and the originating user room', () => {
    emitToRooms(ioMock, SOCKET_EVENTS.complaintCreated, { studentId: 'student-42' });

    expect(ioMock.to).toHaveBeenCalledWith('role:staff');
    expect(ioMock.to).toHaveBeenCalledWith('role:warden');
    expect(ioMock.to).toHaveBeenCalledWith('user:student-42');
    expect(emitMock).toHaveBeenCalledWith(
      SOCKET_EVENTS.complaintCreated,
      expect.objectContaining({
        studentId: 'student-42',
        requestId: expect.any(String),
        event: SOCKET_EVENTS.complaintCreated,
        timestamp: expect.any(String),
      })
    );
  });

  it('routes vote events to all role rooms', () => {
    emitToRooms(ioMock, SOCKET_EVENTS.mealVotesSubmitted, { voteDate: '2026-05-26' });

    expect(ioMock.to).toHaveBeenCalledWith('role:student');
    expect(ioMock.to).toHaveBeenCalledWith('role:staff');
    expect(ioMock.to).toHaveBeenCalledWith('role:warden');
    expect(emitMock).toHaveBeenCalledWith(
      SOCKET_EVENTS.mealVotesSubmitted,
      expect.objectContaining({
        voteDate: '2026-05-26',
        requestId: expect.any(String),
        event: SOCKET_EVENTS.mealVotesSubmitted,
        timestamp: expect.any(String),
      })
    );
  });

  it('deduplicates repeated room targets before emitting', () => {
    emitToRooms(ioMock, SOCKET_EVENTS.notificationsUpdated, { userId: 'user-1' }, { rooms: ['role:staff', 'role:staff', 'user:user-1'] });

    expect(ioMock.to).toHaveBeenCalledTimes(2);
    expect(ioMock.to).toHaveBeenCalledWith('role:staff');
    expect(ioMock.to).toHaveBeenCalledWith('user:user-1');
  });
});