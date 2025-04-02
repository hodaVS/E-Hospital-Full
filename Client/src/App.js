import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FaMicrophone, FaStopCircle, FaPlayCircle, FaCheckCircle, FaSave } from 'react-icons/fa';
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
    status,
    startRecording,
    stopRecording,
    mediaBlobUrl,
    error: recorderError
  } = useReactMediaRecorder({
    audio: true,
    onStop: async (blobUrl) => {
      try {
        console.log('Recording stopped, blob URL:', blobUrl);
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        setAudioBlob(blob);
        console.log('Blob created successfully:', blob);
      } catch (err) {
        console.error("Blob conversion failed:", err);
        setError("Failed to process recording");
      }
    },
    onStart: () => {
      console.log('Recording started');
    }
  });

  useEffect(() => {
    if (recorderError) {
      console.error("Recording error:", recorderError);
      setError(`Recording error: ${recorderError}`);
    }
  }, [recorderError]);

  useEffect(() => {
    console.log('Current status:', status);
  }, [status]);

  useEffect(() => {
    console.log('Prescription state updated:', prescription);
  }, [prescription]);

  const requestMicPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (err) {
      console.error('Microphone permission denied:', err);
      setError('Please allow microphone access to record audio');
      return false;
    }
  };

  const handleTextSubmit = async (e) => {
  e.preventDefault();
  setError(null);
  setIsLoading(true);

  try {
    const response = await axios.post(
      'https://e-hospital-prescription-294a0e858fcd.herokuapp.com/chat',
      { text: input },
      { headers: { 'Content-Type': 'application/json' } }
    );

    console.log("Text response:", response.data);  // Logs the prescription object
    if (response.data.error) {
      setError(response.data.error);
      return;
    }

    setPrescription(response.data);  // Set directly from response.data
    setInput('');
  } catch (error) {
    console.error("Error sending message:", error);
    setError(error.response?.data?.detail || "Failed to send message");
  } finally {
    setIsLoading(false);
  }
};

  const handleRecording = async () => {
    if (status === 'recording') {
      console.log('Stopping recording');
      stopRecording();
    } else {
      console.log('Attempting to start recording');
      const hasPermission = await requestMicPermission();
      if (hasPermission) {
        startRecording();
        setAudioBlob(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
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

    setError(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      const audioFile = new File([audioBlob], 'recording.wav', {
        type: 'audio/wav',
        lastModified: Date.now()
      });
      formData.append('audio', audioFile);

      const response = await axios.post(
        'https://e-hospital-prescription-294a0e858fcd.herokuapp.com/transcribe_stream',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000
        }
      );

      console.log("Audio response:", response.data);
      response.data.logs.forEach(log => console.log("Server log:", log));

      if (response.data.error) {
        setError(`${response.data.error}: ${response.data.details || 'No details provided'}`);
        return;
      }

      setPrescription(response.data.response);
    } catch (error) {
      console.error("Submission failed:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      if (error.response?.data?.logs) {
        console.log("Server logs (error case):");
        error.response.data.logs.forEach(log => console.log(log));
      }
      const errorMessage = error.response?.data?.error
        ? `${error.response.data.error}: ${error.response.data.details || ''}`
        : "Audio submission failed";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!prescription) {
      setError("No prescription to save.");
      return;
    }

    try {
      const response = await axios.post(
        'https://e-hospital-prescription-294a0e858fcd.herokuapp.com/save_prescription',
        { prescription: prescription },
        { headers: { 'Content-Type': 'application/json' } }
      );

      console.log("Save response:", response.data);
      alert(response.data.message || "Prescription saved successfully!");
    } catch (error) {
      console.error("Failed to save prescription:", error.response?.data);
      setError(error.response?.data?.error || "Failed to save prescription");
    }
  };

  return (
    <div className="app-container">
      <h1>Prescription Chatbot</h1>
      {error && <div className="error-message">{error}</div>}

      <form className="form-container" onSubmit={handleTextSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
        />
        <button type="submit">Send</button>
      </form>

      <div className="recording-controls">
        <button
          onClick={handleRecording}
          className={`recording-button ${status === 'recording' ? 'recording' : ''}`}
        >
          {status === 'recording' ? (
            <>
              <FaStopCircle /> Stop Recording
            </>
          ) : (
            <>
              <FaMicrophone /> Start Recording
            </>
          )}
        </button>
        
        {status === 'recording' && (
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
          <div className="audio-controls">
            <audio
              src={mediaBlobUrl}
              ref={audioRef}
              onEnded={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />
            <div className="audio-buttons">
              <button
                onClick={handlePlayback}
                disabled={!mediaBlobUrl}
              >
                {isPlaying ? <FaStopCircle /> : <FaPlayCircle />}
                {isPlaying ? 'Stop Playback' : 'Play Audio'}
              </button>
              <button
                onClick={handleAudioSubmit}
                disabled={!audioBlob || isLoading}
              >
                <FaCheckCircle />
                {isLoading ? 'Submitting...' : 'Submit Audio'}
              </button>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}

      {prescription && (
        <div className="prescription-section">
          <h2 className="prescription-title">Prescriptions</h2>
          {prescription.Prescriptions && Array.isArray(prescription.Prescriptions) ? (
            <div>
              {prescription.Prescriptions.map((item, index) => (
                <table key={index} className="prescription-table">
                  <thead>
                    <tr>
                      <th colSpan="2">Prescription {index + 1}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Diagnosis</td>
                      <td>{item.DiagnosisInformation.Diagnosis || 'None'}</td>
                    </tr>
                    <tr>
                      <td>Medicine</td>
                      <td>{item.DiagnosisInformation.Medicine || 'None'}</td>
                    </tr>
                    <tr>
                      <td>Dose</td>
                      <td>{item.MedicationDetails.Dose || 'None'} {item.MedicationDetails.DoseUnit || ''}</td>
                    </tr>
                    <tr>
                      <td>Route</td>
                      <td>{item.MedicationDetails.DoseRoute || 'None'}</td>
                    </tr>
                    <tr>
                      <td>Frequency</td>
                      <td>{item.MedicationDetails.Frequency || 'None'} for {item.MedicationDetails.FrequencyDuration || 'None'} {item.MedicationDetails.FrequencyUnit || ''}</td>
                    </tr>
                    <tr>
                      <td>Quantity</td>
                      <td>{item.MedicationDetails.Quantity || 'None'} {item.MedicationDetails.QuantityUnit || ''}</td>
                    </tr>
                    <tr>
                      <td>Refills</td>
                      <td>{item.MedicationDetails.Refill || 'None'}</td>
                    </tr>
                    <tr>
                      <td>Pharmacy</td>
                      <td>{item.MedicationDetails.Pharmacy || 'None'}</td>
                    </tr>
                    <tr>
                      <td>Description</td>
                      <td>{item.Description || 'None'}</td>
                    </tr>
                  </tbody>
                </table>
              ))}
              <button className="save-button" onClick={handleSave}>
                <FaSave /> Save Prescription
              </button>
            </div>
          ) : (
            <p style={{ textAlign: 'center' }}>No valid prescriptions available.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
