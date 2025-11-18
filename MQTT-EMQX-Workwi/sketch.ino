#include <WiFi.h>
#include <PubSubClient.h>
#include <DHTesp.h>

const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

const char* MQTT_HOST = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;

const char* TOPIC_TELEMETRY = "fabiojun/sala/sensor";
const char* TOPIC_LED_CMD   = "fabiojun/sala/led/cmd";
const char* TOPIC_LED_STATE = "fabiojun/sala/led/state";

const int DHT_PIN = 15;
const int LED_PIN = 2;

const uint32_t PUB_INTERVAL_MS = 2000;

WiFiClient espClient;
PubSubClient mqtt(espClient);
DHTesp dht;

uint32_t lastPub = 0;

String toUpper(const String& s) {
  String r = s;
  r.toUpperCase();
  return r;
}

void publishLedState() {
  bool on = digitalRead(LED_PIN) == HIGH;
  char payload[32];
  snprintf(payload, sizeof(payload), "{\"led\":\"%s\"}", on ? "ON" : "OFF");
  mqtt.publish(TOPIC_LED_STATE, payload, true);
}

void handleMqttMessage(char* topic, byte* payload, unsigned int len) {
  String msg;
  for (unsigned int i = 0; i < len; i++) msg += (char)payload[i];
  msg.trim();

  Serial.printf("[MQTT] %s => '%s'\n", topic, msg.c_str());

  if (String(topic) == TOPIC_LED_CMD) {
    String cmd = toUpper(msg);
    if (cmd == "ON") {
      digitalWrite(LED_PIN, HIGH);
    } else if (cmd == "OFF") {
      digitalWrite(LED_PIN, LOW);
    } else {
      Serial.println("Comando desconhecido ('ON'/'OFF')");
      return;
    }
    publishLedState();
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Conectando ao Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.print("\nWi-Fi OK  IP: ");
  Serial.println(WiFi.localIP());
}

void connectMQTT() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(handleMqttMessage);

  const char* LWT_TOPIC = "fabiojun/sala/status";
  const char* LWT_MSG   = "{\"status\":\"offline\"}";

  while (!mqtt.connected()) {
    String clientId = "esp32-wokwi-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    Serial.printf("Conectando ao MQTT (%s:%d) ... ", MQTT_HOST, MQTT_PORT);

    bool ok = mqtt.connect(clientId.c_str(), NULL, NULL, LWT_TOPIC, 1, true, LWT_MSG);
    if (ok) {
      Serial.println("conectado!");
      mqtt.publish(LWT_TOPIC, "{\"status\":\"online\"}", true);
      mqtt.subscribe(TOPIC_LED_CMD, 0);
      publishLedState();
    } else {
      Serial.printf("falhou rc=%d. Tentando em 3s...\n", mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  dht.setup(DHT_PIN, DHTesp::DHT22);

  connectWiFi();
  connectMQTT();
}

void loop() {
  connectWiFi();
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  uint32_t now = millis();
  if (now - lastPub >= PUB_INTERVAL_MS) {
    lastPub = now;

    TempAndHumidity th = dht.getTempAndHumidity();
    if (isnan(th.temperature) || isnan(th.humidity)) {
      Serial.println("[WARN] Falha no DHT");
      return;
    }

    char json[64];
    snprintf(json, sizeof(json), "{\"t\":%.1f,\"h\":%.1f}", th.temperature, th.humidity);

    bool ok = mqtt.publish(TOPIC_TELEMETRY, json, false);
    Serial.printf("[PUB] %s => %s (%s)\n", TOPIC_TELEMETRY, json, ok ? "ok" : "erro");
  }
}
