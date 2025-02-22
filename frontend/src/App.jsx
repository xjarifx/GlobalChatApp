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
    <div className="w-full min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-center mb-6">Global Chat</h1>
        {!username ? (
          <div className="flex flex-col items-center space-y-4">
            <input
              type="text"
              placeholder="Enter your full name..."
              onChange={(e) => setUsername(e.target.value)}
              value={username}
              className="px-4 py-2 w-full border border-gray-300 rounded-lg"
            />
            <button
              onClick={() => setUsername(username.trim() || "Anonymous")}
              className="px-4 py-2 w-full bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              disabled={!username.trim()}
            >
              Join
            </button>
          </div>
        ) : (
          <>
            <div className="chat-container space-y-4 max-h-72 overflow-y-auto mb-4 p-4 bg-gray-50 rounded-lg">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-2 ${
                    msg.user === username ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`${
                      msg.user === username
                        ? "bg-blue-500 text-white"
                        : "bg-gray-300 text-black"
                    } p-2 rounded-lg`}
                  >
                    <strong>{msg.user}:</strong> {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="px-4 py-2 w-full border border-gray-300 rounded-lg"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
