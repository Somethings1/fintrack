package socket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ClientConn struct {
	Conn   *websocket.Conn
	UserID string // aka username
}

type WebSocketManager struct {
	clients map[string]*ClientConn
	lock    sync.Mutex
}

func (m *WebSocketManager) Register(clientId string, userId string, conn *websocket.Conn) {
	m.lock.Lock()
	defer m.lock.Unlock()
	m.clients[clientId] = &ClientConn{
		Conn:   conn,
		UserID: userId,
	}
}

func (m *WebSocketManager) Unregister(clientId string) {
	m.lock.Lock()
	defer m.lock.Unlock()

	if client, ok := m.clients[clientId]; ok {
		client.Conn.Close()
		delete(m.clients, clientId)
	}
}

func (m *WebSocketManager) BroadcastToUserExcept(userId, exceptId string, message interface{}) {
	m.lock.Lock()
	defer m.lock.Unlock()

	data, _ := json.Marshal(message)
	for id, client := range m.clients {
		if client.UserID != userId || id == exceptId {
			continue
		}
		if err := client.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
			log.Printf("Error sending to %s: %v", id, err)
		}
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // hoặc kiểm tra r.Header["Origin"] nếu muốn chặt hơn
	},
}

func HandleWebSocket(c *gin.Context) {
	username := c.GetString("username")
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}

	clientId := uuid.New().String()
	Manager.Register(clientId, username, conn)

	conn.WriteJSON(map[string]interface{}{
        "collection": "",
        "action":     "init",
		"detail": clientId,
	})

	go func() {
		defer func() {
			Manager.Unregister(clientId)
			conn.Close()
		}()

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				log.Println("read error:", err)
				break
			}
		}
	}()
}

var Manager = &WebSocketManager{
	clients: make(map[string]*ClientConn),
}
