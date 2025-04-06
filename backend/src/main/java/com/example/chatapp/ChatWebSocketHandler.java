package com.example.chatapp;

import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.BinaryMessage;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.Set;
import java.util.HashSet;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

public class ChatWebSocketHandler extends TextWebSocketHandler {
    private static final Set<WebSocketSession> sessions = new CopyOnWriteArraySet<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<String, Set<String>> processedMessages = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        System.out.println("New connection established: " + session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        try {
            // Parse the message to check for duplicates
            JsonNode jsonNode = objectMapper.readTree(message.getPayload());
            String messageId = null;
            String sender = null;
            
            // Extract message ID and sender
            if (jsonNode.has("id")) {
                messageId = jsonNode.get("id").asText();
            }
            if (jsonNode.has("user")) {
                sender = jsonNode.get("user").asText();
            }
            
            // Add server timestamp if not present
            if (jsonNode.has("serverTimestamp") == false) {
                ((ObjectNode) jsonNode).put("serverTimestamp", System.currentTimeMillis());
            }
            
            // Recreate the message with any server-side additions
            String finalMessage = objectMapper.writeValueAsString(jsonNode);
            
            // Deduplication logic
            if (messageId != null && sender != null) {
                // Get or create the set of processed messages for this sender
                Set<String> processed = processedMessages.computeIfAbsent(sender, k -> new HashSet<>());
                
                // Check if we've seen this message before
                if (processed.contains(messageId)) {
                    System.out.println("Duplicate message detected, not forwarding: " + messageId);
                    return;
                }
                
                // Add to processed set
                processed.add(messageId);
                
                // Limit size of processed set
                if (processed.size() > 100) {
                    // This is not efficient but works for this example
                    processed.clear(); 
                }
            }
            
            // Forward the message to all clients
            TextMessage finalTextMessage = new TextMessage(finalMessage);
            for (WebSocketSession s : sessions) {
                if (s.isOpen()) {
                    s.sendMessage(finalTextMessage);
                }
            }
            
        } catch (Exception e) {
            System.err.println("Error handling message: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        System.out.println("Connection closed: " + session.getId());
    }
}
