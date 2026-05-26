import base64
import json
import re
import os
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from dotenv import load_dotenv

SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
}

PROMPT = """
You are an expert network engineer analyzing a network topology diagram.

Your task: Carefully examine the image and extract ALL network devices and connections.
Return ONLY a valid JSON object (no markdown, no code fences) in this exact schema:

{
  "devices": [
    {
      "id": "R1",
      "type": "router",
      "vendor": "cisco",
      "x": 400,
      "y": 300,
      "label": "R1",
      "interfaces": [
        { "name": "g0/0", "ip": "192.168.1.1/24" }
      ]
    }
  ],
  "connections": [
    {
      "from_device": "R1",
      "from_interface": "g0/0",
      "to_device": "SW1",
      "to_interface": "f0/1",
      "link_type": "ethernet"
    }
  ],
  "subnets": [
    { "network": "192.168.1.0/24", "label": "LAN" }
  ]
}

Detection rules:
- Device types: router, switch, pc, firewall, server, wireless, cloud, unknown
- For x/y: estimate pixel position on a 1200x800 canvas (top-left = 0,0)
- For interfaces: use standard Cisco naming (g0/0, f0/0, e0) or generic (eth0)
- Detect ALL visible routers, switches, PCs, servers, firewalls, access points
- Detect ALL cables/connections between devices
"""

def extract_json(text: str) -> dict:
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    
    patterns = [
        r'```json\s*([\s\S]*?)\s*```',
        r'```\s*([\s\S]*?)\s*```',
        r'\{[\s\S]*\}',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            candidate = match.group(1) if '```' in pattern else match.group(0)
            try:
                return json.loads(candidate.strip())
            except json.JSONDecodeError:
                continue
    raise ValueError("Could not extract valid JSON from Gemini response.")

def analyze_image(image_bytes: bytes, mime_type: str) -> dict:
    # Reload .env dynamically so the user doesn't have to restart the server
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not configured in .env")
        
    genai.configure(api_key=api_key)

    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        safety_settings=SAFETY_SETTINGS,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            max_output_tokens=8192,
        ),
    )

    image_part = {
        "inline_data": {
            "mime_type": mime_type,
            "data": b64_image,
        }
    }

    print("Sending image to Gemini Vision API...")
    response = model.generate_content([PROMPT, image_part])
    raw_text = response.text
    print("Gemini response received.")
    
    return extract_json(raw_text)
