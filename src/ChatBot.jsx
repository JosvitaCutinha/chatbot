// Import React hooks and system instructions
import React, { useState, useEffect } from "react";
import { SYSTEM_INSTRUCTIONS, WELCOME_MESSAGE } from "./systemInstructions";

/**
 * ChatBot Component - Main chatbot interface
 * This component handles the entire chat functionality including:
 * - Managing conversation state
 * - Sending messages to AI API
 * - Displaying chat history
 * - User input handling
 */
const ChatBot = () => {
  // STATE MANAGEMENT
  // ================

  // chatHistory: Array that stores all messages (user and AI responses)
  // Each message has: { role: "user" | "model", parts: [{ text: "message content" }] }
  const [chatHistory, setChatHistory] = useState([
    { role: "model", parts: [{ text: WELCOME_MESSAGE }] },
  ]);

  // userInput: Current text the user is typing
  const [userInput, setUserInput] = useState("");

  // isLoading: Boolean to show loading animation while waiting for AI response
  const [isLoading, setIsLoading] = useState(false);

  // SIDE EFFECTS
  // ============

  // Auto-scroll to bottom when new messages are added
  // This ensures users always see the latest message
  useEffect(() => {
    const chatContainer = document.getElementById("chat-messages");
    if (chatContainer) {
      // scrollTop = scrollHeight moves scroll to the very bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [chatHistory]); // Runs every time chatHistory changes

  // API INTEGRATION
  // ===============

  /**
   * callGeminiApi - Sends user message to Google's Gemini AI API
   * @param {string} prompt - The user's message
   * @param {Array} currentChatHistory - Current conversation history
   *
   * This function:
   * 1. Adds user message to chat history
   * 2. Sends request to Gemini API with system instructions
   * 3. Processes the AI response
   * 4. Updates chat history with AI response
   * 5. Handles errors gracefully
   */
  const callGeminiApi = async (prompt, currentChatHistory) => {
    // Step 1: Add user's message to chat history immediately
    // This provides instant feedback to the user
    const updatedChatHistory = [
      ...currentChatHistory, // Spread existing messages
      { role: "user", parts: [{ text: prompt }] }, // Add new user message
    ];
    setChatHistory(updatedChatHistory);

    // Step 2: Set up API configuration
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY; // Google Gemini API key from environment

    // Debug logging
    console.log("API Key exists:", !!API_KEY);
    console.log("API Key length:", API_KEY ? API_KEY.length : 0);

    // Check if API key is configured
    if (!API_KEY) {
      setChatHistory((prevHistory) => [
        ...prevHistory,
        {
          role: "model",
          parts: [{ text: "API key not configured. Please check your .env file." }],
        },
      ]);
      return;
    }

    // Step 3: Prepare the payload for the API request
    const payload = {
      contents: updatedChatHistory, // Send entire conversation for context
      systemInstruction: {
        // System instructions define how the AI should behave
        parts: [{ text: SYSTEM_INSTRUCTIONS }],
      },
    };

    // Step 4: Construct the API endpoint URL
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    try {
      // Step 5: Make the HTTP POST request to Gemini API
      console.log("Making API request to:", apiUrl.substring(0, 100) + "...");
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), // Convert payload to JSON string
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      // Step 6: Check if the request was successful
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error: ${response.status} - ${errorText}`);
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }

      // Step 7: Parse the JSON response from the API
      const result = await response.json();

      // Step 8: Extract the AI's response from the complex response structure
      // Gemini API returns a nested structure, so we need to navigate through it
      if (
        result.candidates &&
        result.candidates.length > 0 &&
        result.candidates[0].content &&
        result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0
      ) {
        // Successfully got AI response - add it to chat history
        const text = result.candidates[0].content.parts[0].text;
        setChatHistory((prevHistory) => [
          ...prevHistory,
          { role: "model", parts: [{ text: text }] },
        ]);
      } else {
        // API returned unexpected format - show error message
        setChatHistory((prevHistory) => [
          ...prevHistory,
          {
            role: "model",
            parts: [{ text: "Sorry, I couldn't generate a response." }],
          },
        ]);
      }
    } catch (error) {
      // Step 9: Handle any network or API errors
      console.error("API Error details:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      let errorMessage = "Connection error. Please try again.";

      // Provide more specific error messages
      if (error.message.includes('404')) {
        errorMessage = "API endpoint not found. Please check if the Gemini API is enabled for your key.";
      } else if (error.message.includes('403')) {
        errorMessage = "API key invalid or access denied. Please check your API key.";
      } else if (error.message.includes('429')) {
        errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
      }

      setChatHistory((prevHistory) => [
        ...prevHistory,
        {
          role: "model",
          parts: [{ text: errorMessage }],
        },
      ]);
    }
  };

  // USER INTERACTION HANDLERS
  // =========================

  /**
   * sendMessage - Handles sending user messages
   * This function:
   * 1. Validates the message (not empty, not currently loading)
   * 2. Clears the input field
   * 3. Sets loading state
   * 4. Calls the API
   * 5. Handles any errors
   * 6. Resets loading state
   */
  const sendMessage = async () => {
    // Step 1: Clean and validate the message
    const message = userInput.trim(); // Remove whitespace from start/end
    if (!message || isLoading) return; // Don't send empty messages or if already loading

    // Step 2: Clear input field immediately for better UX
    setUserInput("");

    // Step 3: Show loading animation
    setIsLoading(true);

    try {
      // Step 4: Send message to AI API
      await callGeminiApi(message, chatHistory);
    } catch (error) {
      // Step 5: Handle any unexpected errors
      console.error("Send message error:", error);
      setChatHistory((prevHistory) => [
        ...prevHistory,
        {
          role: "model",
          parts: [{ text: "Error occurred. Please try again." }],
        },
      ]);
    } finally {
      // Step 6: Always hide loading animation (even if error occurred)
      setIsLoading(false);
    }
  };

  /**
   * handleKeyDown - Handles keyboard input in the text field
   * Allows users to send messages by pressing Enter
   * Shift+Enter allows multi-line messages (though we use input, not textarea)
   */
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent default Enter behavior
      sendMessage(); // Send the message
    }
  };

  // RENDER UI COMPONENTS
  // ====================

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Main chat container with styling */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200">
        {/* HEADER SECTION */}
        <div className="bg-blue-600 text-white p-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">AI Chatbot Demo</h2>
          <p className="text-blue-100 text-sm">Ask me how chatbots work!</p>
        </div>

        {/* Chat Messages */}
        <div
          id="chat-messages"
          className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50"
        >
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"
                }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-800 border border-gray-200"
                  }`}
              >
                {msg.parts[0].text}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white text-gray-800 px-4 py-2 rounded-lg border border-gray-200">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Type your message here..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !userInput.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export the ChatBot component so it can be imported and used in other files
export default ChatBot;
