// frontend/src/components/ChatInterface.jsx
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { Send, User, Bot, Loader2, BookOpen } from 'lucide-react';

export default function ChatInterface({ userProfile }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom() }, [messages, isTyping]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Hit your massive backend pipeline
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiUrl}/api/chat/message`, {
        userId: userProfile._id,
        message: userMessage.content
      });

      if (response.data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.data.response,
          sources: response.data.sources
        }]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '⚠️ Error connecting to the Curalink server. Please try again.' 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      
      {/* SIDEBAR: Context Display */}
      <div className="w-1/4 bg-white border-r border-slate-200 p-6 flex flex-col">
        <h2 className="text-xl font-bold text-medical-dark mb-6 flex items-center gap-2">
          <BookOpen className="text-medical-primary" />
          Curalink AI
        </h2>
        
        <div className="bg-medical-light rounded-xl p-4 border border-blue-100">
          <h3 className="text-xs uppercase tracking-wider text-slate-500 font-bold mb-3">Active Patient Context</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-400">Patient Name</p>
              <p className="font-medium">{userProfile.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Disease of Interest</p>
              <p className="font-bold text-medical-primary">{userProfile.diseaseOfInterest}</p>
            </div>
            {userProfile.location && (
              <div>
                <p className="text-xs text-slate-400">Location</p>
                <p className="font-medium">{userProfile.location}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col">
        
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="text-center text-slate-400 mt-20">
              <Bot size={48} className="mx-auto mb-4 opacity-50 text-medical-primary" />
              <p className="text-lg font-medium">Context initialized for {userProfile.diseaseOfInterest}.</p>
              <p>How can I assist your research today?</p>
            </div>
          )}

          {/* Map through chat messages */}
          {messages.map((msg, index) => (
            <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-medical-dark text-white order-last' : 'bg-medical-primary text-white'}`}>
                {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
              </div>

              {/* Message Bubble */}
              <div className={`max-w-3xl rounded-2xl p-5 ${msg.role === 'user' ? 'bg-medical-dark text-white' : 'bg-white shadow-sm border border-slate-200'}`}>
                
                {/* Markdown Renderer for AI Responses */}
                <div className={msg.role === 'user' ? '' : 'prose prose-blue max-w-none'}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>

                {/* Sources Renderer (Only for AI) */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Verified Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        <a 
                          key={idx} 
                          href={source.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-xs bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full hover:bg-medical-light hover:text-medical-dark hover:border-medical-primary transition-colors flex items-center gap-1"
                        >
                          <span className="font-bold">{source.sourceType}</span> | {source.title.substring(0, 30)}...
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isTyping && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-medical-primary text-white flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-5 flex items-center gap-3">
                <Loader2 className="animate-spin text-medical-primary" size={20} />
                <span className="text-slate-500 font-medium">Retrieving studies, ranking data, and reasoning...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className="p-6 bg-white border-t border-slate-200">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about treatments, trials, or research for ${userProfile.diseaseOfInterest}...`}
              className="w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-300 rounded-full focus:ring-2 focus:ring-medical-primary focus:outline-none text-slate-700 shadow-inner"
              disabled={isTyping}
            />
            <button 
              type="submit" 
              disabled={isTyping || !input.trim()}
              className="absolute right-2 p-3 bg-medical-primary text-white rounded-full hover:bg-medical-dark transition-colors disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
        
      </div>
    </div>
  );
}