# YoLink Temperature Logger

Standalone ingestion service that runs on the Hostinger VPS. It subscribes to the
YoLink cloud MQTT broker and writes YoLink TH-sensor readings into the Supabase
`public.temperature_logs` table, which powers the Team Portal **Temperature Monitoring**
report (`/team/compliance/temperature`).

This is **not** part of the Vite app — it's vendored here so the whole system lives in one
repo. The live copy runs on the VPS under systemd.

## What it does

- Fetches a YoLink access token (`client_credentials`) and connects to
  `api.yosmart.com:8003` using the **token as the MQTT username**.
- Subscribes to `yl-home/<YOLINK_HOME_ID>/+/report`.
- On each `THSensor.Report`, inserts a row into `temperature_logs`:
  `device_id, equipment_name, temperature_celsius, humidity, battery_level (1–4),
  low_battery_alarm`.
- Maps raw device IDs to friendly equipment names via `DEVICE_MAPPING` in `main.py`
  (update this dict when sensors are added/replaced).

> Note: only Celsius is written. `temperature_fahrenheit` is a generated/derived column in
> the DB (the report displays °F).

## ⚠️ Token-refresh gotcha (why it once died every ~2 hours)

YoLink access tokens expire after **7200 s (2 hours)**. `paho`'s `loop_forever()` auto-reconnects
using the **cached** token, so after expiry every reconnect is rejected with
`result code Not authorized` — silently, forever, until the process restarts.

`main.py` avoids this by holding each connection for `TOKEN_REFRESH_SECONDS` (100 min) via
`loop_start()`, then tearing it down and rebuilding with a **freshly fetched token**. If you see
`Not authorized` *immediately* after a restart (not hours later), the credentials themselves are
stale — re-issue the UAC in the YoLink app and update `.env`.

## Setup (on the VPS)

```bash
cd ~/yolink-logger
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then fill in real values (never commit .env)
python main.py            # smoke test; Ctrl-C to stop
```

`.env` values: YoLink UAID / Secret Key / Home ID, plus the Supabase URL and a
**service-role** key (server-side inserts should bypass RLS).

## Run as a service (systemd)

Example unit (`/etc/systemd/system/yolink-logger.service`):

```ini
[Unit]
Description=YoLink Temperature Logger
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/root/yolink-logger
ExecStart=/root/yolink-logger/.venv/bin/python /root/yolink-logger/main.py
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now yolink-logger
journalctl -u yolink-logger -f   # watch: "Connected ... : Success" then "Logged ..." lines
```

`load_dotenv()` reads `.env` from the process working directory, so keep `.env` next to
`main.py` and set `WorkingDirectory` accordingly.

## Deploying an update

```bash
scp vps/yolink-logger/main.py root@<vps-host>:~/yolink-logger/main.py
ssh root@<vps-host> 'systemctl restart yolink-logger'
```

Requires **paho-mqtt 2.x** (uses `CallbackAPIVersion.VERSION2` and `reason_code.is_failure`).
