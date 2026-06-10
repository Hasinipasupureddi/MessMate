const SOCKET_EVENTS = {
  complaintCreated: 'complaints:created',
  complaintUpdated: 'complaints:updated',
  mealVotesSubmitted: 'meal-votes:submitted',
  attendanceUpdated: 'attendance:updated',
  notificationsUpdated: 'notifications:updated',
  dashboardRefresh: 'dashboard:refresh',
  analyticsRefresh: 'analytics:refresh',
  mealOptinsUpdated: 'meal-optins:updated',
  devInspect: 'dev:inspect',
  devInspectResult: 'dev:inspect:result',
  devPing: 'dev:ping',
  devPong: 'dev:pong',
  devTestNotification: 'dev:test-notification',
  devTestComplaint: 'dev:test-complaint',
  devTestVote: 'dev:test-vote',
};

const ROLE_ROOMS = {
  student: 'role:student',
  staff: 'role:staff',
  warden: 'role:warden',
};

module.exports = {
  SOCKET_EVENTS,
  ROLE_ROOMS,
};
