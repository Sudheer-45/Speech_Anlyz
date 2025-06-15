import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

// IMPORTANT: Replace with your actual Render backend URL
const RENDER_BACKEND_URL = "https://comm-analyzer.onrender.com"; 

function Chatbot() {
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

    // Initial welcome message
    useEffect(() => {
        setMessages([
            { sender: 'bot', text: "Hello! I'm your Comm Analyzer Chatbot. Ask me anything about communication, grammar, or tips to improve your speaking skills!" }
        ]);
    }, []);

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
        <div className="chatbot-container p-4 flex flex-col h-[600px] max-w-md mx-auto bg-white rounded-lg shadow-xl border border-gray-200"
             style={{ fontFamily: 'Inter, sans-serif' }}>
            <h2 className="text-2xl font-bold mb-4 text-center text-blue-700">Comm Chatbot</h2>
            <div className="messages-display flex-grow overflow-y-auto p-3 mb-4 space-y-3 bg-gray-50 rounded-lg border border-gray-100">
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
            <form onSubmit={handleSendMessage} className="message-input-form flex">
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
