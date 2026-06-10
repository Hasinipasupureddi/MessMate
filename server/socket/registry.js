// Central socket event registry — canonical names and room helpers
const { SOCKET_EVENTS, ROLE_ROOMS } = require('./events');

function getRoleRoom(role) {
  return ROLE_ROOMS[role] || null;
}

module.exports = {
  SOCKET_EVENTS,
  ROLE_ROOMS,
  getRoleRoom,
};
