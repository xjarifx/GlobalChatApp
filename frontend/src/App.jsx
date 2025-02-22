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
      <div className="flex h-[90vh] w-full max-w-sm flex-col rounded border border-zinc-400 bg-zinc-800 p-4">
        <h1 className="mb-4 text-center text-2xl font-bold">Global Chat</h1>

        {!username ? (
          <div className="mt-auto mb-auto flex flex-col items-center space-y-4">
            <input
              type="text"
              placeholder=" Username"
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              onKeyDown={handleEnterKey}
              className="w-full rounded border border-zinc-400 bg-zinc-700 p-2 text-white placeholder-white"
            />
            <button
              onClick={handleJoin}
              className="w-full rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
              disabled={tempUsername.trim().length < 2}
            >
              Join
            </button>
          </div>
        ) : (
          <>
            <div className="h-[70vh] flex-1 space-y-2 overflow-y-auto rounded bg-zinc-700 p-2">
              {messages.map((msg, index) => {
                const isUser = msg.user === username;
                return (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <p
                      className={`text-sm opacity-50 ${
                        isUser ? "text-right" : "text-left"
                      }`}
                    >
                      {msg.user}
                    </p>
                    <div
                      className={`max-w-[75%] rounded p-2 ${
                        isUser
                          ? "self-end bg-blue-500 text-white"
                          : "self-start bg-gray-300 text-black"
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <input
                type="text"
                placeholder=" Aa"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="w-full rounded border border-zinc-400 bg-zinc-700 p-2 text-white placeholder-white"
              />
              <button
                onClick={sendMessage}
                className="rounded bg-blue-500 p-2 text-white hover:bg-blue-600"
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
