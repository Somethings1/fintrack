package socket

import (
	"context"
	"encoding/json"
	"fintrack/server/util"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"net/http"
	"sync"
	"time"
)

type ClientConn struct {
	Conn   *websocket.Conn
	UserID string
	send   chan []byte
	done   chan struct{}
	once   sync.Once
}
type WebSocketManager struct {
	clients map[string]*ClientConn
	lock    sync.RWMutex
}

var Manager = &WebSocketManager{clients: map[string]*ClientConn{}}

func (m *WebSocketManager) Register(id string, c *ClientConn) bool {
	m.lock.Lock()
	defer m.lock.Unlock()
	if len(m.clients) >= 4096 {
		return false
	}
	count := 0
	for _, existing := range m.clients {
		if existing.UserID == c.UserID {
			count++
		}
	}
	if count >= 5 {
		return false
	}
	m.clients[id] = c
	go c.writePump()
	return true
}
func (m *WebSocketManager) Unregister(id string) {
	m.lock.Lock()
	c := m.clients[id]
	delete(m.clients, id)
	m.lock.Unlock()
	if c != nil {
		c.once.Do(func() { close(c.done); _ = c.Conn.Close() })
	}
}
func (m *WebSocketManager) Close() {
	m.lock.RLock()
	ids := make([]string, 0, len(m.clients))
	for id := range m.clients {
		ids = append(ids, id)
	}
	m.lock.RUnlock()
	for _, id := range ids {
		m.Unregister(id)
	}
}
func (c *ClientConn) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()
	defer c.Conn.Close()
	for {
		select {
		case <-c.done:
			return
		case data := <-c.send:
			_ = c.Conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if c.Conn.WriteMessage(websocket.TextMessage, data) != nil {
				return
			}
		case <-ticker.C:
			if c.Conn.WriteControl(websocket.PingMessage, nil, time.Now().Add(5*time.Second)) != nil {
				return
			}
		}
	}
}
func (m *WebSocketManager) BroadcastToUserExcept(userID, excludeID string, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil || len(data) > 64<<10 {
		return
	}
	m.lock.RLock()
	recipients := map[string]*ClientConn{}
	for id, c := range m.clients {
		if c.UserID == userID && id != excludeID {
			recipients[id] = c
		}
	}
	m.lock.RUnlock()
	for id, c := range recipients {
		select {
		case <-c.done:
		case c.send <- data:
		default:
			m.Unregister(id) // Slow consumers reconnect and resynchronize instead of blocking every user.
		}
	}
}
func HandleWebSocket(origins []string) gin.HandlerFunc {
	allowed := map[string]bool{}
	for _, origin := range origins {
		allowed[origin] = true
	}
	upgrader := websocket.Upgrader{HandshakeTimeout: 5 * time.Second, CheckOrigin: func(r *http.Request) bool { return allowed[r.Header.Get("Origin")] }}
	return func(c *gin.Context) {
		user := c.GetString("username")
		if user == "" {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		id := uuid.NewString()
		// Initialize before publishing the connection, so only one goroutine ever writes data frames.
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		if conn.WriteJSON(map[string]string{"type": "init", "clientId": id}) != nil {
			conn.Close()
			return
		}
		client := &ClientConn{Conn: conn, UserID: user, send: make(chan []byte, 32), done: make(chan struct{})}
		if !Manager.Register(id, client) {
			conn.Close()
			return
		}
		defer Manager.Unregister(id)
		conn.SetReadLimit(4096)
		expires := time.Now().Add(30 * time.Minute) // Force periodic authentication on reconnect.
		refresh := func() error { return conn.SetReadDeadline(minTime(time.Now().Add(70*time.Second), expires)) }
		_ = refresh()
		conn.SetPongHandler(func(string) error { return refresh() })
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
			if refresh() != nil {
				return
			}
		}
	}
}
func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}
func BroadcastFromContext(ctx context.Context, payload interface{}) {
	user, _ := ctx.Value(util.UserIdKey).(string)
	exclude, _ := ctx.Value(util.ClientIdKey).(string)
	if user != "" {
		Manager.BroadcastToUserExcept(user, exclude, payload)
	}
}
