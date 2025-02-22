import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [ws, setWs] = useState(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/chat"); // Connect to backend WebSocket
    socket.onopen = () => console.log("Connected to chat server");
    socket.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };
    socket.onerror = (error) => console.error("WebSocket error:", error);
    socket.onclose = () => console.log("Disconnected from chat server");

    setWs(socket);
    return () => socket.close();
  }, []);

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(input);
      setInput("");
    }
  };

  return (
    <div className="container">
      <h1>Global Chat</h1>
      <div className="chat-container">
        {messages.map((msg, index) => (
          <div key={index}>{msg}</div>
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
    </div>
  );
}

export default App;
