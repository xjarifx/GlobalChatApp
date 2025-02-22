import React, { useState, useEffect, useRef } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [ws, setWs] = useState(null);
  const [username, setUsername] = useState("");
  const [tempUsername, setTempUsername] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/chat");
    socket.onopen = () => console.log("Connected to chat server");
    socket.onmessage = (event) => {
      setMessages((prev) => [...prev, JSON.parse(event.data)]);
    };
    socket.onerror = (error) => console.error("WebSocket error:", error);
    socket.onclose = () => console.log("Disconnected from chat server");

    setWs(socket);
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = () => {
    if (ws && ws.readyState === WebSocket.OPEN && input.trim()) {
      const messageObj = { user: username, text: input };
      ws.send(JSON.stringify(messageObj));
      setInput("");
    }
  };

  const handleJoin = () => {
    if (tempUsername.trim().length >= 2) {
      setUsername(tempUsername.trim());
    }
  };

  const handleEnterKey = (e) => {
    if (e.key === "Enter" && tempUsername.trim().length >= 2) {
      handleJoin();
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-950 text-white">
      <div className="flex h-[90vh] w-full max-w-sm flex-col rounded-xl border border-zinc-400 bg-zinc-800 p-4">
        <h1 className="mb-2 text-center text-2xl font-bold">Global Chat</h1>

        {!username ? (
          <div className="mt-auto mb-auto flex flex-col items-center space-y-4">
            <input
              type="text"
              placeholder="Enter your full name..."
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              onKeyDown={handleEnterKey} // Listen for Enter key
              className="w-full rounded-lg border border-zinc-400 bg-zinc-700 px-4 py-3 text-white placeholder-white"
            />
            <button
              onClick={handleJoin}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 text-white hover:bg-blue-600"
              disabled={tempUsername.trim().length < 2}
            >
              Join
            </button>
          </div>
        ) : (
          <>
            <div className="h-[70vh] flex-1 space-y-2 overflow-y-auto rounded-lg bg-zinc-700 p-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-2 ${
                    msg.user === username ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg p-2 ${
                      msg.user === username
                        ? "bg-blue-500 text-white"
                        : "bg-gray-300 text-black"
                    }`}
                  >
                    <strong>{msg.user}:</strong> {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="w-full rounded-lg border border-zinc-400 bg-zinc-700 px-4 py-3 text-white placeholder-white"
              />
              <button
                onClick={sendMessage}
                className="rounded-lg bg-blue-500 px-4 py-3 text-white hover:bg-blue-600"
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
