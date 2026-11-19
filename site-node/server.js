// SmartBin ESEG - Servidor do painel web
// Grupo: Juan, Cauã e Bruno Spinelli

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');

const PORT = Number(process.env.PORT) || 3000;
const MQTT_URL = process.env.MQTT_URL || 'mqtt://broker.hivemq.com:1883';

// LIXEIRA_PREFIXO permite testar em outro topico sem atrapalhar a lixeira real
const PREFIXO = process.env.LIXEIRA_PREFIXO || 'eseg/lixeira/juan-caua-bruno/';
const MQTT_TOPIC_COMANDO = PREFIXO + 'comando'; // abrir / fechar (site -> Arduino)

// Topicos publicados pelo Arduino -> nome do evento enviado ao navegador (Socket.io)
const TOPICOS_LIXEIRA = {
  [PREFIXO + 'status']: 'lixeiraStatus',       // vazia / normal / cheia
  [PREFIXO + 'nivel']: 'lixeiraNivel',         // 0 a 100 (% ocupado)
  [PREFIXO + 'distancia']: 'lixeiraDistancia', // cm do sensor ate o lixo
  [PREFIXO + 'tampa']: 'lixeiraTampa',         // aberta / fechada
  [PREFIXO + 'aberturas']: 'lixeiraAberturas', // quantas vezes a tampa abriu
  [PREFIXO + 'online']: 'lixeiraOnline',       // online / offline (Last Will)
};

// Historico do nivel em memoria (para o grafico). Sem banco de dados:
// armazenamento em nuvem ficou fora do escopo da disciplina.
const HISTORICO_MAX_MS = 2 * 60 * 60 * 1000; // guarda as ultimas 2 horas
const HISTORICO_MAX_PONTOS = 3000;

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

// Ultimo valor de cada evento: enviado para quem abrir a pagina depois
const ultimosValores = {};
// Pontos { t: timestamp em ms, nivel: 0-100 } para o grafico
let historicoNivel = [];
let ultimaAbertura = null; // horario (ms) da ultima vez que a tampa abriu

mqttClient.on('connect', () => {
  console.log('Servidor Node.js conectado ao Broker MQTT com sucesso!');
  mqttClient.subscribe(Object.keys(TOPICOS_LIXEIRA), { qos: 1 }, (err) => {
    if (err) console.error('Falha ao assinar os topicos:', err.message);
  });
});

function registrarNivel(nivel) {
  const agora = Date.now();
  historicoNivel.push({ t: agora, nivel });
  historicoNivel = historicoNivel.filter((p) => agora - p.t <= HISTORICO_MAX_MS);
  if (historicoNivel.length > HISTORICO_MAX_PONTOS) {
    historicoNivel = historicoNivel.slice(-HISTORICO_MAX_PONTOS);
  }
  io.emit('lixeiraPontoNivel', { t: agora, nivel });
}

// Sem este handler, um erro de rede derrubaria o processo inteiro
mqttClient.on('error', (err) => {
  console.error('Erro no MQTT:', err.message);
});

mqttClient.on('reconnect', () => console.log('Reconectando ao broker MQTT...'));
mqttClient.on('offline', () => console.warn('Broker MQTT offline. Tentando de novo...'));

mqttClient.on('message', (topic, message) => {
  const evento = TOPICOS_LIXEIRA[topic];
  if (!evento) return;

  const valor = message.toString().trim().toLowerCase();
  if (!valor) return;

  console.log(`[MQTT] ${topic.replace(PREFIXO, '')} = ${valor}`);

  if (evento === 'lixeiraNivel') {
    const nivel = Number(valor);
    if (!Number.isFinite(nivel)) return;
    registrarNivel(Math.max(0, Math.min(100, nivel)));
  }

  // Marca o horario da abertura (so quando realmente muda para "aberta")
  if (evento === 'lixeiraTampa' && valor === 'aberta' && ultimosValores.lixeiraTampa !== 'aberta') {
    ultimaAbertura = Date.now();
    io.emit('lixeiraUltimaAbertura', ultimaAbertura);
  }

  ultimosValores[evento] = valor;
  io.emit(evento, valor); // atualiza todos os navegadores conectados
});

// ------------------------- Socket.io -------------------------
io.on('connection', (socket) => {
  console.log('Painel web acessado por um navegador.');

  // Quem abre/atualiza a pagina ja recebe o ultimo estado conhecido
  socket.emit('lixeiraHistorico', historicoNivel);
  for (const [evento, valor] of Object.entries(ultimosValores)) {
    socket.emit(evento, valor);
  }
  if (ultimaAbertura) socket.emit('lixeiraUltimaAbertura', ultimaAbertura);

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
