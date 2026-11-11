#!/usr/bin/env python3
"""Curate final HLS IP-cam list from probe results (verified 200 mpegurl)."""
import json

a = json.load(open('/tmp/good_hls.json'))
b = json.load(open('/tmp/good_hls_world.json'))
pool = {e['url']: e for e in (a + b)}
print('verified pool:', len(pool))

# hand-picked ids (url fragment → display meta)
PICKS = [
    # US · Delaware DOT
    ('NCAM182.stream',  'Delaware DE 72 @ American Blvd',      'DelDOT',      'Dover',      'United States', 'US', 'Traffic Cam'),
    ('KCAM091.stream',  'Delaware US 13 @ DE 300',             'DelDOT',      'Smyrna',     'United States', 'US', 'Traffic Cam'),
    ('SCAM098.stream',  'Delaware DE 1 @ Indian River Inlet',  'DelDOT',      'Bethany Beach', 'United States', 'US', 'Traffic Cam'),
    # US · Virginia DOT
    ('RichmondCS095SB0671', 'I-95 MM 67.1 SB · Richmond',      'VDOT',        'Richmond',   'United States', 'US', 'Traffic Cam'),
    ('SalemUS460MtAthos',   'US-460 / SR-726 Mt Athos',        'VDOT',        'Salem',      'United States', 'US', 'Traffic Cam'),
    ('TLJamesRiverBridge040South', 'US-17 SB James River Bridge', 'VDOT',     'Newport News', 'United States', 'US', 'Traffic Cam'),
    ('StauntonI81MM217N',   'I-81 MM 217.0 NB · Staunton',     'VDOT',        'Staunton',   'United States', 'US', 'Traffic Cam'),
    ('vabeachcam002',       'Princess Anne Rd & S Independence', 'VDOT',      'Virginia Beach', 'United States', 'US', 'Traffic Cam'),
    ('NO0500',              'I-495 MM 42.5 NB · Beltway',      'VDOT',        'McLean',     'United States', 'US', 'Traffic Cam'),
    # US · Maryland SHA
    ('080162f0000200fa0064d336c4235c0a', 'MD 713036 · Maryland', 'MDSHA',     'Maryland',   'United States', 'US', 'Traffic Cam'),
    ('3200a76b008000d30050fa36c4235c0a', 'MD RWIS US 340 @ MD 180', 'MDSHA',  'Maryland',   'United States', 'US', 'Traffic Cam'),
    # US · Louisiana DOTD
    ('shr-cam-001.streams', 'I-10 Baton Rouge Cam 001',        'LaDOTD',      'Baton Rouge','United States', 'US', 'Traffic Cam'),
    ('shr-cam-024.streams', 'I-10 Baton Rouge Cam 024',        'LaDOTD',      'Baton Rouge','United States', 'US', 'Traffic Cam'),
    # Indonesia · ATCS
    ('ATCS_Simpang_Atmosukarto', 'ATCS Simpang Atmosukarto',   'ATCS YK',     'Yogyakarta', 'Indonesia',     'ID', 'Traffic Cam'),
    ('sutisnasenjaya.m3u8',      'ATCS Simpang Sutisna Senjya','ATCS TSK',    'Tasikmalaya','Indonesia',     'ID', 'Traffic Cam'),
    ('10019.m3u8',               'Serbaraja Toll 12+750',      'Serbaraja',   'Tangerang',  'Indonesia',     'ID', 'Traffic Cam'),
    # Europe
    ('via-della-scala',    'Florence · Via della Scala',       'VEDETTA',     'Florence',   'Italy',         'IT', 'City Cam'),
    ('live/leva1',         'Livadeia CCTV 1',                  'LiveCamerasGR','Livadeia',   'Greece',        'GR', 'City Cam'),
    ('live/dika1',         'Dikastro CCTV 1',                  'LiveCamerasGR','Dikastro',   'Greece',        'GR', 'City Cam'),
    ('opole_cam_8b53d4',   'Opole · Rynek (place du marché)',  'WebcameraPL', 'Opole',      'Poland',        'PL', 'City Cam'),
    ('hls/69/live.m3u8',   'Mezduretchensk · rue Lénine',      'M-Ten',       'Meždurečensk','Russia',       'RU', 'City Cam'),
]

out, miss = [], []
for frag, name, src, city, country, cc, ctype in PICKS:
    hit = next((e for u, e in pool.items() if frag in u), None)
    if not hit:
        miss.append(frag); continue
    out.append({
        'frag': frag, 'name': name, 'src': src, 'city': city, 'country': country, 'cc': cc,
        'type': ctype, 'url': hit['url'], 'lat': hit['lat'], 'lon': hit['lon'],
    })
print('curated:', len(out), '| missing:', miss)
json.dump(out, open('/tmp/curated_hls.json', 'w'), indent=1, ensure_ascii=False)
for o in out:
    print(f"  {o['cc']} | {o['name'][:34]:36} | {o['lat']:.4f},{o['lon']:.4f} | {o['url'][:70]}")
