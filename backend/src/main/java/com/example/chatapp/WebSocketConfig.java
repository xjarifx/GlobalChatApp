package com.example.chatapp;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new ChatWebSocketHandler(), "/chat")
               .setAllowedOrigins("*");
    }
    
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        
        // Lower message size to avoid overwhelming the server
        container.setMaxTextMessageBufferSize(512 * 1024); // 512KB text message
        container.setMaxBinaryMessageBufferSize(512 * 1024); // 512KB binary message
        
        // Increase timeouts for better stability
        // container.setAsyncSendTimeout(60000); // 60 seconds
        container.setMaxSessionIdleTimeout(120000L); // 120 seconds
        
        return container;
    }
}