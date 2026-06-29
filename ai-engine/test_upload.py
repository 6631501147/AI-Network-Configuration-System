import urllib.request
import json

dummy_image = b'GIF89a\x01\x00\x01\x00\x00\xff\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x00;'
boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = (
    '--' + boundary + '\r\n'
    'Content-Disposition: form-data; name="file"; filename="dummy.gif"\r\n'
    'Content-Type: image/gif\r\n\r\n'
).encode() + dummy_image + ('\r\n--' + boundary + '--\r\n').encode()

req = urllib.request.Request('http://localhost:8000/ai-api/scan-image', data=body, headers={
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
    'Content-Length': str(len(body))
})
try:
    resp = urllib.request.urlopen(req)
    print(resp.status)
    print(resp.read().decode())
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code)
    print(e.read().decode())
except Exception as e:
    print('Error:', e)
