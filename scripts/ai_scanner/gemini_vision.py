import base64
import json
import re
import os
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

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


def _make_client() -> genai.Client:
    """Load API key from .env and return a configured genai.Client."""
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError("GEMINI_API_KEY is not configured in .env")
    return genai.Client(api_key=api_key)


# Model cascade: try most capable first, fall back if overloaded
_MODEL_CASCADE = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]


def _call_with_retry(client, contents, config, max_retries=2):
    """Try each model in _MODEL_CASCADE, with backoff per model on 503/429."""
    from google.genai import errors as genai_errors

    last_err = None
    for model in _MODEL_CASCADE:
        delay = 2
        for attempt in range(max_retries + 1):
            try:
                print(f"[Gemini] Trying model: {model} (attempt {attempt + 1})")
                return client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                )
            except genai_errors.ServerError as e:
                # 503 = overloaded, 429 = rate limited — both are retryable
                if e.status_code in (503, 429):
                    if attempt < max_retries:
                        print(f"[Gemini] {model} overloaded (HTTP {e.status_code}). Retrying in {delay}s...")
                        time.sleep(delay)
                        delay *= 2
                    else:
                        print(f"[Gemini] {model} still unavailable after {max_retries+1} tries. Trying next model...")
                        last_err = e
                        break
                else:
                    raise  # 400 bad request, 401 auth error, etc. — don't retry
            except Exception:
                raise  # Unexpected error — surface immediately
    raise RuntimeError(f"All Gemini models unavailable. Last error: {last_err}")


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

    # 4. Last resort: find outermost { ... }
    match = re.search(r'\{[\s\S]*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError("Could not extract valid JSON from Gemini response.")


def analyze_image(image_bytes: bytes, mime_type: str) -> dict:
    """Send an image to Gemini and return the parsed topology JSON."""
    client = _make_client()

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    print("Sending image to Gemini Vision API...")
    response = _call_with_retry(
        client,
        contents=[PROMPT, image_part],
        config=types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=8192,
        ),
    )
    raw_text = response.text
    print("Gemini response received.")

    return extract_json(raw_text)


def modify_topology(instruction: str, current_gns3: dict) -> dict:
    """Modify an existing GNS3 topology JSON based on a text instruction."""
    client = _make_client()

    prompt = MODIFY_PROMPT.format(
        current_gns3=json.dumps(current_gns3, indent=2),
        instruction=instruction,
    )

    print(f"[AI MODIFY] Instruction: {instruction}")
    response = _call_with_retry(
        client,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=8192,
        ),
    )
    raw_text = response.text
    print("[AI MODIFY] Gemini response received.")

    return extract_json(raw_text)
