"""Pre-generate Arabic narration with ElevenLabs.

The API key is read from the ELEVENLABS_API_KEY environment variable and is never
written to the repository or shipped with the app; only the resulting MP3 files are.

Usage: ELEVENLABS_API_KEY=... python3 tools/tts_elevenlabs.py jobs.json [--budget N]
jobs.json: [{"text": "..."}...]  -> writes src/assets/voice/<hash>.mp3 and voice.json
"""
import concurrent.futures as cf, hashlib, json, os, sys, time, urllib.request, urllib.error

VOICE = 'pCKbQ4EPGE06zpEPGNvS'  # "Abdullah - Professional, and Energetic"
MODEL = 'eleven_multilingual_v2'
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'src', 'assets', 'voice')
MANIFEST = os.path.join(HERE, '..', 'src', 'assets', 'voice.json')


def key_of(text):
    return hashlib.sha1(text.strip().encode('utf-8')).hexdigest()[:16]


def synth(text, api_key):
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_22050_32',
        data=json.dumps({'text': text, 'model_id': MODEL, 'language_code': 'ar',
                         'voice_settings': {'stability': 0.55, 'similarity_boost': 0.8, 'style': 0.15, 'use_speaker_boost': True}}).encode('utf-8'),
        headers={'xi-api-key': api_key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', 'ignore')[:200]
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(3 * (attempt + 1)); continue
            raise RuntimeError(f'{e.code}: {body}')


def main():
    api_key = os.environ['ELEVENLABS_API_KEY']
    jobs = json.load(open(sys.argv[1], encoding='utf-8'))
    budget = int(sys.argv[sys.argv.index('--budget') + 1]) if '--budget' in sys.argv else 10**9
    os.makedirs(OUT, exist_ok=True)
    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    todo, spent = [], 0
    for j in jobs:
        t = j['text'].strip()
        k = key_of(t)
        if k in manifest.values() and os.path.exists(os.path.join(OUT, k + '.mp3')):
            manifest[t] = k
            continue
        if spent + len(t) > budget:
            continue
        spent += len(t)
        todo.append((t, k))
    print(f'{len(todo)} clips to generate, {spent} characters')
    done = 0
    def work(item):
        t, k = item
        audio = synth(t, api_key)
        with open(os.path.join(OUT, k + '.mp3'), 'wb') as fh:
            fh.write(audio)
        return t, k
    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        for fut in cf.as_completed([ex.submit(work, it) for it in todo]):
            try:
                t, k = fut.result()
                manifest[t] = k
                done += 1
                if done % 50 == 0:
                    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False)
                    print('done', done, flush=True)
            except Exception as e:
                print('error', e, flush=True)
    json.dump(manifest, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False)
    print('finished', done)


if __name__ == '__main__':
    main()
