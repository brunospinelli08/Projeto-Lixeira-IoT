// SmartBin ESEG - Teste do broker MQTT
// Grupo: Juan, Cauã e Bruno Spinelli

const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.hivemq.com:1883');

client.on('connect', () => {
  console.log('CONECTADO COM SUCESSO AO BROKER!');
  client.subscribe('eseg/lixeira/juan-caua-bruno/comando', (err) => {
    if (!err) {
      client.publish('eseg/lixeira/juan-caua-bruno/comando', 'abrir');
    }
  });
});

client.on('message', (topic, message) => {
  console.log(`Mensagem recebida no tópico [${topic}]: ${message.toString()}`);
  client.end();
});