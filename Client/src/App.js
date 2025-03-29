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
    clearBlobUrl,
    isRecording,
    error: recorderError
  } = useReactMediaRecorder({
    audio: true,
    onStop: (blobUrl, blob) => {
      if (blob) {
        setAudioBlob(blob);
      } else {
        fetch(blobUrl)
          .then(res => res.blob())
          .then(blob => setAudioBlob(blob))
          .catch(err => {
            console.error("Blob conversion error:", err);
            setError("Failed to process recording");
          });
      }
    }
  });

  useEffect(() => {
    if (recorderError) {
      console.error("Recording error:", recorderError);
      setError(`Recording error: ${recorderError.message}`);
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
      setError("Failed to send message. Please try again.");
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
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await axios.post(
        'https://e-hospital-full.onrender.com/transcribe',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.error) {
        setError(response.data.error);
        return;
      }

      setPrescription(response.data.response);
    } catch (error) {
      console.error("Error sending audio:", error);
      setError("Failed to send audio. Please try again.");
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
          style={{ padding: '10px 20px', fontSize: '16px', borderRadius: '5px', border: 'none', backgroundColor: isRecording ? '#dc3545' : '#007bff', color: '#fff', cursor: 'pointer', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}
        >
          {isRecording ? <FaStopCircle /> : <FaMicrophone />}
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
        
        {isRecording && (
          <div style={{ height: '100px', backgroundColor: '#f5f5f5', borderRadius: '5px', marginBottom: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
                style={{ padding: '10px 20px', fontSize: '16px', borderRadius: '5px', border: 'none', backgroundColor: '#28a745', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                {isPlaying ? <FaStopCircle /> : <FaPlayCircle />}
                {isPlaying ? 'Stop Playback' : 'Play Audio'}
              </button>
              <button
                onClick={handleAudioSubmit}
                style={{ padding: '10px 20px', fontSize: '16px', borderRadius: '5px', border: 'none', backgroundColor: '#28a745', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <FaCheckCircle />
                Submit Audio
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
          <h2 style={{ textAlign: 'center', color: '#007bff', marginBottom: '20px' }}>Prescription {index + 1}</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>Diagnosis Information</h3>
            <p><strong>Diagnosis:</strong> {prescription.DiagnosisInformation.Diagnosis || "None"}</p>
            <p><strong>Medicine:</strong> {prescription.DiagnosisInformation.Medicine || "None"}</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>Medication Details</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Dose</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Dose Unit</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Dose Route</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Frequency</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Frequency Duration</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Frequency Unit</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Quantity</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Quantity Unit</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Refill</th>
                    <th style={{ border: '1px solid #ccc', padding: '10px', backgroundColor: '#007bff', color: '#fff' }}>Pharmacy</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.Dose || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.DoseUnit || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.DoseRoute || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.Frequency || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.FrequencyDuration || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.FrequencyUnit || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.Quantity || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.QuantityUnit || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.Refill || "None"}</td>
                    <td style={{ border: '1px solid #ccc', padding: '10px', textAlign: 'center' }}>{prescription.MedicationDetails.Pharmacy || "None"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#007bff', borderBottom: '2px solid #007bff', paddingBottom: '5px' }}>Description</h3>
            <p>{prescription.Description || "None"}</p>
          </div>

          <p style={{ textAlign: 'right', fontStyle: 'italic', color: '#555' }}>
            <strong>Creation Time:</strong> {new Date().toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

export default App;
