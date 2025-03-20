import { useState, useEffect, useRef } from "react";
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
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="flex h-[90vh] w-full max-w-md flex-col rounded-xl shadow-2xl bg-white p-6">
        <h1 className="mb-6 text-center text-3xl font-bold text-blue-400">
          🌍 Global Chat
        </h1>

        {!username ? (
          <div className="mt-auto mb-auto flex flex-col items-center space-y-6 w-full">
            <div className="w-full space-y-4">
              <input
                type="text"
                placeholder="Enter your username"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                onKeyDown={handleEnterKey}
                className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                onClick={handleJoin}
                className="w-full rounded-lg bg-blue-400 px-6 py-3 font-semibold text-white hover:bg-blue-500 transform transition-all hover:scale-[1.02] active:scale-95 shadow-md"
                disabled={tempUsername.trim().length < 2}
              >
                Join Chat
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto rounded-lg bg-gray-50 p-4 scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
              {messages.map((msg, index) => {
                const isUser = msg.user === username;
                const prevMessage = messages[index - 1];
                const showUsername = !prevMessage || prevMessage.user !== msg.user;
                const isSameUser = prevMessage?.user === msg.user;
                const isFirstMessage = index === 0;

                return (
                  <div
                    key={index}
                    className={`flex ${isUser ? "justify-end" : "justify-start"} ${
                      !isFirstMessage && isSameUser ? "mt-1" : "mt-4"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex-shrink-0 mr-2">
                        {showUsername ? (
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-500 font-medium">
                            {msg.user[0].toUpperCase()}
                          </div>
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center">
                            <div className="w-1 h-1 bg-gray-400 rounded-full" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[80%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      {showUsername && (
                        <span className={`text-sm mb-1 ${isUser ? "text-blue-400" : "text-gray-500"}`}>
                          {msg.user}
                        </span>
                      )}
                      <div
                        className={`rounded-2xl p-3 ${
                          isUser
                            ? "bg-blue-400 text-white rounded-br-none"
                            : "bg-white border border-gray-200 rounded-bl-none shadow-sm"
                        } ${!showUsername && "mt-1"}`}
                      >
                        <p className={isUser ? "text-white" : "text-gray-800"}>{msg.text}</p>
                      </div>
                      
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 rounded-lg border-2 border-gray-200 px-4 py-2 text-gray-700 placeholder-gray-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button
                onClick={sendMessage}
                className="rounded-lg bg-blue-400 px-4 py-2 text-white hover:bg-blue-500 transform transition-all hover:scale-105 active:scale-95 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;