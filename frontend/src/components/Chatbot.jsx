// frontend/src/components/Chatbot.jsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
// Optional: If you use Lucide-React for icons, you can import X for close button
// import { X } from 'lucide-react'; 

// IMPORTANT: Replace with your actual Render backend URL
const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com"; 

function Chatbot({ isVisible, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null); // Ref for scrolling to bottom

    // Scroll to the latest message
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]); // Scroll whenever messages change

    // Initial welcome message only when visible
    useEffect(() => {
        if (isVisible && messages.length === 0) { // Only add if visible and no messages yet
            setMessages([
                { sender: 'bot', text: "Hello! I'm your Comm Analyzer Chatbot. Ask me anything about communication, grammar, or tips to improve your speaking skills!" }
            ]);
        }
        // Clear messages when chatbot closes, so it's fresh next time it opens
        if (!isVisible) {
            setMessages([]);
            setInput('');
            setIsLoading(false);
        }
    }, [isVisible]);

    if (!isVisible) {
        return null; // Don't render anything if not visible
    }

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (input.trim() === '') return;

        const userMessage = { sender: 'user', text: input.trim() };
        setMessages((prevMessages) => [...prevMessages, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token'); // Get the user's authentication token
            if (!token) {
                setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: "Please log in to use the chatbot." }]);
                setIsLoading(false);
                return;
            }

            const response = await axios.post(
                `${RENDER_BACKEND_URL}/api/chatbot/message`, // Your new backend endpoint
                { message: input.trim() },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const botResponse = { sender: 'bot', text: response.data.reply };
            setMessages((prevMessages) => [...prevMessages, botResponse]);

        } catch (error) {
            console.error('Error sending message to chatbot backend:', error);
            const errorMessage = error.response?.data?.message || 'Sorry, I am having trouble connecting right now. Please try again later.';
            setMessages((prevMessages) => [...prevMessages, { sender: 'bot', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div 
            className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            style={{ 
                width: '380px', // Fixed width
                height: '500px', // Fixed height
                fontFamily: 'Inter, sans-serif' 
            }}
        >
            <div className="flex justify-between items-center bg-blue-700 text-white p-3 rounded-t-lg shadow-md">
                <h2 className="text-xl font-bold">Comm Chatbot</h2>
                <button 
                    onClick={onClose} 
                    className="text-white hover:bg-blue-600 rounded-full p-1 transition-colors duration-200"
                    aria-label="Close Chatbot"
                >
                    {/* If you have lucide-react installed, uncomment this: <X size={20} /> */}
                    {/* Otherwise, use a simple 'X' */}
                    &times; {/* HTML entity for 'times' or 'x' character */}
                </button>
            </div>
            <div className="messages-display flex-grow overflow-y-auto p-3 space-y-3 bg-gray-50 border-b border-gray-100">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block p-2 rounded-lg ${
                            msg.sender === 'user' 
                                ? 'bg-blue-500 text-white break-words max-w-[80%]' 
                                : 'bg-gray-200 text-gray-800 break-words max-w-[80%]'
                        }`}>
                            {msg.text}
                        </span>
                    </div>
                ))}
                {isLoading && (
                    <div className="message text-left">
                        <span className="inline-block p-2 rounded-lg bg-gray-200 text-gray-800 animate-pulse">
                            Typing...
                        </span>
                    </div>
                )}
                <div ref={messagesEndRef} /> {/* For scrolling */}
            </div>
            <form onSubmit={handleSendMessage} className="message-input-form flex p-3 border-t border-gray-200 bg-white">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-grow p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-3 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading || input.trim() === ''}
                >
                    Send
                </button>
            </form>
        </div>
    );
}

export default Chatbot;
