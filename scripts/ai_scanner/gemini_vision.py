import base64
import json
import re
import os
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

# gemini-2.5-flash
MODEL_NAME = "gemini-2.5-flash-preview-05-20"

# Retry settings for 429 / transient errors
MAX_RETRIES = 4
BASE_BACKOFF = 10  # seconds

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


def _get_client() -> genai.Client:
    """Load API key and return a configured Gemini client."""
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not configured in .env")
    return genai.Client(api_key=api_key)


def _call_with_retry(client: genai.Client, contents, config: types.GenerateContentConfig):
    """Call the Gemini API with exponential backoff on 429 / quota errors."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return client.models.generate_content(
                model=MODEL_NAME,
                contents=contents,
                config=config,
            )
        except Exception as e:
            err_str = str(e)
            is_quota = "429" in err_str or "quota" in err_str.lower() or "rate" in err_str.lower()
            if is_quota and attempt < MAX_RETRIES:
                delay_match = re.search(r'retry[_ ]delay.*?seconds:\s*(\d+)', err_str, re.IGNORECASE)
                wait = int(delay_match.group(1)) if delay_match else BASE_BACKOFF * attempt
                wait = min(wait, 60)
                print(f"[RETRY] Quota error (attempt {attempt}/{MAX_RETRIES}). Waiting {wait}s...")
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("Max retries exceeded")


def extract_json(text: str) -> dict:
    # 1. Strip thinking traces
    text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE).strip()

    # 2. Try direct parse
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 3. Try markdown code fences
    for pattern in [r'```json\s*([\s\S]*?)\s*```', r'```\s*([\s\S]*?)\s*```']:
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                continue

    # 4. Outermost JSON object
    brace_match = re.search(r'(\{[\s\S]*\})', text, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 5. Outermost JSON array
    bracket_match = re.search(r'(\[[\s\S]*\])', text, re.DOTALL)
    if bracket_match:
        try:
            return json.loads(bracket_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract valid JSON from Gemini response. Raw (first 500 chars): {text[:500]}")


def analyze_image(image_bytes: bytes, mime_type: str) -> dict:
    """Analyze a network topology image and return structured JSON."""
    client = _get_client()

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    config = types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=8192,
    )

    print(f"[SCAN] Sending image to Gemini API (model: {MODEL_NAME})...")
    response = _call_with_retry(client, [PROMPT, image_part], config)
    print("[SCAN] Gemini response received.")
    return extract_json(response.text)


def modify_topology(instruction: str, current_gns3: dict) -> dict:
    """Modify an existing GNS3 topology JSON based on a text instruction."""
    client = _get_client()

    prompt = MODIFY_PROMPT.format(
        current_gns3=json.dumps(current_gns3, indent=2),
        instruction=instruction,
    )

    config = types.GenerateContentConfig(
        temperature=0.2,
        max_output_tokens=8192,
    )

    print(f"[AI MODIFY] Instruction: {instruction} (model: {MODEL_NAME})")
    response = _call_with_retry(client, prompt, config)
    print("[AI MODIFY] Gemini response received.")
    return extract_json(response.text)
