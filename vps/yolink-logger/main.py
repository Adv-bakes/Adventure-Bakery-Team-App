import os
import json
import time
import requests
import paho.mqtt.client as mqtt
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Configuration from environment variables
UAID = os.getenv("YOLINK_UAID")
SECRET_KEY = os.getenv("YOLINK_SECRET_KEY")
HOME_ID = os.getenv("YOLINK_HOME_ID")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Map your physical YoLink Device IDs to friendly names for your log
DEVICE_MAPPING = {
    "d88b4c010010b5da": "Walk-In Refrigerator",
    "d88b4c010010b513": "Walk-In Freezer",
    "d88b4c010010b70a": "Bakery Floor"
}

def get_yolink_token():
    """Fetches a fresh access token from YoLink Cloud."""
    url = "https://api.yosmart.com/open/yolink/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": UAID,
        "client_secret": SECRET_KEY
    }
    response = requests.post(url, data=payload)
    response.raise_for_status()
    return response.json()["access_token"]

# YoLink access tokens live for 7200s (2h); refresh well before that so a
# reconnect never happens with an expired token (the cause of "Not authorized").
TOKEN_REFRESH_SECONDS = 100 * 60  # 100 minutes

# MQTT Event Handlers
def on_connect(client, userdata, flags, reason_code, properties):
    # In API v2, 'rc' is replaced by 'reason_code'
    if reason_code.is_failure:
        # e.g. "Not authorized" — do NOT subscribe on a dead connection.
        print(f"MQTT connection refused: {reason_code}")
        return
    print(f"Connected to YoLink MQTT Broker: {reason_code}")
    topic = f"yl-home/{HOME_ID}/+/report"
    client.subscribe(topic)
    print(f"Subscribed to topic: {topic}")

def on_message(client, userdata, msg, properties=None):
    try:
        # DECODER & DEBUG PRINT
        raw_payload = msg.payload.decode('utf-8')
        print(f"--- RAW DATA RECEIVED FROM YOLINK ---")
        print(raw_payload)
        print(f"-------------------------------------")

        payload = json.loads(msg.payload.decode('utf-8'))
        event = payload.get("event")

        # We only care about standard sensor reports
        # Convert the event to lowercase before checking it
        # Case-insensitive event check to safely catch "THSensor.Report"
        if event and event.lower() == "thsensor.report":
            device_id = payload.get("deviceId")
            data = payload.get("data", {})

            temp_c = data.get("temperature")
            humidity = data.get("humidity")

            # --- NEW: EXTRACT BATTERY METRICS ---
            battery_level = data.get("battery")  # Returns integer 1-4
            alarm_block = data.get("alarm", {})
            low_battery_alarm = alarm_block.get("lowBattery", False)  # Returns True/False

            if temp_c is not None:
                equipment_name = DEVICE_MAPPING.get(device_id, f"Unknown Sensor ({device_id})")

                # Write directly to Supabase
                log_data = {
                    "device_id": device_id,
                    "equipment_name": equipment_name,
                    "temperature_celsius": temp_c,
                    "humidity": humidity,
                    "battery_level": battery_level,        # Added
                    "low_battery_alarm": low_battery_alarm  # Added
                }

                res = supabase.table("temperature_logs").insert(log_data).execute()
                print(f"Logged {equipment_name} state. Battery: {battery_level}/4. Low Alarm: {low_battery_alarm}")

    except Exception as e:
        print(f"Error processing message: {e}")

def main():
    while True:
        client = None
        try:
            # 1. Fetch a FRESH token to use as our MQTT username
            token = get_yolink_token()

            # 2. Configure MQTT Client
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            client.username_pw_set(username=token, password="")
            client.on_connect = on_connect
            client.on_message = on_message

            # 3. Connect and run the network loop in a background thread.
            #    loop_start() handles short-lived reconnects internally, but it
            #    reuses this token — so we tear the connection down and rebuild
            #    it with a new token before the 2h expiry (below).
            client.connect("api.yosmart.com", 8003, 60)
            client.loop_start()

            # 4. Hold the connection until the token is near expiry, then loop
            #    back around to fetch a new token and reconnect.
            time.sleep(TOKEN_REFRESH_SECONDS)
            print("Token nearing expiry — refreshing and reconnecting...")

        except Exception as e:
            print(f"Connection lost or initialization failed: {e}. Retrying in 15 seconds...")
            time.sleep(15)
        finally:
            # Always clean up the client/thread before the next iteration.
            if client is not None:
                client.loop_stop()
                client.disconnect()

if __name__ == "__main__":
    main()
