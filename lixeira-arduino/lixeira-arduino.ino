/*
- Lixeira Inteligente - Arduino UNO R4 WiFi
- Grupo: Juan, Cauã e Bruno Spinelli
- Sensor de NIVEL  (dentro da caixa) HC-SR04: TRIG 5 / ECHO 7 -> so informa o site (vazia / normal / cheia)
- Sensor de MAO    (fora da caixa)   HC-SR04: TRIG 2 / ECHO 3 -> abre a tampa quando aproxima a mao
- Servo da tampa: pino 9
- Regra: a tampa fica SEMPRE fechada e so abre quando o sensor de fora detecta a mao.
         Depois que a mao sai, espera TEMPO_TAMPA_ABERTA e fecha sozinha.
- Dados enviados ao site (MQTT): status, nivel (%), distancia (cm), tampa, aberturas, online/offline
 */

#include <WiFiS3.h>
#include <PubSubClient.h>
#include <Servo.h>

// ---------- Configuracoes ----------
const char* ssid        = "SEU_SSID_WIFI";
const char* password    = "SUA_SENHA_WIFI";
const char* mqtt_server = "broker.hivemq.com";
const int   mqtt_port   = 1883;

// Todos os topicos publicados pelo Arduino usam retain = true:
// o broker guarda o ultimo valor e entrega na hora para quem assinar depois.
const char* topicoStatus    = "eseg/lixeira/juan-caua-bruno/status";     // vazia / normal / cheia
const char* topicoNivel     = "eseg/lixeira/juan-caua-bruno/nivel";      // 0 a 100 (% ocupado)
const char* topicoDistancia = "eseg/lixeira/juan-caua-bruno/distancia";  // cm do sensor ate o lixo
const char* topicoTampa     = "eseg/lixeira/juan-caua-bruno/tampa";      // aberta / fechada
const char* topicoAberturas = "eseg/lixeira/juan-caua-bruno/aberturas";  // quantas vezes a tampa abriu
const char* topicoOnline    = "eseg/lixeira/juan-caua-bruno/online";     // online / offline (Last Will)
const char* topicoComando   = "eseg/lixeira/juan-caua-bruno/comando";    // abrir / fechar (vem do site)

// ---------- Pinos ----------
const int pinTrigNivel = 5;   // sensor dentro da caixa
const int pinEchoNivel = 7;
const int pinTrigMao   = 2;   // sensor fora da caixa (aproximacao da mao)
const int pinEchoMao   = 3;
const int pinServo     = 9;   // pino PWM oficial do UNO R4 WiFi

// ---------- Constantes ----------
const int ANGULO_ABERTA  = 90;
const int ANGULO_FECHADA = 0;

const unsigned long INTERVALO_NIVEL     = 2000;   // mede o nivel a cada 2 s
const unsigned long INTERVALO_MAO       = 150;    // mede a mao a cada 150 ms (resposta rapida)
const unsigned long TEMPO_TAMPA_ABERTA  = 4000;   // fica aberta 4 s depois que a mao sai
const unsigned long INTERVALO_MQTT      = 5000;   // tenta reconectar a cada 5 s
const unsigned long INTERVALO_WIFI      = 10000;  // tenta reconectar a cada 10 s
const unsigned long TIMEOUT_WIFI        = 20000;  // nao trava o boot para sempre
const unsigned long HEARTBEAT_STATUS_MS = 30000;  // repete o status a cada 30 s

// Sensor de nivel (distancia do sensor ate o lixo)
// DIST_VAZIA: distancia do sensor ate o FUNDO com a caixa vazia (meca com uma regua!)
// E a UNICA medida que precisa ser ajustada: os limites abaixo se adaptam a ela.
constexpr float DIST_VAZIA       = 30.0;              // cm  <-- AJUSTE AQUI
constexpr float LIMITE_CHEIA     = 10;                // cm: abaixo disso = cheia
constexpr float LIMITE_SAI_CHEIA = 12;                // cm: precisa passar disso para deixar de ser cheia
constexpr float LIMITE_VAZIA     = DIST_VAZIA - 5;    // cm: acima disso = vazia (lixo com menos de 5 cm)
constexpr float LIMITE_SAI_VAZIA = DIST_VAZIA - 7;    // cm: abaixo disso deixa de ser vazia
static_assert(LIMITE_SAI_VAZIA > LIMITE_SAI_CHEIA, "DIST_VAZIA muito pequena: a caixa precisa ter mais de 19 cm");
const int LEITURAS_PARA_CONFIRMAR = 2;  // evita trocar de estado por 1 leitura ruidosa

// Conversao distancia -> porcentagem de ocupacao
// Fundo vazio (DIST_VAZIA) = 0%. Lixo em LIMITE_CHEIA (10 cm do sensor) = 100% ocupado.
constexpr float DIST_100_PORCENTO  = LIMITE_CHEIA;
const int       VARIACAO_MIN_NIVEL = 2;     // so publica o nivel se mudar 2% ou mais

// Sensor de mao
const int DISTANCIA_MAO = 15;           // cm: mao a menos disso abre a tampa
const int LEITURAS_MAO_CONFIRMAR = 2;   // 2 leituras seguidas (~300 ms) para abrir

// ---------- Objetos ----------
WiFiClient wifiClient;
PubSubClient client(wifiClient);
Servo tampaServo;

// ---------- Estado ----------
unsigned long ultimaLeituraNivel  = 0;
unsigned long ultimaLeituraMao    = 0;
unsigned long ultimaMaoDetectada  = 0;
unsigned long ultimaTentativaMQTT = 0;
unsigned long ultimaTentativaWifi = 0;
unsigned long ultimoEnvioStatus   = 0;

String statusAtual     = "normal";
String statusPublicado = "";
String statusCandidato = "";
int    leiturasCandidato = 0;

float  distanciaAtual   = -1;    // ultima distancia valida (cm); -1 = ainda nao mediu
float  distanciaSuavizada   = -1;    // media movel da distancia (tira o ruido)
int    nivelAtual       = -1;    // 0 a 100 (%); -1 = ainda nao mediu
int    nivelPublicado   = -100;
unsigned long ultimoEnvioNivel = 0;

bool   tampaAberta     = false;
bool   tampaPublicada  = true;   // forca a primeira publicacao
bool   tampaJaEnviada  = false;
int    leiturasMao     = 0;

unsigned long aberturas          = 0;   // conta desde que a placa ligou
long          aberturasPublicadas = -1;

char clientId[32] = "ESEGLixeiraR4";

// ================= Wi-Fi =================
bool conectarWifi() {
  Serial.print("Conectando ao Wi-Fi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TIMEOUT_WIFI) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi conectado. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("Falha ao conectar no Wi-Fi (timeout). Sigo tentando no loop().");
  return false;
}

void montarClientId() {
  byte mac[6] = {0, 0, 0, 0, 0, 0};
  WiFi.macAddress(mac);
  snprintf(clientId, sizeof(clientId), "ESEGLixeira-%02X%02X%02X", mac[3], mac[4], mac[5]);
}

// ================= Tampa =================
void publicarTampa(bool forcar);
void publicarAberturas(bool forcar);

void moverTampa(bool abrir) {
  if (abrir == tampaAberta) return;   // so aciona o servo quando muda (evita zumbido)

  tampaServo.write(abrir ? ANGULO_ABERTA : ANGULO_FECHADA);
  tampaAberta = abrir;
  Serial.println(abrir ? "-> Tampa ABERTA." : "-> Tampa FECHADA.");

  if (abrir) aberturas++;   // conta cada abertura (mao ou site)

  publicarTampa(false);
  publicarAberturas(false);
}

// ================= MQTT =================
void callback(char* topic, byte* payload, unsigned int length) {
  String mensagem;
  mensagem.reserve(length);
  for (unsigned int i = 0; i < length; i++) {
    mensagem += (char)payload[i];
  }
  mensagem.trim();
  mensagem.toLowerCase();

  Serial.print("Comando MQTT recebido: ");
  Serial.println(mensagem);

  if (mensagem == "abrir") {
    // Abre pelo site e fecha sozinha depois do mesmo tempo da mao
    ultimaMaoDetectada = millis();
    moverTampa(true);
  } else if (mensagem == "fechar") {
    moverTampa(false);
  } else {
    Serial.println("-> Comando ignorado.");
  }
}

void publicarStatus(bool forcar) {
  if (!client.connected()) return;

  bool mudou     = (statusAtual != statusPublicado);
  bool heartbeat = (millis() - ultimoEnvioStatus >= HEARTBEAT_STATUS_MS);

  if (!forcar && !mudou && !heartbeat) return;

  if (client.publish(topicoStatus, statusAtual.c_str(), true)) {
    statusPublicado   = statusAtual;
    ultimoEnvioStatus = millis();
    Serial.print("-> Status publicado: ");
    Serial.println(statusPublicado);
  } else {
    Serial.println("-> Falha ao publicar o status.");
  }
}

void publicarTampa(bool forcar) {
  if (!client.connected()) return;
  if (!forcar && tampaJaEnviada && tampaAberta == tampaPublicada) return;

  const char* estado = tampaAberta ? "aberta" : "fechada";
  if (client.publish(topicoTampa, estado, true)) {
    tampaPublicada = tampaAberta;
    tampaJaEnviada = true;
  }
}

// Publica nivel (%) e distancia (cm) juntos
void publicarNivel(bool forcar) {
  if (!client.connected() || nivelAtual < 0) return;

  bool mudou     = abs(nivelAtual - nivelPublicado) >= VARIACAO_MIN_NIVEL;
  bool heartbeat = (millis() - ultimoEnvioNivel >= HEARTBEAT_STATUS_MS);
  if (!forcar && !mudou && !heartbeat) return;

  char texto[12];
  snprintf(texto, sizeof(texto), "%d", nivelAtual);
  if (client.publish(topicoNivel, texto, true)) {
    nivelPublicado   = nivelAtual;
    ultimoEnvioNivel = millis();
  }

  String dist = String(distanciaAtual, 1);   // ex.: "18.4"
  client.publish(topicoDistancia, dist.c_str(), true);
}

void publicarAberturas(bool forcar) {
  if (!client.connected()) return;
  if (!forcar && (long)aberturas == aberturasPublicadas) return;

  char texto[12];
  snprintf(texto, sizeof(texto), "%lu", aberturas);
  if (client.publish(topicoAberturas, texto, true)) {
    aberturasPublicadas = (long)aberturas;
  }
}

void tentarConectarMQTT() {
  if (millis() - ultimaTentativaMQTT < INTERVALO_MQTT) return;
  ultimaTentativaMQTT = millis();

  Serial.print("Conectando ao broker MQTT...");
  // Last Will (testamento): se o Arduino cair sem avisar, o PROPRIO BROKER
  // publica "offline" no topico online. Assim o site sabe que a lixeira desligou.
  if (client.connect(clientId, topicoOnline, 1, true, "offline")) {
    Serial.println(" conectado!");
    client.publish(topicoOnline, "online", true);
    client.subscribe(topicoComando, 1);
    publicarStatus(true);
    publicarNivel(true);
    publicarTampa(true);
    publicarAberturas(true);
  } else {
    Serial.print(" falhou (rc=");
    Serial.print(client.state());
    Serial.println("). Tento de novo em 5 s.");
  }
}

// ================= Sensores =================
float medirDistanciaCm(int pinTrig, int pinEcho) {
  digitalWrite(pinTrig, LOW);
  delayMicroseconds(2);
  digitalWrite(pinTrig, HIGH);
  delayMicroseconds(10);
  digitalWrite(pinTrig, LOW);

  unsigned long duracao = pulseIn(pinEcho, HIGH, 30000UL);

  if (duracao == 0) return -1;
  return duracao * 0.0343 / 2.0;
}

// Sensor de dentro: so define o status para o site (NAO mexe na tampa)
void lerSensorNivel() {
  float distancia = medirDistanciaCm(pinTrigNivel, pinEchoNivel);

  if (distancia < 0) {
    Serial.println("Nivel: leitura invalida (sem eco).");
    return;
  }

  // Media movel simples: metade leitura nova, metade valor anterior (tira o ruido)
  if (distanciaSuavizada < 0) distanciaSuavizada = distancia;
  distanciaSuavizada = 0.5 * distancia + 0.5 * distanciaSuavizada;
  distanciaAtual = distanciaSuavizada;

  // Converte distancia em % ocupado: DIST_VAZIA = 0%, DIST_100_PORCENTO = 100%
  float pct = (DIST_VAZIA - distanciaAtual) / (DIST_VAZIA - DIST_100_PORCENTO) * 100.0;
  nivelAtual = constrain((int)(pct + 0.5), 0, 100);

  Serial.print("Nivel - distancia ate o lixo: ");
  Serial.print(distancia, 1);
  Serial.print(" cm  |  ocupacao: ");
  Serial.print(nivelAtual);
  Serial.println(" %");

  // Faixas com histerese: nas zonas entre os limites mantem o estado anterior
  String lido = "";
  if (distancia < LIMITE_CHEIA) {
    lido = "cheia";
  } else if (distancia > LIMITE_VAZIA) {
    lido = "vazia";
  } else if (distancia > LIMITE_SAI_CHEIA && distancia < LIMITE_SAI_VAZIA) {
    lido = "normal";
  }

  if (lido != "") {
    if (lido != statusCandidato) {
      statusCandidato   = lido;
      leiturasCandidato = 0;
    }
    leiturasCandidato++;

    if (leiturasCandidato >= LEITURAS_PARA_CONFIRMAR && statusAtual != lido) {
      statusAtual = lido;
      Serial.print("-> Lixeira agora esta: ");
      Serial.println(statusAtual);
    }
  }

  publicarStatus(false);
  publicarNivel(false);
}

// Sensor de fora: abre a tampa ao aproximar a mao, fecha sozinha depois
void lerSensorMao() {
  float distancia = medirDistanciaCm(pinTrigMao, pinEchoMao);
  bool maoPerto = (distancia > 0 && distancia < DISTANCIA_MAO);

  if (maoPerto) {
    leiturasMao++;
    if (leiturasMao >= LEITURAS_MAO_CONFIRMAR) {
      ultimaMaoDetectada = millis();
      if (!tampaAberta) Serial.println("Mao detectada.");
      moverTampa(true);
    }
  } else {
    leiturasMao = 0;
  }

  if (tampaAberta && millis() - ultimaMaoDetectada >= TEMPO_TAMPA_ABERTA) {
    moverTampa(false);
  }
}

// ================= Setup / Loop =================
void setup() {
  Serial.begin(115200);

  pinMode(pinTrigNivel, OUTPUT);
  pinMode(pinEchoNivel, INPUT);
  digitalWrite(pinTrigNivel, LOW);

  pinMode(pinTrigMao, OUTPUT);
  pinMode(pinEchoMao, INPUT);
  digitalWrite(pinTrigMao, LOW);

  tampaServo.attach(pinServo);
  tampaServo.write(ANGULO_FECHADA);   // comeca sempre fechada
  tampaAberta = false;

  montarClientId();
  conectarWifi();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setKeepAlive(30);
  client.setSocketTimeout(5);

  Serial.println("Sistema pronto.");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    if (client.connected()) client.disconnect();
    if (millis() - ultimaTentativaWifi >= INTERVALO_WIFI) {
      ultimaTentativaWifi = millis();
      Serial.println("Wi-Fi caiu. Tentando reconectar...");
      WiFi.begin(ssid, password);
    }
  } else {
    if (client.connected()) {
      client.loop();
    } else {
      tentarConectarMQTT();
    }
  }

  if (millis() - ultimaLeituraMao >= INTERVALO_MAO) {
    ultimaLeituraMao = millis();
    lerSensorMao();
  }

  if (millis() - ultimaLeituraNivel >= INTERVALO_NIVEL) {
    ultimaLeituraNivel = millis();
    lerSensorNivel();
  }
}
