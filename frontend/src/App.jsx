// frontend/src/App.jsx
import { useState } from 'react';
import PatientSetup from './components/PatientSetup';
import ChatInterface from './components/ChatInterface';

function App() {
  // We store the user profile here once they complete the setup form
  const [userProfile, setUserProfile] = useState(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      {/* If no user profile exists, show the setup screen. Otherwise, show the chat. */}
      {!userProfile ? (
        <PatientSetup onComplete={setUserProfile} />
      ) : (
        <ChatInterface userProfile={userProfile} />
      )}
    </div>
  );
}

export default App;