package handlers

import "backend/socket"

// socketManager is a package-level variable to store the socket manager
// This allows REST handlers to emit socket events (e.g., after creating a message)
var socketManager *socket.Manager

// SetSocketManager sets the socket manager for use by REST handlers
func SetSocketManager(manager *socket.Manager) {
	socketManager = manager
}

// GetSocketManager returns the socket manager (returns nil if not set)
func GetSocketManager() *socket.Manager {
	return socketManager
}

