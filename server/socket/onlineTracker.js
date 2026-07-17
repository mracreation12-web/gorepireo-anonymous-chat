/**
 * Tracker to manage online user counts.
 * Refactored to leverage Socket.IO's native adapter properties when available,
 * ensuring compatibility with horizontal scaling adapters (e.g., Redis Adapter)
 * while maintaining a local fallback Map for standalone/development deployments.
 */
class OnlineTracker {
  constructor() {
    // Maps socketId -> roomName
    this.userRooms = new Map();
    // Maps roomName -> Set of socketIds
    this.roomUsers = new Map();
  }

  /**
   * Tracks a user joining a room.
   * @param {string} socketId 
   * @param {string} room 
   */
  trackJoin(socketId, room) {
    // If user was already in a room, track leave first
    this.trackLeave(socketId);

    this.userRooms.set(socketId, room);

    if (!this.roomUsers.has(room)) {
      this.roomUsers.set(room, new Set());
    }
    this.roomUsers.get(room).add(socketId);
  }

  /**
   * Tracks a user leaving their current room.
   * @param {string} socketId 
   * @returns {string|null} The room name that was left, or null if not found.
   */
  trackLeave(socketId) {
    const room = this.userRooms.get(socketId);
    if (!room) return null;

    this.userRooms.delete(socketId);

    const roomSet = this.roomUsers.get(room);
    if (roomSet) {
      roomSet.delete(socketId);
      if (roomSet.size === 0) {
        this.roomUsers.delete(room);
      }
    }

    return room;
  }

  /**
   * Gets the number of online users in a specific room.
   * Queries the native socket.io adapter when available.
   * @param {string} room 
   * @param {Object} [io] - Optional Socket.IO server instance
   * @returns {number}
   */
  getRoomCount(room, io = null) {
    if (io && io.sockets && io.sockets.adapter) {
      const roomSet = io.sockets.adapter.rooms.get(room);
      return roomSet ? roomSet.size : 0;
    }
    const roomSet = this.roomUsers.get(room);
    return roomSet ? roomSet.size : 0;
  }

  /**
   * Gets the total number of online users globally.
   * Queries the native engine.io client count when available.
   * @param {Object} [io] - Optional Socket.IO server instance
   * @returns {number}
   */
  getGlobalCount(io = null) {
    if (io && io.engine) {
      return io.engine.clientsCount;
    }
    return this.userRooms.size;
  }
}

export default new OnlineTracker();

