/** @jest-environment jsdom */

const connectMock = jest.fn();
const disconnectMock = jest.fn();
const emitMock = jest.fn();
const onMock = jest.fn();
const offMock = jest.fn();

const socketMock = {
  connect: connectMock,
  disconnect: disconnectMock,
  emit: emitMock,
  on: onMock,
  off: offMock,
  id: 'socket-1',
  connected: false,
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

import {
  disconnectMessMateSocket,
  getMessMateSocket,
  joinRoleRoom,
  leaveRoleRoom,
  SOCKET_EVENTS,
  subscribeSocketEvent,
} from '@/lib/socket/client';

const { io } = require('socket.io-client') as { io: jest.Mock };

describe('Socket client lifecycle contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.__messmate_socket_client__ = undefined;
    global.__messmate_socket_subscriptions__ = undefined;
    global.__messmate_socket_listeners_attached__ = undefined;
    socketMock.connected = false;
    io.mockReturnValue(socketMock);
  });

  it('creates a singleton socket and connects once by default', () => {
    const first = getMessMateSocket();
    const second = getMessMateSocket();

    expect(first).toBe(socketMock);
    expect(second).toBe(socketMock);
    expect(io).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('can initialize without connecting for the diagnostics page', () => {
    const socket = getMessMateSocket({ connect: false });

    expect(socket).toBe(socketMock);
    expect(io).toHaveBeenCalledTimes(1);
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('registers subscriptions once and removes them on cleanup', () => {
    const handler = jest.fn();
    const cleanup = subscribeSocketEvent(SOCKET_EVENTS.notificationsUpdated, handler);

    expect(offMock).toHaveBeenCalledWith(SOCKET_EVENTS.notificationsUpdated, handler);
    expect(onMock).toHaveBeenCalledWith(SOCKET_EVENTS.notificationsUpdated, handler);
    expect(global.__messmate_socket_subscriptions__).toBe(1);

    cleanup();

    expect(offMock).toHaveBeenLastCalledWith(SOCKET_EVENTS.notificationsUpdated, handler);
    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(global.__messmate_socket_client__).toBeUndefined();
    expect(global.__messmate_socket_subscriptions__).toBe(0);
  });

  it('does not duplicate listeners when the same subscription is re-registered', () => {
    const handler = jest.fn();

    subscribeSocketEvent(SOCKET_EVENTS.mealOptinsUpdated, handler);
    subscribeSocketEvent(SOCKET_EVENTS.mealOptinsUpdated, handler);

    const firstOffCalls = offMock.mock.calls.filter(([event]) => event === SOCKET_EVENTS.mealOptinsUpdated);
    const firstOnCalls = onMock.mock.calls.filter(([event]) => event === SOCKET_EVENTS.mealOptinsUpdated);

    expect(firstOffCalls).toHaveLength(2);
    expect(firstOnCalls).toHaveLength(2);
    expect(firstOnCalls[0][1]).toBe(handler);
    expect(firstOnCalls[1][1]).toBe(handler);
  });

  it('emits room join and leave requests using canonical role rooms', () => {
    joinRoleRoom('staff');
    leaveRoleRoom('warden');

    expect(emitMock).toHaveBeenCalledWith('room:join', 'role:staff');
    expect(emitMock).toHaveBeenCalledWith('room:leave', 'role:warden');
  });

  it('creates a fresh socket after disconnect cleanup', () => {
    const first = getMessMateSocket();
    disconnectMessMateSocket();
    const second = getMessMateSocket();

    expect(first).toBe(socketMock);
    expect(second).toBe(socketMock);
    expect(io).toHaveBeenCalledTimes(2);
  });

  it('restores subscriptions after a simulated server restart', () => {
    const firstSocket = getMessMateSocket();
    const handler = jest.fn();
    const cleanup = subscribeSocketEvent(SOCKET_EVENTS.notificationsUpdated, handler);

    cleanup();
    disconnectMessMateSocket();

    const restartedSocket = {
      ...socketMock,
      id: 'socket-2',
      connect: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    io.mockReturnValueOnce(restartedSocket);
    const secondSocket = getMessMateSocket();
    const secondCleanup = subscribeSocketEvent(SOCKET_EVENTS.notificationsUpdated, handler);

    expect(secondSocket).toBe(restartedSocket);
    expect(io).toHaveBeenCalledTimes(2);
    expect(restartedSocket.on).toHaveBeenCalledWith(SOCKET_EVENTS.notificationsUpdated, handler);
    secondCleanup();
    expect(restartedSocket.off).toHaveBeenCalledWith(SOCKET_EVENTS.notificationsUpdated, handler);
  });
});