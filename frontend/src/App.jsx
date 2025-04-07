import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [ws, setWs] = useState(null);
  const [username, setUsername] = useState("");
  const [tempUsername, setTempUsername] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Add state to track connection status and errors
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Add state for selected image
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);

  // Add reconnection logic state
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const reconnectTimeoutRef = useRef(null);

  // Replace the processedMsgIds state with a useRef for better performance
  const processedMsgIds = useRef(new Set());
  const lastSentMsg = useRef(null);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [reconnectAttempts]); // Reconnect when reconnectAttempts changes

  // Memoize the message handler to prevent recreating it on re-renders
  const handleIncomingMessage = useCallback((data) => {
    // Create a stable message ID if one doesn't exist
    const msgId = data.id || `${data.user}-${data.timestamp || Date.now()}-${data.text.substring(0, 20)}`;
    
    // Check if we've seen this message before
    if (!processedMsgIds.current.has(msgId)) {
      // Skip if this is our own message and we already added it locally
      if (data.user === username && lastSentMsg.current && 
          lastSentMsg.current.timestamp === data.timestamp &&
          lastSentMsg.current.text === data.text) {
        console.log("Skipping our own echoed message:", msgId);
        return;
      }
      
      // Add message to our state
      setMessages((prev) => [...prev, {...data, id: msgId}]);
      
      // Mark as processed
      processedMsgIds.current.add(msgId);
      
      // Limit the size of processed IDs set
      if (processedMsgIds.current.size > 300) {
        const idsArray = Array.from(processedMsgIds.current);
        processedMsgIds.current = new Set(idsArray.slice(-150));
      }
      
      console.log("Message added:", msgId);
    } else {
      console.log("Skipping duplicate message:", msgId);
    }
  }, [username]);

  const connectWebSocket = () => {
    console.log("Connecting to WebSocket server...");
    const socket = new WebSocket("ws://localhost:8080/chat");
    
    socket.onopen = () => {
      console.log("Connected to chat server");
      setIsConnected(true);
      setErrorMessage("");
      // Reset reconnect attempts on successful connection
      setReconnectAttempts(0);
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setErrorMessage("Connection error. Trying to reconnect...");
    };
    
    socket.onclose = (event) => {
      console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
      setIsConnected(false);
      
      // Prevent the "Disconnected from server" message when we're just reconnecting
      if (!errorMessage.includes("Reconnecting")) {
        setErrorMessage("Disconnected from server. Reconnecting...");
      }
      
      // Always attempt to reconnect - don't check wasClean as it can be misleading
      const delay = Math.min(1000 * (Math.pow(1.5, reconnectAttempts)), 5000); // Max 5 second delay
      
      reconnectTimeoutRef.current = setTimeout(() => {
        setReconnectAttempts(prev => prev + 1);
      }, delay);
    };

    setWs(socket);
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Create a reusable function for sending messages
  const sendWithId = useCallback((msgData) => {
    // Generate a unique, deterministic ID
    const timestamp = Date.now();
    const msgId = `${username}-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
    
    const messageObj = {
      ...msgData,
      timestamp,
      id: msgId,
      clientGeneratedId: true // Mark as client-generated
    };
    
    // Store last sent message for deduplication
    lastSentMsg.current = messageObj;
    
    // Add to local messages first (optimistic UI update)
    setMessages((prev) => [...prev, messageObj]);
    
    // Mark as processed so we don't handle it again if echoed
    processedMsgIds.current.add(msgId);
    
    // Send to server
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(messageObj));
        console.log("Message sent:", msgId);
      } catch (error) {
        console.error("Error sending message:", error);
        setErrorMessage("Failed to send. Will try reconnecting...");
        attemptReconnect();
      }
    } else {
      console.warn("WebSocket not open, cannot send message");
      setErrorMessage("Not connected. Message stored locally.");
      attemptReconnect();
    }
    
    return msgId;
  }, [username, ws]);

  const sendMessage = () => {
    if (ws && input.trim()) {
      sendWithId({ user: username, text: input, type: "text" });
      setInput("");
    }
  };

  const selectImage = (file) => {
    if (!file) return;
    
    console.log(`Selected image: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    // Store the file for later sending
    setSelectedImage(file);
  };
  
  const sendSelectedImage = () => {
    if (!selectedImage || !ws || ws.readyState !== WebSocket.OPEN) {
      console.error("Cannot send image: no image selected or WebSocket not connected");
      setErrorMessage("Cannot send image. Please try again.");
      setIsUploading(false);
      return;
    }
    
    setIsUploading(true);
    console.log(`Sending image: ${selectedImage.name}`);
    
    // Use a smaller image size limit
    const MAX_SIZE = 100 * 1024; // 100KB
    
    if (selectedImage.size > MAX_SIZE) {
      resizeSelectedImage();
    } else {
      sendImageDirectly(selectedImage);
    }
  };
  
  const resizeSelectedImage = () => {
    console.log("Resizing image before sending");
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        
        // Calculate new dimensions (much smaller max width to prevent disconnection)
        let width = img.width;
        let height = img.height;
        
        // Make the image much smaller to prevent disconnection
        const maxDimension = 300; // Smaller dimension
        
        if (width > height) {
          height = Math.floor(height * (maxDimension / width));
          width = maxDimension;
        } else {
          width = Math.floor(width * (maxDimension / height));
          height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw resized image with white background
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get as JPEG with very reduced quality
        canvas.toBlob((blob) => {
          if (blob) {
            console.log(`Resized image to ${width}x${height}, new size: ${blob.size} bytes`);
            const resizedFile = new File([blob], selectedImage.name, { type: 'image/jpeg' });
            sendImageDirectly(resizedFile);
          } else {
            console.error("Failed to resize image");
            setErrorMessage("Failed to process image. Please try a smaller one.");
            setIsUploading(false);
          }
        }, 'image/jpeg', 0.3); // 30% quality JPEG for even smaller size
      };
      
      img.onerror = () => {
        console.error("Failed to load image for resizing");
        setErrorMessage("Failed to process image. Please try a different format.");
        setIsUploading(false);
      };
      
      img.src = event.target.result;
    };
    
    reader.readAsDataURL(selectedImage);
  };
  
  const sendImageDirectly = (file) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const base64Image = reader.result;
        console.log(`Base64 image length: ${base64Image.length} characters`);
        
        // Make sure image is even smaller - reduce to 200KB max
        if (base64Image.length > 200000) { // 200KB limit
          // If the image is still too large after resize, further reduce quality
          console.log("Image still too large after resize, further reducing");
          
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // Create a much smaller image
            const maxDimension = 300; // Even smaller max dimension
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
              height = Math.floor(height * (maxDimension / width));
              width = maxDimension;
            } else {
              width = Math.floor(width * (maxDimension / height));
              height = maxDimension;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF'; // White background
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get as very low quality JPEG
            const smallerImage = canvas.toDataURL('image/jpeg', 0.3); // 30% quality
            
            sendFinalImage(smallerImage);
          };
          img.src = base64Image;
          return;
        }
        
        sendFinalImage(base64Image);
      } catch (error) {
        console.error("Error preparing image:", error);
        setErrorMessage("Failed to process image: " + error.message);
        setIsUploading(false);
        setSelectedImage(null);
        setSelectedImagePreview(null);
      }
    };
    
    reader.onerror = () => {
      console.error("Error reading file");
      setErrorMessage("Failed to read the image file");
      setIsUploading(false);
    };
    
    reader.readAsDataURL(file);
  };
  
  // Update sendFinalImage to use the new sendWithId function
  const sendFinalImage = (base64Image) => {
    try {
      sendWithId({ user: username, text: base64Image, type: "image" });
      
      // Clean up image selection 
      setSelectedImage(null);
      setSelectedImagePreview(null);
    } catch (error) {
      console.error("Error in sendFinalImage:", error);
      setErrorMessage("Failed to send: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Helper function to trigger reconnection
  const attemptReconnect = () => {
    if (isConnected) {
      setIsConnected(false);
    }
    setReconnectAttempts(prev => prev + 1);
  };

  const cancelImageSelection = () => {
    setSelectedImage(null);
    setSelectedImagePreview(null);
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

  const handleImageButtonClick = () => {
    if (!isConnected) {
      setErrorMessage("Not connected to the server. Please refresh the page.");
      return;
    }
    fileInputRef.current.click();
  };

  return (
    <div className="flex min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="flex w-full flex-col p-2 sm:p-4 md:p-6 lg:px-8">
        <h1 className="mb-4 md:mb-6 text-center text-2xl sm:text-3xl font-bold text-blue-400">
          Chat App
        </h1>
        
        {/* Show connection status */}
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
            {errorMessage}
            <button 
              onClick={() => setErrorMessage("")}
              className="float-right font-bold"
            >×</button>
          </div>
        )}
        
        {/* Connection status indicator */}
        <div className="flex items-center mb-2">
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-gray-500">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        {!username ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-md space-y-6 p-6 bg-white rounded-xl border-2 border-gray-100">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-700">Welcome to ChatApp</h2>
                <p className="mt-2 text-sm text-gray-500">Connect with people from around the world</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Choose a username</label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={tempUsername}
                    onChange={(e) => setTempUsername(e.target.value)}
                    onKeyDown={handleEnterKey}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                    autoFocus
                  />
                  {tempUsername.trim().length > 0 && tempUsername.trim().length < 2 && (
                    <p className="mt-1 text-sm text-red-500">Username must be at least 2 characters</p>
                  )}
                </div>
                
                <button
                  onClick={handleJoin}
                  className="w-full rounded-lg bg-blue-400 px-6 py-3 font-semibold text-white hover:bg-blue-500 transform transition-all hover:scale-[1.02] active:scale-95 border-b-4 border-blue-500 hover:border-blue-600"
                  disabled={tempUsername.trim().length < 2}
                >
                  Join Chat
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col h-[calc(100vh-120px)]">
            <div className="flex-1 overflow-y-auto rounded-lg bg-gray-50 border border-gray-200 p-3 md:p-4 mb-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isUser = msg.user === username;
                  const prevMessage = messages[index - 1];
                  const showUsername = !prevMessage || prevMessage.user !== msg.user;
                  const isSameUser = prevMessage?.user === msg.user;
                  const isFirstMessage = index === 0;
                  const isImage = msg.type === "image";

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
                      <div className={`max-w-[75%] md:max-w-[65%] lg:max-w-[55%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                        {showUsername && (
                          <span className={`text-sm mb-1 ${isUser ? "text-blue-400 font-medium" : "text-gray-500"}`}>
                            {msg.user}
                          </span>
                        )}
                        {isImage ? (
                          <div className={`rounded-lg overflow-hidden border ${isUser ? "rounded-br-none border-blue-200" : "rounded-bl-none border-gray-200"}`}>
                            <img
                              src={msg.text}
                              alt={`Image from ${msg.user}`}
                              className="max-w-full h-auto"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div
                            className={`rounded-2xl p-3 ${
                              isUser
                                ? "bg-blue-400 text-white rounded-br-none border-b-2 border-blue-500"
                                : "bg-white border border-gray-200 rounded-bl-none"
                            } ${!showUsername && "mt-1"}`}
                          >
                            <p className={isUser ? "text-white" : "text-gray-800"}>{msg.text}</p>
                          </div>
                        )}
                        {/* Add timestamp if needed */}
                        {/*
                        <span className="text-xs text-gray-400 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        */}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Image preview section */}
            {selectedImagePreview && (
              <div className="mb-4 p-3 bg-gray-100 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Image preview:</span>
                  <button 
                    onClick={cancelImageSelection}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="relative">
                  <img 
                    src={selectedImagePreview} 
                    alt="Selected" 
                    className="w-full max-h-32 object-contain rounded" 
                  />
                  <button
                    onClick={sendSelectedImage}
                    disabled={isUploading}
                    className="absolute bottom-2 right-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 border border-blue-600"
                  >
                    {isUploading ? (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2 bg-white border-2 border-gray-100 p-2 rounded-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    selectImage(e.target.files[0]);
                    e.target.value = null; // Reset input after selecting a file
                  }
                }}
                className="hidden"
              />
              <button
                onClick={handleImageButtonClick}
                disabled={isUploading}
                className="rounded-lg bg-gray-100 hover:bg-gray-200 px-3 py-2 text-gray-700 transform transition-all hover:scale-105 active:scale-95 flex items-center justify-center border border-gray-200"
                title="Select image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </button>
              <input
                type="text"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="flex-1 rounded-lg border-2 border-gray-200 px-4 py-2 text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 transition-all outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="rounded-lg bg-blue-400 border border-blue-500 px-4 py-2 text-white hover:bg-blue-500 transform transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;