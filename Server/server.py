from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
from openai import OpenAI
import json

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
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    
    try:
        # Transcribe the audio stream directly
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )
        user_input = transcript.text
        # print("Transcribed Text:", user_input)

        # Generate prescription from transcribed text
        system_message = {
            "role": "system",
            "content": conversation_history[0]["content"]
        }

        completion = client.chat.completions.create(
            model="gpt-4",
            messages=[system_message, {"role": "user", "content": user_input}],
            max_tokens=500,
            temperature=0.1
        )

        gpt_response = completion.choices[0].message.content.strip()
        # print("OpenAI Response:", gpt_response)

        # Handle potential JSON formatting issues
        try:
            gpt_response = gpt_response.replace('1-2', '"1-2"')
            prescription = json.loads(gpt_response)
            
            # Ensure all fields are present
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

            return jsonify({
                "response": prescription,
                "transcript": user_input
            })
            
        except json.JSONDecodeError as e:
            # print("Failed to parse response as JSON:", str(e))
            return jsonify({
                "error": "Failed to generate prescription",
                "transcript": user_input,
                "details": str(e)
            }), 500

    except Exception as e:
        # print("Error in transcription:", str(e))
        return jsonify({
            "error": "Audio processing failed",
            "details": str(e)
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