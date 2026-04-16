// frontend/src/components/PatientSetup.jsx
import { useState } from 'react';
import axios from 'axios';
import { Activity } from 'lucide-react'; // Cool medical icon

export default function PatientSetup({ onComplete }) {
  const [formData, setFormData] = useState({
    name: '',
    diseaseOfInterest: '',
    location: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Send the data to our new Node backend route
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${apiUrl}/api/users/setup`, formData);
      if (response.data.success) {
        // Pass the MongoDB user object up to App.jsx
        onComplete(response.data.user); 
      }
    } catch (error) {
      console.error("Failed to setup patient:", error);
      alert("Error setting up profile. Is your backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-medical-light p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        
        <div className="flex items-center justify-center mb-6 text-medical-primary">
          <Activity size={48} />
        </div>
        
        <h1 className="text-2xl font-bold text-center text-medical-dark mb-2">Curalink Setup</h1>
        <p className="text-center text-slate-500 mb-8">Initialize Patient Research Context</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Patient Name</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:outline-none"
              placeholder="e.g. John Smith"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Disease of Interest</label>
            <input 
              type="text" 
              required
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:outline-none"
              placeholder="e.g. Parkinson's disease"
              value={formData.diseaseOfInterest}
              onChange={(e) => setFormData({...formData, diseaseOfInterest: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location (Optional)</label>
            <input 
              type="text" 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-primary focus:outline-none"
              placeholder="e.g. Toronto, Canada"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-medical-primary text-white font-bold py-3 px-4 rounded-lg hover:bg-medical-dark transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Initializing Context...' : 'Start Research Session'}
          </button>
        </form>
      </div>
    </div>
  );
}