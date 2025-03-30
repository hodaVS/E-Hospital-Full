from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from openai import OpenAI
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

app = Flask(__name__)
CORS(app)  



def transcribe_audio(file_path):
    with open(file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )
    return transcript.text

def chat_with_gpt(prompt, messages, model="gpt-4"):
    messages.append({"role": "user", "content": prompt})

    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=5000,
        temperature=0
    )
    gpt_response = completion.choices[0].message.content.strip()

    messages.append({"role": "assistant", "content": gpt_response})

    return gpt_response

conversation_history = [
    {
        "role": "system",
        "content": "You are a helpful assistant that generates prescriptions. Always return the prescription in the following JSON format: (Warn doctor in Description if you suspect any drug conflicts). If any information is missing, use 'None' as the value for that field."
                   "{ "
                   "\"Prescriptions\": [ "
                   "{ "
                   "\"DiagnosisInformation\": { \"Diagnosis\": \"<diagnosis>\", \"Medicine\": \"<medicine>\" }, "
                   "\"MedicationDetails\": { "
                   "\"Dose\": \"<dose>\", "
                   "\"DoseUnit\": \"<dose unit>\", "
                   "\"DoseRoute\": \"<dose route>\", "
                   "\"Frequency\": \"<frequency>\", "
                   "\"FrequencyDuration\": \"<frequency duration>\", "
                   "\"FrequencyUnit\": \"<frequency unit>\", "
                   "\"Quantity\": \"<quantity>\", "
                   "\"QuantityUnit\": \"<quantity unit>\", "
                   "\"Refill\": \"<refill>\", "
                   "\"Pharmacy\": \"<pharmacy>\" "
                   "}, "
                   "\"Description\": \"<description>\" "
                   "} ] "
                   "}"
    }
]

@app.route('/transcribe_stream', methods=['POST'])
def transcribe_stream():
    if 'audio' not in request.files:
        logger.error("No audio file provided")
        return jsonify({"error": "No audio file provided", "logs": ["No audio file provided"]}), 400

    audio_file = request.files['audio']
    logs = [f"Received audio file: {audio_file.filename}"]

    try:
        # Save the file temporarily to ensure compatibility
        temp_path = "temp_audio.wav"
        audio_file.save(temp_path)
        logs.append("Audio file saved to temp path")

        # Rewind the file stream (optional, for debugging)
        audio_file.seek(0)

        # Try transcription
        logger.info("Attempting Whisper transcription")
        with open(temp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f
            )
        user_input = transcript.text
        logs.append(f"Transcribed text: {user_input}")

        # Clean up temp file
        os.remove(temp_path)
        logs.append("Temporary file removed")

        # Generate prescription
        system_message = {
            "role": "system",
            "content": "You are a helpful assistant that generates prescriptions. Always return the prescription in the following JSON format: (Warn doctor in Description if you suspect any drug conflicts). If any information is missing, use 'None' as the value for that field."
                       "{ \"Prescriptions\": [ { \"DiagnosisInformation\": { \"Diagnosis\": \"<diagnosis>\", \"Medicine\": \"<medicine>\" }, \"MedicationDetails\": { \"Dose\": \"<dose>\", \"DoseUnit\": \"<dose unit>\", \"DoseRoute\": \"<dose route>\", \"Frequency\": \"<frequency>\", \"FrequencyDuration\": \"<frequency duration>\", \"FrequencyUnit\": \"<frequency unit>\", \"Quantity\": \"<quantity>\", \"QuantityUnit\": \"<quantity unit>\", \"Refill\": \"<refill>\", \"Pharmacy\": \"<pharmacy>\" }, \"Description\": \"<description>\" } ] }"
        }

        logger.info("Requesting GPT-4 completion")
        completion = client.chat.completions.create(
            model="gpt-4",  # Try "gpt-3.5-turbo" if gpt-4 fails
            messages=[system_message, {"role": "user", "content": user_input}],
            max_tokens=500,
            temperature=0.1
        )

        gpt_response = completion.choices[0].message.content.strip()
        logs.append(f"GPT-4 response: {gpt_response}")

        # Parse JSON
        try:
            gpt_response = gpt_response.replace('1-2', '"1-2"')
            prescription = json.loads(gpt_response)
            logs.append("GPT-4 response parsed as JSON")
            
            for p in prescription.get("Prescriptions", []):
                p.setdefault("DiagnosisInformation", {"Diagnosis": None, "Medicine": None})
                p.setdefault("MedicationDetails", {
                    "Dose": None, "DoseUnit": None, "DoseRoute": None,
                    "Frequency": None, "FrequencyDuration": None, "FrequencyUnit": None,
                    "Quantity": None, "QuantityUnit": None, "Refill": None, "Pharmacy": None
                })
                p.setdefault("Description", None)

            return jsonify({
                "response": prescription,
                "transcript": user_input,
                "logs": logs
            })

        except json.JSONDecodeError as e:
            logs.append(f"JSON parsing failed: {str(e)}")
            return jsonify({
                "error": "Failed to generate prescription",
                "transcript": user_input,
                "details": str(e),
                "logs": logs
            }), 500

    except Exception as e:
        logs.append(f"Audio processing failed: {str(e)}")
        return jsonify({
            "error": "Audio processing failed",
            "details": str(e),
            "logs": logs
        }), 500


@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_input = data.get('text')
    if not user_input:
        return jsonify({"error": "No text provided"}), 400

    try:
        system_message = {
            "role": "system",
            "content": "You are a helpful assistant that generates prescriptions. Always return the prescription in the following JSON format: (Warn doctor in Description if you suspect any drug conflicts). If any information is missing, use 'None' as the value for that field."
                    "{ "
                    "\"Prescriptions\": [ "
                    "{ "
                    "\"DiagnosisInformation\": { \"Diagnosis\": \"<diagnosis>\", \"Medicine\": \"<medicine>\" }, "
                    "\"MedicationDetails\": { "
                    "\"Dose\": \"<dose>\", "
                    "\"DoseUnit\": \"<dose unit>\", "
                    "\"DoseRoute\": \"<dose route>\", "
                    "\"Frequency\": \"<frequency>\", "
                    "\"FrequencyDuration\": \"<frequency duration>\", "
                    "\"FrequencyUnit\": \"<frequency unit>\", "
                    "\"Quantity\": \"<quantity>\", "
                    "\"QuantityUnit\": \"<quantity unit>\", "
                    "\"Refill\": \"<refill>\", "
                    "\"Pharmacy\": \"<pharmacy>\" "
                    "}, "
                    "\"Description\": \"<description>\" "
                    "} ] "
                    "}"
        }

        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[system_message, {"role": "user", "content": user_input}],
            max_tokens=500,  
            temperature=0.1
        )

        gpt_response = completion.choices[0].message.content.strip()
        # print("OpenAI Response:", gpt_response)  # Log the OpenAI response

        gpt_response = gpt_response.replace('1-2', '"1-2"')

        if not gpt_response.strip().endswith("}"):
            # print("OpenAI response is incomplete. Returning default response.")
            return jsonify({
                "response": {
                    "Prescriptions": [
                        {
                            "DiagnosisInformation": {"Diagnosis": None, "Medicine": None},
                            "MedicationDetails": {
                                "Dose": None,
                                "DoseUnit": None,
                                "DoseRoute": None,
                                "Frequency": None,
                                "FrequencyDuration": None,
                                "FrequencyUnit": None,
                                "Quantity": None,
                                "QuantityUnit": None,
                                "Refill": None,
                                "Pharmacy": None
                            },
                            "Description": "Please try again with proper prescription content."
                        }
                    ]
                }
            })

        try:
            prescription = json.loads(gpt_response)

            for p in prescription.get("Prescriptions", []):
                p.setdefault("DiagnosisInformation", {"Diagnosis": None, "Medicine": None})
                p.setdefault("MedicationDetails", {
                    "Dose": None,
                    "DoseUnit": None,
                    "DoseRoute": None,
                    "Frequency": None,
                    "FrequencyDuration": None,
                    "FrequencyUnit": None,
                    "Quantity": None,
                    "QuantityUnit": None,
                    "Refill": None,
                    "Pharmacy": None
                })
                p.setdefault("Description", None)

            return jsonify({"response": prescription})
        except json.JSONDecodeError as e:
            # print("Failed to parse OpenAI response as JSON. Returning default response.")
            return jsonify({
                "response": {
                    "Prescriptions": [
                        {
                            "DiagnosisInformation": {"Diagnosis": None, "Medicine": None},
                            "MedicationDetails": {
                                "Dose": None,
                                "DoseUnit": None,
                                "DoseRoute": None,
                                "Frequency": None,
                                "FrequencyDuration": None,
                                "FrequencyUnit": None,
                                "Quantity": None,
                                "QuantityUnit": None,
                                "Refill": None,
                                "Pharmacy": None
                            },
                            "Description": "Please try again with proper prescription content."
                        }
                    ]
                }
            })

    except Exception as e:
        # print("Error in /chat endpoint. Returning default response.")
        return jsonify({
            "response": {
                "Prescriptions": [
                    {
                        "DiagnosisInformation": {"Diagnosis": None, "Medicine": None},
                        "MedicationDetails": {
                            "Dose": None,
                            "DoseUnit": None,
                            "DoseRoute": None,
                            "Frequency": None,
                            "FrequencyDuration": None,
                            "FrequencyUnit": None,
                            "Quantity": None,
                            "QuantityUnit": None,
                            "Refill": None,
                            "Pharmacy": None
                        },
                        "Description": "Please try again with proper prescription content."
                    }
                ]
            }
        })


@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        file_path = "temp_recording.wav"
        file.save(file_path)

        user_input = transcribe_audio(file_path)
        # print("Transcribed Text:", user_input)

        system_message = {
            "role": "system",
            "content": "You are a helpful assistant that generates prescriptions. Always return the prescription in the following JSON format: (Warn doctor in Description if you suspect any drug conflicts). If any information is missing, use 'None' as the value for that field."
                       "{ "
                       "\"Prescriptions\": [ "
                       "{ "
                       "\"DiagnosisInformation\": { \"Diagnosis\": \"<diagnosis>\", \"Medicine\": \"<medicine>\" }, "
                       "\"MedicationDetails\": { "
                       "\"Dose\": \"<dose>\", "
                       "\"DoseUnit\": \"<dose unit>\", "
                       "\"DoseRoute\": \"<dose route>\", "
                       "\"Frequency\": \"<frequency>\", "
                       "\"FrequencyDuration\": \"<frequency duration>\", "
                       "\"FrequencyUnit\": \"<frequency unit>\", "
                       "\"Quantity\": \"<quantity>\", "
                       "\"QuantityUnit\": \"<quantity unit>\", "
                       "\"Refill\": \"<refill>\", "
                       "\"Pharmacy\": \"<pharmacy>\" "
                       "}, "
                       "\"Description\": \"<description>\" "
                       "} ] "
                       "}"
        }

        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[system_message, {"role": "user", "content": user_input}],
            max_tokens=500,
            temperature=0.1
        )

        gpt_response = completion.choices[0].message.content.strip()
        # print("OpenAI Response:", gpt_response)

        if not gpt_response.strip().endswith("}"):
            
            # print("OpenAI response is incomplete**********. Returning default response.")
            return jsonify({
                "response": {
                    "Prescriptions": [
                        {
                            "DiagnosisInformation": {"Diagnosis": None, "Medicine": None},
                            "MedicationDetails": {
                                "Dose": None,
                                "DoseUnit": None,
                                "DoseRoute": None,
                                "Frequency": None,
                                "FrequencyDuration": None,
                                "FrequencyUnit": None,
                                "Quantity": None,
                                "QuantityUnit": None,
                                "Refill": None,
                                "Pharmacy": None
                            },
                            "Description": "Please try again with proper prescription content."
                        }
                    ]
                }
            })

        try:
            prescription = json.loads(gpt_response)
            for p in prescription.get("Prescriptions", []):
                p.setdefault("DiagnosisInformation", {"Diagnosis": None, "Medicine": None})
                p.setdefault("MedicationDetails", {
                    "Dose": None,
                    "DoseUnit": None,
                    "DoseRoute": None,
                    "Frequency": None,
                    "FrequencyDuration": None,
                    "FrequencyUnit": None,
                    "Quantity": None,
                    "QuantityUnit": None,
                    "Refill": None,
                    "Pharmacy": None
                })
                p.setdefault("Description", None)

            return jsonify({"response": prescription})
        except json.JSONDecodeError as e:
            print("Failed to parse OpenAI response as JSON. Returning default response.")
            return jsonify({
                "response": {
                    "Prescriptions": [
                        {
                            "DiagnosisInformation": {"Diagnosis": None, "Medicine": None},
                            "MedicationDetails": {
                                "Dose": None,
                                "DoseUnit": None,
                                "DoseRoute": None,
                                "Frequency": None,
                                "FrequencyDuration": None,
                                "FrequencyUnit": None,
                                "Quantity": None,
                                "QuantityUnit": None,
                                "Refill": None,
                                "Pharmacy": None
                            },
                            "Description": "Please try again with proper prescription content."
                        }
                    ]
                }
            })

    except Exception as e:
        print("Error in /transcribe endpoint. Returning default response.")
        return jsonify({
            "response": {
                "Prescriptions": [
                    {
                        "DiagnosisInformation": {"Diagnosis": None, "Medicine": None},
                        "MedicationDetails": {
                            "Dose": None,
                            "DoseUnit": None,
                            "DoseRoute": None,
                            "Frequency": None,
                            "FrequencyDuration": None,
                            "FrequencyUnit": None,
                            "Quantity": None,
                            "QuantityUnit": None,
                            "Refill": None,
                            "Pharmacy": None
                        },
                        "Description": "Please try again with proper prescription content."
                    }
                ]
            }
        })

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)
