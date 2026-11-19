const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, ImageRun,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat,
  ExternalHyperlink, PageBreak,
} = require('docx');

const RAIZ = 'C:/Users/bruno/OneDrive/Desktop/Projeto-Lixeira-IoT';
const SAIDA = path.join(RAIZ, 'documentacao', 'Documentacao-SmartBin-ESEG.docx');

const AZUL_ESCURO = '1F4E79';
const AZUL = '2E75B6';
const FONTE = 'Arial';
const LARGURA = 9026; // A4 com margens de 1440

// ---------------- helpers ----------------
function runs(texto, base = {}) {
  // **negrito** e `codigo` dentro do texto
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return partes.map((p) => {
    if (p.startsWith('**')) return new TextRun({ text: p.slice(2, -2), bold: true, font: FONTE, size: 22, ...base });
    if (p.startsWith('`')) return new TextRun({ text: p.slice(1, -1), font: 'Courier New', size: 20, ...base });
    return new TextRun({ text: p, font: FONTE, size: 22, ...base });
  });
}

const p = (texto, opts = {}) => new Paragraph({ spacing: { before: 100, after: 120, line: 276 }, children: runs(texto), ...opts });
const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const item = (texto) => new Paragraph({ numbering: { reference: 'bolinha', level: 0 }, spacing: { after: 60 }, children: runs(texto) });
const passo = (texto) => new Paragraph({ numbering: { reference: 'passos', level: 0 }, spacing: { after: 80 }, children: runs(texto) });
const vazio = () => new Paragraph({ children: [] });

function codigo(arquivo) {
  const linhas = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8').replace(/\r/g, '').split('\n');
  while (linhas.length && linhas[linhas.length - 1] === '') linhas.pop();
  return linhas.map((l) => new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text: l.replace(/\t/g, '  ') || ' ', font: 'Courier New', size: 16, color: '1A1A1A' })],
  }));
}

function imagem(arquivo, larguraPx) {
  const buf = fs.readFileSync(arquivo);
  const w = buf.readUInt32BE(16), hgt = buf.readUInt32BE(20);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [new ImageRun({ type: 'png', data: buf, transformation: { width: larguraPx, height: Math.round(larguraPx * hgt / w) } })],
  });
}

const legenda = (t) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 },
  children: [new TextRun({ text: t, font: FONTE, size: 18, italics: true, color: '555555' })],
});

// Caixa amarela para o grupo colar uma imagem depois
function espacoImagem(texto) {
  const borda = { style: BorderStyle.DASHED, size: 8, color: 'BF9000' };
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [LARGURA],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: LARGURA, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FFF8E1' },
        borders: { top: borda, bottom: borda, left: borda, right: borda },
        margins: { top: 600, bottom: 600, left: 240, right: 240 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: texto, font: FONTE, size: 20, italics: true, color: '7F6000' })],
        })],
      })],
    })],
  });
}

function tabela(cabecalho, linhas, larguras) {
  const borda = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const celula = (txt, i, topo) => new TableCell({
    width: { size: larguras[i], type: WidthType.DXA },
    borders: bordas,
    shading: topo ? { type: ShadingType.CLEAR, color: 'auto', fill: AZUL_ESCURO } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      children: topo
        ? [new TextRun({ text: txt, font: FONTE, size: 19, bold: true, color: 'FFFFFF' })]
        : runs(txt, { size: 19 }),
    })],
  });
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: larguras,
    rows: [
      new TableRow({ tableHeader: true, children: cabecalho.map((c, i) => celula(c, i, true)) }),
      ...linhas.map((l) => new TableRow({ children: l.map((c, i) => celula(c, i, false)) })),
    ],
  });
}

// ---------------- conteudo ----------------
const filhos = [];
const add = (...x) => filhos.push(...x);

// Capa / cabecalho (igual ao modelo do semestre passado)
add(
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 120 },
    children: [new TextRun({ text: 'Documentação do Projeto', font: FONTE, size: 40, bold: true, color: AZUL_ESCURO })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
    children: [new TextRun({ text: 'SmartBin ESEG: Lixeira Inteligente com IoT', font: FONTE, size: 28, bold: true, color: AZUL })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: 'IoT 2  |  2026/2 Noite  |  Prof. Filippo', font: FONTE, size: 22, color: '555555' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
    children: [new TextRun({ text: 'Grupo: Juan, Cauã e Bruno Spinelli', font: FONTE, size: 22, color: '555555' })] }),
);

// 1
add(
  h1('1. Objetivo / Descrição do Projeto'),
  p('O objetivo deste projeto é montar uma lixeira controlada remotamente, que é o tema que o nosso grupo escolheu para o projeto final. A lixeira usa um Arduino UNO R4 WiFi, dois sensores ultrassônicos HC-SR04 e um servo motor que abre e fecha a tampa.'),
  p('A tampa fica sempre fechada. Quando a pessoa aproxima a mão do sensor que fica do lado de fora, a tampa abre sozinha e fecha de novo alguns segundos depois que a mão sai. O segundo sensor fica dentro da caixa, apontado para baixo, e mede a distância até o lixo. Com essa medida o Arduino calcula quanto da lixeira está ocupado e classifica como **vazia**, **normal** ou **cheia**.'),
  p('Todas essas informações são enviadas pela internet para um broker MQTT na nuvem (HiveMQ). Um servidor em Node.js assina os tópicos e mostra tudo em um dashboard no navegador: o nível em porcentagem, um gráfico do nível ao longo do tempo, se a tampa está aberta, quantas vezes ela abriu e se a lixeira está conectada. Pelo dashboard também dá para abrir e fechar a tampa à distância, com os botões Abrir e Fechar.'),
  p('Pensando em uma aplicação real, um sistema assim ajudaria a equipe de limpeza de um prédio ou de uma faculdade a saber quais lixeiras precisam ser esvaziadas sem ter que passar em todas, e a abertura sem contato evita que as pessoas encostem na tampa.'),
);

// 2
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1('2. Diagrama de Blocos'),
  p('O diagrama abaixo mostra o caminho dos dados no sistema, desde os sensores até o dashboard:'),
  imagem(path.join(RAIZ, 'documentacao/imagens/diagrama-blocos.png'), 600),
  legenda('Figura 1: Diagrama de blocos do sistema'),
  p('Do lado da lixeira, os dois sensores mandam as leituras para o Arduino, que decide quando mexer o servo da tampa. O Arduino se conecta ao Wi-Fi e publica os dados no broker MQTT. O servidor Node.js, rodando no computador, assina esses tópicos e repassa os valores para o navegador usando Socket.io. O caminho contrário também existe: quando alguém clica em Abrir ou Fechar no dashboard, o servidor publica o comando no broker e o Arduino, que está inscrito nesse tópico, recebe e move o servo.'),
);

// 3
add(
  h1('3. Explicação do Funcionamento: Hardware'),
  p('O circuito é bem simples e tem quatro componentes principais ligados ao Arduino:'),
  h2('Arduino UNO R4 WiFi'),
  p('É a placa central do projeto. Usamos a versão R4 WiFi porque ela já tem Wi-Fi embutido (um módulo ESP32-S3 na própria placa), então não foi preciso usar nenhum módulo extra para conectar na internet. O microcontrolador principal é o RA4M1, que lê os sensores, controla o servo e roda a lógica toda. Os pinos dela trabalham em 5 V, o mesmo nível dos sensores HC-SR04, então os sensores foram ligados direto, sem divisor de tensão.'),
  h2('Sensor ultrassônico HC-SR04 (como ele mede)'),
  p('O HC-SR04 tem dois "olhos": um emite um pulso de ultrassom e o outro escuta o eco. O Arduino manda um pulso de 10 microssegundos no pino TRIG, o sensor dispara o som e deixa o pino ECHO em nível alto até o eco voltar. Medindo quanto tempo o ECHO ficou em alto (com a função `pulseIn`), dá para calcular a distância:'),
  p('**distância (cm) = tempo (µs) × 0,0343 ÷ 2**'),
  p('O 0,0343 é a velocidade do som em centímetros por microssegundo, e a divisão por 2 é porque o som vai até o objeto e volta. No projeto usamos dois sensores iguais, cada um com uma função diferente.'),
  h2('Sensor de nível (dentro da caixa)'),
  p('Fica preso na parte de cima da caixa, apontado para o fundo. Quanto mais lixo, menor a distância medida. Esse sensor não mexe na tampa: ele serve só para informar o site se a lixeira está vazia, normal ou cheia e qual a porcentagem ocupada. Está ligado nos pinos 5 (TRIG) e 7 (ECHO).'),
  h2('Sensor da mão (fora da caixa)'),
  p('Fica na frente da lixeira, do lado de fora. Quando ele mede uma distância menor que 15 cm por duas leituras seguidas, o Arduino entende que tem uma mão ali e abre a tampa. Está ligado nos pinos 2 (TRIG) e 3 (ECHO).'),
  h2('Servo motor'),
  p('É o atuador do projeto, responsável por abrir e fechar a tampa. O servo recebe um sinal PWM no pino 9 e gira até o ângulo pedido: 0° com a tampa fechada e 90° com a tampa aberta. Ele é acionado tanto pelo sensor da mão quanto pelos botões do dashboard.'),
);

// 4
add(
  h1('4. Lista de Materiais'),
  p('Os componentes usados na montagem foram:'),
  item('1x Arduino UNO R4 WiFi — microcontrolador e conexão Wi-Fi'),
  item('2x Sensor ultrassônico HC-SR04 — um para o nível do lixo e outro para detectar a mão'),
  item('1x Servo motor — abre e fecha a tampa'),
  item('1x Protoboard — para distribuir o 5 V e o GND entre os componentes'),
  item('Fios jumper diversos — para as ligações'),
  item('1x Cabo USB-C — alimentação e gravação do Arduino'),
  item('1x Caixa com tampa — estrutura da lixeira'),
  item('1x Computador com Node.js — roda o servidor e o dashboard'),
);

// 5
add(
  h1('5. Circuito Elétrico'),
  p('Abaixo estão todas as ligações do circuito. Os três componentes usam o 5 V e o GND do Arduino, distribuídos pela protoboard.'),
  h2('Alimentação'),
  item('Pino 5V do Arduino -> linha positiva (+) da protoboard'),
  item('Pino GND do Arduino -> linha negativa (-) da protoboard'),
  h2('Sensor de nível (HC-SR04, dentro da caixa)'),
  item('VCC -> positivo da protoboard (5 V)'),
  item('GND -> negativo da protoboard'),
  item('TRIG -> pino digital 5 do Arduino'),
  item('ECHO -> pino digital 7 do Arduino'),
  h2('Sensor da mão (HC-SR04, fora da caixa)'),
  item('VCC -> positivo da protoboard (5 V)'),
  item('GND -> negativo da protoboard'),
  item('TRIG -> pino digital 2 do Arduino'),
  item('ECHO -> pino digital 3 do Arduino'),
  h2('Servo motor'),
  item('Fio vermelho (V+) -> positivo da protoboard (5 V)'),
  item('Fio marrom ou preto (GND) -> negativo da protoboard'),
  item('Fio laranja ou amarelo (sinal) -> pino digital 9 do Arduino (PWM)'),
  p('Uma observação: o servo puxa bastante corrente na hora em que começa a girar. Se a placa reiniciar quando a tampa mexe, a solução é alimentar o servo com uma fonte de 5 V separada, mantendo o GND da fonte ligado ao GND do Arduino.'),
);

// 6
add(
  h1('6. Diagrama da Montagem (Wokwi)'),
  p('A montagem foi desenhada no Wokwi, um simulador de circuitos online. O Wokwi ainda não tem o UNO R4 WiFi na lista de placas, então no desenho usamos o Arduino Uno R3, que tem a mesma pinagem. As ligações são exatamente as mesmas do circuito real descrito na seção anterior.'),
  espacoImagem('[ Inserir aqui a imagem da montagem no Wokwi ]'),
  legenda('Figura 2: Montagem do circuito no Wokwi (Arduino Uno usado no lugar do UNO R4 WiFi)'),
);

// 7
add(
  h1('7. Comunicação MQTT: Especificação dos Tópicos'),
  p('A comunicação entre a lixeira e o dashboard é feita pelo protocolo MQTT, usando o broker público da HiveMQ:'),
  item('Broker: `broker.hivemq.com`'),
  item('Porta: 1883 (MQTT sem criptografia)'),
  item('Prefixo de todos os tópicos: `eseg/lixeira/juan-caua-bruno/`'),
  p('Colocamos o nome do grupo no prefixo para não misturar com os tópicos de outras pessoas, já que o broker é público. A tabela abaixo mostra cada tópico, quem publica, quem assina e o que é enviado:'),
  tabela(
    ['Tópico', 'Publica', 'Assina', 'Mensagem', 'Retain'],
    [
      ['`status`', 'Arduino', 'Servidor', '`vazia`, `normal` ou `cheia`', 'Sim'],
      ['`nivel`', 'Arduino', 'Servidor', 'Número de 0 a 100 (% ocupado)', 'Sim'],
      ['`distancia`', 'Arduino', 'Servidor', 'Distância do sensor até o lixo em cm (ex.: 18.4)', 'Sim'],
      ['`tampa`', 'Arduino', 'Servidor', '`aberta` ou `fechada`', 'Sim'],
      ['`aberturas`', 'Arduino', 'Servidor', 'Quantas vezes a tampa abriu desde que a placa ligou', 'Sim'],
      ['`online`', 'Arduino e broker (Last Will)', 'Servidor', '`online` ou `offline`', 'Sim'],
      ['`comando`', 'Servidor (botões do site)', 'Arduino', '`abrir` ou `fechar`', 'Não'],
    ],
    [1500, 1900, 1150, 3576, 900],
  ),
  vazio(),
  h2('Retain'),
  p('Os tópicos publicados pelo Arduino usam a opção retain. Com ela o broker guarda a última mensagem de cada tópico e entrega na hora para quem se inscrever depois. Na prática, quando o servidor é ligado ou alguém abre o site, os valores já aparecem sem precisar esperar a próxima leitura. O tópico `comando` não usa retain de propósito: se usasse, um "abrir" antigo poderia ser entregue de novo quando o Arduino reiniciasse e a tampa abriria sozinha.'),
  h2('Last Will (online / offline)'),
  p('Na hora de conectar, o Arduino deixa registrado no broker uma "última vontade": se ele cair sem avisar (falta de energia, Wi-Fi caiu etc.), o próprio broker publica `offline` no tópico `online`. Assim que conecta, o Arduino publica `online`. Com isso o dashboard consegue mostrar se a lixeira está realmente ligada, e não só o último valor que ficou guardado.'),
  h2('Frequência de envio'),
  p('Para não ficar enviando a mesma coisa toda hora, o Arduino só publica quando o valor muda (no caso do nível, quando muda 2% ou mais) e repete os valores a cada 30 segundos, só para garantir que o site está atualizado.'),
);

// 8
add(
  h1('8. Explicação do Funcionamento: Software'),
  p('O software tem três partes: o código do Arduino (C++), o servidor (Node.js) e o dashboard (HTML, CSS e JavaScript). O código completo está no repositório do GitHub do grupo, e o código do Arduino e do servidor também está na seção 9.'),
  h2('Código do Arduino'),
  p('O código usa três bibliotecas: `WiFiS3` (Wi-Fi do UNO R4), `PubSubClient` (MQTT) e `Servo`. No `setup()` o Arduino configura os pinos dos sensores, deixa a tampa fechada, conecta no Wi-Fi e configura o broker.'),
  p('No `loop()` não usamos `delay()`. Cada tarefa tem o seu próprio intervalo controlado com `millis()`, porque se o código ficasse parado esperando, a tampa demoraria para responder à mão. O loop faz três coisas:'),
  item('mantém a conexão com o Wi-Fi e com o broker, tentando reconectar se cair;'),
  item('lê o sensor da mão a cada 150 ms;'),
  item('lê o sensor de nível a cada 2 segundos.'),
  h2('Lógica da tampa'),
  p('Se o sensor da mão mede menos de 15 cm em duas leituras seguidas, a tampa abre. Exigir duas leituras evita que um ruído do sensor abra a tampa sem ninguém ali. Cada vez que a mão é detectada, o tempo é guardado, e a tampa só fecha quando passam 4 segundos sem detectar nada. Se a pessoa continua com a mão perto, ela continua aberta. O botão Abrir do site usa a mesma lógica, então também fecha sozinha depois de 4 segundos. A cada abertura o contador `aberturas` aumenta.'),
  h2('Lógica do nível'),
  p('O sensor de nível às vezes dá leituras que variam um pouco, então o código faz uma média entre a leitura nova e a anterior antes de calcular a porcentagem. A porcentagem é calculada assim:'),
  p('**nível (%) = (DIST_VAZIA − distância) ÷ (DIST_VAZIA − 10) × 100**'),
  p('`DIST_VAZIA` é a distância do sensor até o fundo da caixa vazia, que medimos com régua. Quando o lixo chega a 10 cm do sensor, consideramos 100%.'),
  p('Para o status (vazia, normal, cheia) usamos faixas com uma margem entre elas, chamada de histerese. Por exemplo, a lixeira vira "cheia" abaixo de 10 cm, mas só volta a ser "normal" acima de 12 cm. Sem essa margem, se o lixo ficasse bem em cima do limite, o status ficaria trocando toda hora. Além disso, o status só muda depois de duas leituras seguidas confirmando.'),
  h2('Servidor Node.js'),
  p('O servidor usa o Express para entregar a página, a biblioteca `mqtt` para conversar com o broker e o Socket.io para mandar os dados para o navegador em tempo real. Quando conecta no broker, ele assina os seis tópicos que o Arduino publica. Cada mensagem recebida é repassada para todos os navegadores abertos.'),
  p('O servidor também guarda em memória o histórico do nível das últimas 2 horas, que é o que alimenta o gráfico. Quem abre a página recebe esse histórico e os últimos valores de cada tópico. Quando um botão é clicado, o servidor confere se o comando é `abrir` ou `fechar` (qualquer outra coisa é ignorada) e publica no tópico `comando`.'),
  h2('Dashboard'),
  p('O dashboard é uma página só, que funciona no computador e no celular. Ela mostra:'),
  item('um desenho da lixeira que enche conforme o nível real e muda de cor quando fica cheia;'),
  item('o status em texto grande (VAZIA, NORMAL ou CHEIA) e a porcentagem ocupada;'),
  item('três cartões com o estado da tampa e o horário da última abertura, o total de aberturas e a distância medida;'),
  item('um gráfico de linha (feito com a biblioteca Chart.js) com o nível ao longo do tempo;'),
  item('um indicador LIXEIRA ONLINE / OFFLINE no canto de cima;'),
  item('os botões Abrir e Fechar, que ficam desativados se a lixeira estiver offline.'),
  p('Quando o status muda, aparece um aviso na tela, por exemplo "Atenção: lixeira CHEIA!".'),
);

// 9
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1('9. Código Comentado'),
  p('A seguir está o código do Arduino e do servidor, com os comentários explicando cada parte. O código do dashboard (`site-node/public/index.html`) também é comentado e está completo no repositório:'),
  new Paragraph({ spacing: { after: 200 }, children: [
    new TextRun({ text: 'Repositório: ', font: FONTE, size: 22, bold: true }),
    new ExternalHyperlink({ link: 'https://github.com/brunospinelli08/Projeto-Lixeira-IoT', children: [
      new TextRun({ text: 'github.com/brunospinelli08/Projeto-Lixeira-IoT', font: FONTE, size: 22, color: AZUL, underline: {} }),
    ] }),
  ] }),
  h2('9.1 Arduino (lixeira-arduino.ino)'),
  ...codigo('lixeira-arduino/lixeira-arduino.ino'),
  new Paragraph({ children: [new PageBreak()] }),
  h2('9.2 Servidor (server.js)'),
  ...codigo('site-node/server.js'),
);

// 10
add(
  new Paragraph({ children: [new PageBreak()] }),
  h1('10. Capturas de Tela do Dashboard'),
  p('As imagens abaixo mostram o dashboard funcionando com a lixeira montada.'),
  espacoImagem('[ Inserir aqui o print do dashboard com a lixeira online ]'),
  legenda('Figura 3: Tela principal do dashboard, com nível, gráfico e cartões'),
  espacoImagem('[ Inserir aqui o print com a tampa ABERTA ]'),
  legenda('Figura 4: Tampa aberta e contador de aberturas atualizado'),
  espacoImagem('[ Inserir aqui o print com a lixeira CHEIA ]'),
  legenda('Figura 5: Alerta de lixeira cheia'),
  espacoImagem('[ Inserir aqui o print com a lixeira OFFLINE ]'),
  legenda('Figura 6: Indicador de lixeira offline (Last Will)'),
);

// 11
add(
  h1('11. Como Usar'),
  p('Passo a passo para colocar o projeto para funcionar:'),
  passo('No código do Arduino, preencher `ssid` e `password` com os dados da rede Wi-Fi (2,4 GHz) e ajustar `DIST_VAZIA` com a altura medida da caixa.'),
  passo('Gravar o código no UNO R4 WiFi pela IDE do Arduino, com as bibliotecas PubSubClient e Servo instaladas.'),
  passo('Abrir o Monitor Serial em 115200 e conferir se aparecem as mensagens "Wi-Fi conectado" e "conectado!" do broker.'),
  passo('No computador, dentro da pasta `site-node`, rodar `npm install` (só na primeira vez) e depois `npm start`.'),
  passo('Abrir `http://localhost:3000` no navegador. O indicador no canto deve mostrar LIXEIRA ONLINE.'),
  passo('Aproximar a mão do sensor da frente para abrir a tampa, ou usar os botões Abrir e Fechar do site.'),
  p('Para testar o dashboard sem a placa, existe o comando `npm run simulador`, que publica dados parecidos com os do Arduino nos mesmos tópicos. Ele só deve ser usado com o Arduino desligado, senão os dois publicam ao mesmo tempo.'),
);

// 12
add(
  h1('12. Dificuldades Encontradas e Observações'),
  h2('Mudança na lógica da tampa'),
  p('Na primeira versão, o projeto tinha só um sensor, dentro da caixa, e a tampa fechava quando a lixeira enchia (lixo a menos de 10 cm). Ou seja, a tampa ficava aberta o tempo todo enquanto a lixeira não estava cheia. Decidimos mudar, porque no uso real faz mais sentido a tampa ficar fechada e abrir só quando alguém vai jogar o lixo. Passamos a usar dois sensores: o de fora controla a tampa e o de dentro passou a servir só para informar o nível no site.'),
  h2('Leituras instáveis do ultrassom'),
  p('O HC-SR04 às vezes retorna valores errados ou não retorna nada (quando o eco não volta). Para resolver, o código ignora leituras sem eco, faz média no nível, exige duas leituras seguidas para abrir a tampa ou mudar o status e usa histerese entre as faixas.'),
  h2('Rede Wi-Fi'),
  p('O UNO R4 WiFi só conecta em redes de 2,4 GHz com senha simples. Redes que pedem usuário e senha ou login por uma página no navegador não funcionam com o Arduino. Por isso deixamos como alternativa usar o roteador do celular na apresentação.'),
  h2('Segurança'),
  p('O broker usado é público e os tópicos não têm senha, então qualquer pessoa que souber o nome do tópico poderia ler os dados ou mandar um comando. Como a disciplina deixou segurança fora do escopo, mantivemos assim, mas em um projeto real seria necessário usar um broker com usuário, senha e criptografia (porta 8883).'),
);

add(
  vazio(),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360 },
    children: [new TextRun({ text: 'IoT 2  |  2026', font: FONTE, size: 20, color: '777777' })] }),
);

// ---------------- documento ----------------
const doc = new Document({
  creator: 'Juan, Cauã e Bruno Spinelli',
  title: 'Documentação do Projeto - SmartBin ESEG',
  styles: {
    default: { document: { run: { font: FONTE, size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONTE, size: 32, bold: true, color: AZUL_ESCURO },
        paragraph: { spacing: { before: 320, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONTE, size: 26, bold: true, color: AZUL },
        paragraph: { spacing: { before: 240, after: 120 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bolinha', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'passos', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    children: filhos,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(SAIDA, buf);
  console.log('gerado:', SAIDA, buf.length, 'bytes');
});
