import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [ws, setWs] = useState(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/chat"); // WebSocket Connection
    socket.onopen = () => console.log("Connected to chat server");
    socket.onmessage = (event) => {
      setMessages((prev) => [...prev, JSON.parse(event.data)]);
    };
    socket.onerror = (error) => console.error("WebSocket error:", error);
    socket.onclose = () => console.log("Disconnected from chat server");

    setWs(socket);
    return () => socket.close();
  }, []);

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN && input.trim()) {
      const messageObj = { user: username || "Anonymous", text: input };
      ws.send(JSON.stringify(messageObj));
      setInput("");
    }
  };

  return (
    <div className="container">
      <h1>Global Chat</h1>
      {!username ? (
        <div className="username-input">
          <input
            type="text"
            placeholder="Enter your name..."
            onChange={(e) => setUsername(e.target.value)}
            className="input"
          />
          <button
            onClick={() => setUsername(username.trim() || "Anonymous")}
            className="button"
          >
            Join
          </button>
        </div>
      ) : (
        <>
          <div className="chat-container">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${
                  msg.user === username ? "sent" : "received"
                }`}
              >
                <strong>{msg.user}:</strong> {msg.text}
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="input"
          />
          <button onClick={sendMessage} className="button">
            Send
          </button>
        </>
      )}
    </div>
  );
}

export default App;
