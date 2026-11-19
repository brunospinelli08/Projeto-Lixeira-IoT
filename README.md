# SmartBin ESEG – Lixeira Inteligente IoT

**Grupo:** Juan, Cauã e Bruno Spinelli

Lixeira com Arduino UNO R4 WiFi que abre a tampa ao aproximar a mão e informa o nível do lixo (vazia / normal / cheia) em um painel web em tempo real via MQTT.

## Estrutura
- `lixeira-arduino/lixeira-arduino.ino` – código do Arduino
  - Sensor de nível (dentro da caixa): TRIG 5 / ECHO 7
  - Sensor de mão (fora da caixa): TRIG 2 / ECHO 3
  - Servo da tampa: pino 9
- `site-node/` – servidor Node.js (Express + Socket.io + MQTT) e painel web
  - `server.js` – assina os tópicos MQTT, guarda o histórico do nível e envia ao navegador
  - `public/index.html` – dashboard (nível real, gráfico, tampa, aberturas, distância, online/offline, botões)
  - `simulador.js` – imita o Arduino para testar o painel sem a placa

## Tópicos MQTT (broker.hivemq.com, porta 1883)
Prefixo: `eseg/lixeira/juan-caua-bruno/`

| Tópico | Publica | Assina | Mensagem | Retain |
|---|---|---|---|---|
| `status` | Arduino | Servidor | `vazia` / `normal` / `cheia` | sim |
| `nivel` | Arduino | Servidor | `0` a `100` (% ocupado) | sim |
| `distancia` | Arduino | Servidor | cm do sensor até o lixo (ex.: `18.4`) | sim |
| `tampa` | Arduino | Servidor | `aberta` / `fechada` | sim |
| `aberturas` | Arduino | Servidor | nº de aberturas desde que ligou | sim |
| `online` | Arduino (e o broker, via Last Will) | Servidor | `online` / `offline` | sim |
| `comando` | Servidor (botões do site) | Arduino | `abrir` / `fechar` | não |

## Como rodar o site
```bash
cd site-node
npm install
node server.js
```
Abra http://localhost:3000

### Testar sem o Arduino
Com o Arduino **desligado**, rode em outro terminal:
```bash
node simulador.js
```

## Arduino
- Preencha `ssid` e `password` no `.ino` com os dados do seu Wi-Fi antes de gravar na placa (não suba sua senha real para o GitHub).
- Meça com uma régua a distância do sensor de nível até o fundo da caixa vazia e coloque em `DIST_VAZIA`.
