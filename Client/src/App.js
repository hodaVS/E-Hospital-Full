import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FaMicrophone, FaStopCircle, FaPlayCircle, FaCheckCircle } from 'react-icons/fa';
import './App.css';

function App() {
  const [input, setInput] = useState('');
  const [prescription, setPrescription] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const audioRef = useRef(null);

  const {
    startRecording,
    stopRecording,
    mediaBlobUrl,
    isRecording,
    error: recorderError
  } = useReactMediaRecorder({
    audio: true,
    onStop: async (blobUrl) => {
      try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        setAudioBlob(blob);
      } catch (err) {
        console.error("Blob conversion failed:", err);
        setError("Failed to process recording");
      }
    }
  });

  useEffect(() => {
    if (recorderError) {
      console.error("Recording error:", recorderError);
      setError(`Recording error: ${recorderError}`);
    }
  }, [recorderError]);

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await axios.post(
        'https://e-hospital-full.onrender.com/chat',
        { text: input },
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      setPrescription(response.data.response);
      setInput('');
    } catch (error) {
      console.error("Error sending message:", error);
      setError(error.response?.data?.message || "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
      setAudioBlob(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  };

  const handlePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioSubmit = async () => {
    if (!audioBlob) {
      setError("No audio recorded. Please record again.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      const audioFile = new File([audioBlob], 'recording.wav', {
        type: 'audio/wav',
        lastModified: Date.now()
      });
      formData.append('audio', audioFile);

      const response = await axios.post(
        'https://e-hospital-full.onrender.com/transcribe',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000
        }
      );

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      setPrescription(response.data.response);
    } catch (error) {
      console.error("Error sending audio:", {
        error: error.message,
        response: error.response?.data
      });
      setError(error.response?.data?.message || "Audio submission failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#007bff', marginBottom: '20px' }}>Chatbot</h1>
      {error && <div style={{ color: 'red', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}

      <form onSubmit={handleTextSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          style={{ flex: 1, padding: '10px', fontSize: '16px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '10px 20px', fontSize: '16px', borderRadius: '5px', border: 'none', backgroundColor: '#007bff', color: '#fff', cursor: 'pointer' }}>
          Send
        </button>
      </form>

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <button
          onClick={handleRecording}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px', 
            borderRadius: '5px', 
            border: 'none', 
            backgroundColor: isRecording ? '#dc3545' : '#007bff', 
            color: '#fff', 
            cursor: 'pointer', 
            marginBottom: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            transition: 'background-color 0.3s ease'
          }}
        >
          {isRecording ? (
            <>
              <FaStopCircle /> Stop Recording
            </>
          ) : (
            <>
              <FaMicrophone /> Start Recording
            </>
          )}
        </button>
        
        {isRecording && (
          <div style={{ 
            height: '100px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '5px', 
            marginBottom: '10px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            animation: 'pulse 2s infinite'
          }}>
            <div style={{ color: '#007bff' }}>Recording in progress...</div>
          </div>
        )}

        {mediaBlobUrl && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
            <audio
              src={mediaBlobUrl}
              ref={audioRef}
              onEnded={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handlePlayback}
                disabled={!mediaBlobUrl}
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '16px', 
                  borderRadius: '5px', 
                  border: 'none', 
                  backgroundColor: '#28a745', 
                  color: '#fff', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  opacity: mediaBlobUrl ? 1 : 0.7
                }}
              >
                {isPlaying ? <FaStopCircle /> : <FaPlayCircle />}
                {isPlaying ? 'Stop Playback' : 'Play Audio'}
              </button>
              <button
                onClick={handleAudioSubmit}
                disabled={!audioBlob || isLoading}
                style={{ 
                  padding: '10px 20px', 
                  fontSize: '16px', 
                  borderRadius: '5px', 
                  border: 'none', 
                  backgroundColor: '#28a745', 
                  color: '#fff', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  opacity: (audioBlob && !isLoading) ? 1 : 0.7
                }}
              >
                <FaCheckCircle />
                {isLoading ? 'Submitting...' : 'Submit Audio'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}

      {prescription && prescription.Prescriptions.map((prescription, index) => (
        <div key={index} style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#fff', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
          {/* Prescription rendering remains the same */}
        </div>
      ))}
    </div>
  );
}

export default App;
