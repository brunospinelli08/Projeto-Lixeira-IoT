// SmartBin ESEG - Simulador da lixeira (faz o papel do Arduino)
// Grupo: Juan, Cauã e Bruno Spinelli
//
// Publica nos MESMOS topicos MQTT do Arduino, para testar o painel e tirar
// prints sem a placa. ATENCAO: nao rode junto com o Arduino ligado, senao os
// dois publicam ao mesmo tempo e o painel mistura os valores.
//
// Uso:  node simulador.js        (Ctrl+C para parar)

const mqtt = require('mqtt');

// LIXEIRA_PREFIXO permite testar em outro topico sem atrapalhar a lixeira real
const PREFIXO = process.env.LIXEIRA_PREFIXO || 'eseg/lixeira/juan-caua-bruno/';
const T = {
  status: PREFIXO + 'status',
  nivel: PREFIXO + 'nivel',
  distancia: PREFIXO + 'distancia',
  tampa: PREFIXO + 'tampa',
  aberturas: PREFIXO + 'aberturas',
  online: PREFIXO + 'online',
  comando: PREFIXO + 'comando',
};

// Mesmas medidas do Arduino: 30 cm = vazia (0%), 10 cm = cheia (100%)
const DIST_VAZIA = 30;
const DIST_100 = 10;
const TEMPO_TAMPA_ABERTA = 4000;

const client = mqtt.connect('mqtt://broker.hivemq.com:1883', {
  clientId: `simulador-lixeira-${Math.random().toString(16).slice(2, 8)}`,
  // Last Will igual ao do Arduino: se o simulador cair, o broker avisa "offline"
  will: { topic: T.online, payload: 'offline', qos: 1, retain: true },
});

let nivel = 5;         // % ocupado
let status = 'vazia';
let aberturas = 0;
let tampaAberta = false;
let timerFechar = null;

const pub = (topico, valor) => client.publish(topico, String(valor), { qos: 1, retain: true });

function abrirTampa(origem) {
  if (!tampaAberta) {
    tampaAberta = true;
    aberturas++;
    // Cada vez que alguem joga lixo, o nivel sobe um pouco
    nivel = Math.min(100, nivel + 2 + Math.random() * 6);
    pub(T.tampa, 'aberta');
    pub(T.aberturas, aberturas);
    console.log(`Tampa ABERTA (${origem}) - aberturas: ${aberturas}`);
  }
  clearTimeout(timerFechar);
  timerFechar = setTimeout(() => {
    tampaAberta = false;
    pub(T.tampa, 'fechada');
    console.log('Tampa FECHADA');
  }, TEMPO_TAMPA_ABERTA);
}

function publicarNivel() {
  // Pequeno ruido, como um sensor de verdade
  const medido = Math.max(0, Math.min(100, nivel + (Math.random() - 0.5) * 1.5));
  const pct = Math.round(medido);
  const distancia = DIST_VAZIA - (pct / 100) * (DIST_VAZIA - DIST_100);

  const novoStatus = pct >= 100 ? 'cheia' : pct <= 25 ? 'vazia' : 'normal';
  if (novoStatus !== status) {
    status = novoStatus;
    console.log(`Status: ${status}`);
  }

  pub(T.nivel, pct);
  pub(T.distancia, distancia.toFixed(1));
  pub(T.status, status);

  // Depois de um tempo cheia, alguem esvazia a lixeira
  if (status === 'cheia' && Math.random() < 0.15) {
    nivel = 3;
    console.log('Lixeira esvaziada!');
  }
}

client.on('connect', () => {
  console.log('Simulador conectado ao broker. Publicando dados... (Ctrl+C para parar)');
  pub(T.online, 'online');
  pub(T.tampa, 'fechada');
  pub(T.aberturas, aberturas);
  publicarNivel();
  client.subscribe(T.comando, { qos: 1 });

  setInterval(publicarNivel, 2000);
  // Simula uma pessoa aproximando a mao de tempos em tempos
  setInterval(() => { if (Math.random() < 0.5) abrirTampa('mao'); }, 6000);
});

// Botoes Abrir/Fechar do site
client.on('message', (topic, msg) => {
  const cmd = msg.toString().trim().toLowerCase();
  console.log(`Comando do site: ${cmd}`);
  if (cmd === 'abrir') abrirTampa('site');
  if (cmd === 'fechar' && tampaAberta) {
    clearTimeout(timerFechar);
    tampaAberta = false;
    pub(T.tampa, 'fechada');
    console.log('Tampa FECHADA (site)');
  }
});

client.on('error', (err) => console.error('Erro no MQTT:', err.message));

// Ao parar, avisa que ficou offline (como o Last Will faria)
process.on('SIGINT', () => {
  client.publish(T.online, 'offline', { qos: 1, retain: true }, () => {
    client.end(false, () => process.exit(0));
  });
  setTimeout(() => process.exit(0), 2000);
});
