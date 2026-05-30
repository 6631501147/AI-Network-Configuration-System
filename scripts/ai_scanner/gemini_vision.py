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
    # 1. Strip Gemini 2.5 thinking traces (e.g. <think>...</think>)
    text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE).strip()

    # 2. Try direct parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 3. Try to extract from markdown code fences
    patterns = [
        r'```json\s*([\s\S]*?)\s*```',
        r'```\s*([\s\S]*?)\s*```',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            candidate = match.group(1).strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    # 4. Try to find the outermost JSON object/array
    brace_match = re.search(r'(\{[\s\S]*\})', text, re.DOTALL)
    if brace_match:
        candidate = brace_match.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 5. Last resort: try a broader search for array
    bracket_match = re.search(r'(\[[\s\S]*\])', text, re.DOTALL)
    if bracket_match:
        candidate = bracket_match.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from Gemini response. Raw (first 500 chars): {text[:500]}")

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

# ── Text-based topology modification ────────────────────────────────────────

MODIFY_PROMPT = """\
You are an expert network engineer working with GNS3 topology files.

Current GNS3 topology JSON:
{current_gns3}

User instruction: {instruction}

Modify the topology according to the user's instruction.
Return ONLY the modified GNS3 JSON object. No markdown fences, no explanation, no <think> tags.
Start your response with the opening brace {{ and end with the closing brace }}.

Rules:
- Keep the EXACT same JSON structure as the input topology
- For new PCs: use node_type "vpcs", continue numbering (PC3, PC4, ...)
- For new routers: use node_type "dynamips", continue numbering (R2, R3, ...)
- For new switches: use node_type "ethernet_switch", continue numbering (SW2, SW3, ...)
- New device node_id should be a new UUID (use format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
- Place new devices in a logical position (offset existing positions by ~150px)
- Update the links array to connect new devices as instructed
- Each link must have: link_id (new UUID), nodes (list of 2 objects with node_id, adapter_number, port_number, label.text)
- Preserve all existing nodes and links unless the instruction says to remove them
"""

def modify_topology(instruction: str, current_gns3: dict) -> dict:
    """Modify an existing GNS3 topology JSON based on a text instruction."""
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not configured in .env")

    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        safety_settings=SAFETY_SETTINGS,
        generation_config=genai.GenerationConfig(
            temperature=0.2,
            max_output_tokens=8192,
        ),
    )

    prompt = MODIFY_PROMPT.format(
        current_gns3=json.dumps(current_gns3, indent=2),
        instruction=instruction
    )

    print(f"[AI MODIFY] Instruction: {instruction}")
    response = model.generate_content(prompt)
    raw_text = response.text
    print("[AI MODIFY] Gemini response received.")

    return extract_json(raw_text)
