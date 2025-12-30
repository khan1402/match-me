package handlers

import (
	"net/http"
	"log"

	"backend/db"
	"backend/socket"
	"backend/utils"

	socketio "github.com/googollee/go-socket.io"
)

// RegisterSocketIOHandlers wires all Socket.IO events
func RegisterSocketIOHandlers(
	server *socketio.Server,
	manager *socket.Manager,
) {

	// ---- CONNECT ----
	server.OnConnect("/", func(conn socketio.Conn) error {
		headers := conn.RemoteHeader()
		req := &http.Request{Header: headers}

		c, err := req.Cookie("auth_token")
		if err != nil {
			log.Println("[SOCKET CONNECT] auth_token cookie NOT found")
			return err
		}

		claims, err := utils.VerifyToken(c.Value)
		if err != nil {
			log.Println("[SOCKET CONNECT] token verification FAILED")
			return err
		}

		user, err := db.GetUserByID(claims.UserID)
		if err != nil {
			log.Println("[SOCKET CONNECT] user NOT found")
			return err
		}

		log.Println("[SOCKET CONNECT] OK user", user.ID)

		conn.SetContext(user.ID)
		manager.Register(user.ID, conn)
		return nil
	})

	// ---- DISCONNECT ----
	server.OnDisconnect("/", func(conn socketio.Conn, reason string) {
		uid, ok := conn.Context().(int)
		if !ok {
			return
		}
		manager.Unregister(uid, conn)
	})

	// ---- MESSAGE SEND ----
	server.OnEvent("/", "message:send", func(conn socketio.Conn, payload map[string]interface{}) {

		log.Println("[MESSAGE SEND] reached, payload =", payload)

		userID, ok := conn.Context().(int)
		if !ok {
			log.Println("[MESSAGE SEND] no user in socket context")
			return
		}

		matchIDf, ok := payload["matchId"].(float64)
		if !ok {
			log.Println("[MESSAGE SEND] matchId missing or wrong type:", payload["matchId"])
			return
		}
		matchID := int(matchIDf)

		content, ok := payload["content"].(string)
		if !ok || content == "" {
			log.Println("[MESSAGE SEND] content missing or empty:", payload["content"])
			return
		}

		match, err := db.GetMatchByID(matchID)
		if err != nil {
			log.Println("[MESSAGE SEND] GetMatchByID failed:", err)
			return
		}

		if match.UserID1 != userID && match.UserID2 != userID {
			log.Println("[MESSAGE SEND] user not part of match", userID, matchID)
			return
		}

		var receiverID int
		if match.UserID1 == userID {
			receiverID = match.UserID2
		} else {
			receiverID = match.UserID1
		}

		log.Println("[MESSAGE SEND] creating message",
			"matchId=", matchID,
			"sender=", userID,
			"receiver=", receiverID,
		)

		msg, err := db.CreateMessage(match.ID, userID, receiverID, content)
		if err != nil {
			log.Println("[MESSAGE SEND] CreateMessage FAILED:", err)
			return
		}

		log.Println("[MESSAGE SEND] message created with id", msg.ID)

		manager.EmitToUsers(
			[]int{match.UserID1, match.UserID2},
			"message:new",
			msg,
		)

		if unread, err := db.GetUnreadMessageCount(match.ID, msg.ReceiverID); err == nil {
			manager.EmitToUser(
				msg.ReceiverID,
				"chat:unread_update",
				map[string]interface{}{
					"matchId":     match.ID,
					"unreadCount": unread,
				},
			)
		}

		manager.EmitToUsers(
			[]int{match.UserID1, match.UserID2},
			"chat:updated",
			map[string]interface{}{
				"matchId":       match.ID,
				"lastMessage":   msg.Content,
				"lastMessageAt": msg.CreatedAt,
			},
		)
	})

	// ---- TYPING INDICATOR ----
	server.OnEvent("/", "typing", func(conn socketio.Conn, payload map[string]interface{}) {
		userID, ok := conn.Context().(int)
		if !ok {
			return
		}

		matchIDf, ok := payload["matchId"].(float64)
		if !ok {
			return
		}
		matchID := int(matchIDf)

		match, err := db.GetMatchByID(matchID)
		if err != nil {
			return
		}

		var otherUser int
		if match.UserID1 == userID {
			otherUser = match.UserID2
		} else if match.UserID2 == userID {
			otherUser = match.UserID1
		} else {
			return
		}

		manager.EmitToUser(
			otherUser,
			"typing:start",
			map[string]interface{}{
				"matchId":    match.ID,
				"fromUserId": userID,
			},
		)
	})
}
