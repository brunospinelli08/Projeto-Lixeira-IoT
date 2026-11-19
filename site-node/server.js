// SmartBin ESEG - Servidor do painel web
// Grupo: Juan, Cauã e Bruno Spinelli

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');

const PORT = Number(process.env.PORT) || 3000;
const MQTT_URL = process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883';

const MQTT_TOPIC_STATUS = 'eseg/lixeira/juan-caua-bruno/status'; // vazia / normal / cheia
const MQTT_TOPIC_TAMPA = 'eseg/lixeira/juan-caua-bruno/tampa';   // aberta / fechada
const MQTT_TOPIC_COMANDO = 'eseg/lixeira/juan-caua-bruno/comando';

// So estes comandos podem ir para o Arduino
const COMANDOS_VALIDOS = new Set(['abrir', 'fechar']);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// path.join(__dirname, ...) funciona mesmo se o Node for iniciado de outra pasta
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------- MQTT -------------------------
const mqttClient = mqtt.connect(MQTT_URL, {
  clientId: `painel-lixeira-${Math.random().toString(16).slice(2, 10)}`,
  reconnectPeriod: 3000,   // tenta reconectar a cada 3 s
  connectTimeout: 10000,
  clean: true,
});

let ultimoStatus = null; // enviado para quem abrir a pagina depois
let ultimaTampa = null;

mqttClient.on('connect', () => {
  console.log('Servidor Node.js conectado ao Broker MQTT com sucesso!');
  mqttClient.subscribe([MQTT_TOPIC_STATUS, MQTT_TOPIC_TAMPA], { qos: 1 }, (err) => {
    if (err) console.error('Falha ao assinar os topicos:', err.message);
  });
});

// Sem este handler, um erro de rede derrubaria o processo inteiro
mqttClient.on('error', (err) => {
  console.error('Erro no MQTT:', err.message);
});

mqttClient.on('reconnect', () => console.log('Reconectando ao broker MQTT...'));
mqttClient.on('offline', () => console.warn('Broker MQTT offline. Tentando de novo...'));

mqttClient.on('message', (topic, message) => {
  const valor = message.toString().trim().toLowerCase();
  if (!valor) return;

  if (topic === MQTT_TOPIC_TAMPA) {
    ultimaTampa = valor;
    console.log(`Tampa: ${valor}`);
    io.emit('lixeiraTampa', valor);
    return;
  }
  if (topic !== MQTT_TOPIC_STATUS) return;

  const status = valor;

  ultimoStatus = status;
  console.log(`Status recebido da lixeira fisica: ${status}`);
  io.emit('lixeiraStatus', status); // atualiza todos os navegadores conectados
});

// ------------------------- Socket.io -------------------------
io.on('connection', (socket) => {
  console.log('Painel web acessado por um navegador.');

  // Quem abre/atualiza a pagina ja recebe o ultimo estado conhecido
  if (ultimoStatus) socket.emit('lixeiraStatus', ultimoStatus);
  if (ultimaTampa) socket.emit('lixeiraTampa', ultimaTampa);

  socket.on('enviarComando', (comando) => {
    const acao = typeof comando === 'string' ? comando.trim().toLowerCase() : '';

    if (!COMANDOS_VALIDOS.has(acao)) {
      console.warn('Comando invalido ignorado:', comando);
      return;
    }

    if (!mqttClient.connected) {
      console.warn(`Sem conexao com o broker. Comando "${acao}" nao enviado.`);
      return;
    }

    console.log(`Comando enviado pelo site: ${acao}`);
    mqttClient.publish(MQTT_TOPIC_COMANDO, acao, { qos: 1 }, (err) => {
      if (err) console.error('Falha ao publicar comando:', err.message);
    });
  });
});

// ------------------------- Servidor -------------------------
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} ja esta em uso. Feche o outro processo ou use outra porta.`);
  } else {
    console.error('Erro no servidor HTTP:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Servidor rodando! Abra no navegador: http://localhost:${PORT}`);
});

// Fecha tudo com Ctrl+C, sem deixar o terminal travado
function encerrar() {
  console.log('\nEncerrando...');
  mqttClient.end(true);
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
