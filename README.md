# SmartBin ESEG – Lixeira Inteligente IoT

**Grupo:** Juan, Cauã e Bruno Spinelli

Lixeira com Arduino UNO R4 WiFi que abre a tampa ao aproximar a mão e informa o nível do lixo (vazia / normal / cheia) em um painel web em tempo real via MQTT.

## Estrutura
- `lixeira-arduino/lixeira-arduino.ino` – código do Arduino
  - Sensor de nível (dentro da caixa): TRIG 5 / ECHO 7
  - Sensor de mão (fora da caixa): TRIG 2 / ECHO 3
  - Servo da tampa: pino 9
- `site-node/` – servidor Node.js (Express + Socket.io + MQTT) e painel web

## Tópicos MQTT (broker.hivemq.com)
- `eseg/lixeira/juan-caua-bruno/status` – vazia / normal / cheia
- `eseg/lixeira/juan-caua-bruno/tampa` – aberta / fechada
- `eseg/lixeira/juan-caua-bruno/comando` – abrir / fechar

## Como rodar o site
```bash
cd site-node
npm install
node server.js
```
Abra http://localhost:3000

## Arduino
Preencha `ssid` e `password` no `.ino` com os dados do seu Wi-Fi antes de gravar na placa (não suba sua senha real para o GitHub).
