// Campanha de Natal IPA — página do doador
(() => {
  'use strict';

  // No site da Sigma a API fica no mesmo endereço; em qualquer outro site (ex.: ipasocial.com.br)
  // a página chama a API da Sigma pelo endereço completo.
  const API = /(^|\.)sigmacreative\.com\.br$/.test(location.hostname) || location.hostname === 'localhost'
    ? location.pathname.replace(/\/[^/]*$/, '') + '/api'
    : 'https://sigmacreative.com.br/projetoIPa_Natal2026/api';
  const CHAVE_LOCAL = 'ipa-natal-rascunho';
  const WHATSAPP = '5519992252700';
  const PIX_COPIA_COLA = '00020126580014br.gov.bcb.pix0136e397aa3e-05ec-4dc1-8986-947c4b57e7be27600016BR.COM.PAGSEGURO0136674D0F09-CAD1-4D00-9428-AC7A67CD7D5F5204869953039865802BR5925IPA MOVIMENTO COMUNITARIO6010Indaiatuba62290525PAGS0000000002611120930936304CF63';
  const PIX_CNPJ = '66045405000154';
  const PIX_CNPJ_FORMATADO = '66.045.405/0001-54';
  const INTERVALO_TOTAIS = 20000;          // atualiza o contador a cada 20 s
  const PARAR_SEM_INTERACAO = 15 * 60000;  // para de atualizar após 15 min parado

  const $ = (id) => document.getElementById(id);
  const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const num = (n) => n.toLocaleString('pt-BR');
  const plural = (n) => `${num(n)} brinquedo${n === 1 ? '' : 's'}`;

  const estado = {
    brinquedos: [],
    meta: 0,
    max: 500,
    encerrada: false,
    siteKey: '',
    escolha: {},       // { idBrinquedo: quantidade }
    salvo: {},         // última versão salva no servidor
    id: null,          // identificador do rascunho (gerado pelo servidor)
    ocupado: false,
    finalizada: false,
    ultimaInteracao: Date.now(),
  };

  // ---------------------------------------------------------------- início

  async function iniciar() {
    recuperarLocal();
    try {
      const r = await fetch(`${API}/catalogo`, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error();
      const c = await r.json();
      estado.brinquedos = c.brinquedos;
      estado.meta = c.meta;
      estado.max = c.maxPorItem;
      estado.encerrada = c.encerrada;
      estado.siteKey = c.turnstileSiteKey;
      // descarta itens recuperados que não existem mais
      const validos = new Set(c.brinquedos.map((b) => String(b.id)));
      for (const k of Object.keys(estado.escolha)) if (!validos.has(k)) delete estado.escolha[k];
      montarGrade();
      atualizarPlacar(c.totalGeral, null);
      atualizarBarra();
      if (estado.encerrada) encerrar();
      prepararTurnstile();
      agendarTotais();
    } catch {
      $('grade').innerHTML = '';
      const p = document.createElement('p');
      p.className = 'carregando';
      p.textContent = 'Não foi possível carregar os brinquedos. Verifique sua conexão e recarregue a página.';
      $('grade').append(p);
    }
  }

  // ---------------------------------------------------------------- catálogo

  function montarGrade() {
    const grade = $('grade');
    grade.innerHTML = '';
    for (const b of estado.brinquedos) {
      const art = document.createElement('article');
      art.className = 'cartao';
      art.dataset.id = b.id;

      const foto = document.createElement('div');
      foto.className = 'cartao__foto';
      const img = document.createElement('img');
      img.src = b.imagem; img.alt = b.nome; img.loading = 'lazy'; img.width = 400; img.height = 400;
      const selo = document.createElement('span');
      selo.className = 'cartao__selo'; selo.hidden = true;
      foto.append(img, selo);

      const corpo = document.createElement('div');
      corpo.className = 'cartao__corpo';
      const nome = el('h3', 'cartao__nome', b.nome);
      const desc = el('p', 'cartao__desc', b.descricao || '');
      const preco = el('p', 'cartao__preco', brl(b.preco));
      const prom = document.createElement('p');
      prom.className = 'cartao__prometidos';
      const promNum = document.createElement('strong');
      promNum.textContent = num(b.total);
      prom.append(promNum, document.createTextNode(' já prometidos'));

      const cont = document.createElement('div');
      cont.className = 'contador';
      const menos = botao('−', `Tirar um ${b.nome}`);
      const mais = botao('+', `Adicionar um ${b.nome}`);
      const input = document.createElement('input');
      input.type = 'number'; input.inputMode = 'numeric'; input.min = '0'; input.max = String(estado.max);
      input.value = String(estado.escolha[b.id] || 0);
      input.setAttribute('aria-label', `Quantidade de ${b.nome}`);

      menos.addEventListener('click', () => mudar(b.id, (estado.escolha[b.id] || 0) - 1));
      mais.addEventListener('click', () => mudar(b.id, (estado.escolha[b.id] || 0) + 1));
      input.addEventListener('input', () => {
        const v = parseInt(input.value, 10);
        mudar(b.id, Number.isFinite(v) ? v : 0, true);
      });
      input.addEventListener('blur', () => { input.value = String(estado.escolha[b.id] || 0); });
      input.addEventListener('focus', () => input.select());

      cont.append(menos, input, mais);
      corpo.append(nome, desc, preco, prom, cont);
      art.append(foto, corpo);
      grade.append(art);
      b._ui = { art, selo, input, menos, mais, promNum };
      pintarCartao(b);
    }
  }

  function mudar(id, valor, digitando = false) {
    if (estado.encerrada || estado.finalizada) return;
    const v = Math.max(0, Math.min(estado.max, Math.floor(valor) || 0));
    if (v === 0) delete estado.escolha[id]; else estado.escolha[id] = v;
    const b = estado.brinquedos.find((x) => x.id === id);
    if (!digitando) b._ui.input.value = String(v);
    pintarCartao(b);
    atualizarBarra();
    guardarLocal();
    tocou();
  }

  function pintarCartao(b) {
    const q = estado.escolha[b.id] || 0;
    b._ui.art.classList.toggle('cartao--escolhido', q > 0);
    b._ui.selo.hidden = q === 0;
    b._ui.selo.textContent = `${q} na sua doação`;
    b._ui.menos.disabled = q === 0 || estado.encerrada;
    b._ui.mais.disabled = q >= estado.max || estado.encerrada;
    b._ui.input.disabled = estado.encerrada;
  }

  // ---------------------------------------------------------------- resumo e barra

  function totalEscolha() {
    let qtd = 0, valor = 0;
    for (const b of estado.brinquedos) {
      const q = estado.escolha[b.id] || 0;
      qtd += q; valor += q * b.preco;
    }
    return { qtd, valor };
  }

  function alterado() {
    const a = estado.escolha, s = estado.salvo;
    const ks = new Set([...Object.keys(a), ...Object.keys(s)]);
    for (const k of ks) if ((a[k] || 0) !== (s[k] || 0)) return true;
    return false;
  }

  function atualizarBarra() {
    const { qtd, valor } = totalEscolha();
    const temAlgo = qtd > 0 || estado.id;
    $('barra').hidden = !temAlgo || estado.finalizada;
    $('barraQtd').textContent = plural(qtd);
    $('barraValor').textContent = brl(valor);
    const mudou = alterado();
    $('btnSalvar').disabled = estado.ocupado || !mudou || estado.encerrada;
    $('btnFinalizar').disabled = estado.ocupado || qtd === 0 || estado.encerrada;
    const st = $('barraStatus');
    if (estado.ocupado) st.textContent = 'Salvando…';
    else if (mudou) st.textContent = 'Alterações não salvas';
    else if (estado.id && estado.salvoEm) st.textContent = `Salvo às ${estado.salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    else st.textContent = '';
  }

  // ---------------------------------------------------------------- placar ao vivo

  let totalExibido = 0;
  function atualizarPlacar(total, porBrinquedo) {
    animarNumero(totalExibido, total);
    totalExibido = total;
    $('meta').textContent = num(estado.meta);
    $('metaTexto').textContent = num(estado.meta);
    const pct = estado.meta > 0 ? Math.min(100, (total / estado.meta) * 100) : 0;
    $('barraPreench').style.width = `${pct}%`;
    $('barraMeta').setAttribute('aria-valuemax', String(estado.meta));
    $('barraMeta').setAttribute('aria-valuenow', String(total));
    $('metaPct').textContent = estado.meta > 0 ? `· ${Math.floor((total / estado.meta) * 100)}%` : '';
    if (porBrinquedo) {
      for (const b of estado.brinquedos) {
        if (porBrinquedo[b.id] != null) { b.total = porBrinquedo[b.id]; b._ui.promNum.textContent = num(b.total); }
      }
    }
  }

  function animarNumero(de, para) {
    const alvo = $('totalGeral');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || de === para) { alvo.textContent = num(para); return; }
    const t0 = performance.now(), dur = 700;
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      alvo.textContent = num(Math.round(de + (para - de) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  let timerTotais = null;
  function agendarTotais() {
    clearTimeout(timerTotais);
    timerTotais = setTimeout(buscarTotais, INTERVALO_TOTAIS);
  }
  async function buscarTotais() {
    if (document.hidden || Date.now() - estado.ultimaInteracao > PARAR_SEM_INTERACAO || estado.finalizada) { timerTotais = null; return; }
    try {
      const r = await fetch(`${API}/totais`);
      if (r.ok) {
        const t = await r.json();
        estado.meta = t.meta;
        atualizarPlacar(t.totalGeral, t.porBrinquedo);
        if (t.encerrada && !estado.encerrada) encerrar();
      }
    } catch { /* tenta de novo no próximo ciclo */ }
    agendarTotais();
  }
  function tocou() {
    const parado = timerTotais === null;
    estado.ultimaInteracao = Date.now();
    if (parado && !estado.finalizada) buscarTotais();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tocou(); });

  // ---------------------------------------------------------------- Turnstile (anti-robô)

  // Dois widgets: um flutuando acima da barra (Salvar) e outro dentro do formulário (Finalizar),
  // para a verificação aparecer sempre perto de onde a pessoa está clicando.
  const widgets = { pagina: null, modal: null };
  let pedidoToken = null;
  function prepararTurnstile() {
    if (estado.siteKey === 'dev') return;
    const opcoes = () => ({
      sitekey: estado.siteKey,
      execution: 'execute',
      appearance: 'interaction-only',
      language: 'pt-br',
      callback: (t) => { if (pedidoToken) { pedidoToken.resolve(t); pedidoToken = null; } esconderVerif(); },
      'error-callback': () => { if (pedidoToken) { pedidoToken.reject(new Error('turnstile')); pedidoToken = null; } esconderVerif(); },
      'before-interactive-callback': () => mostrarVerif(),
    });
    const tentar = () => {
      if (!window.turnstile) return setTimeout(tentar, 300);
      widgets.pagina = window.turnstile.render('#turnstile', opcoes());
      widgets.modal = window.turnstile.render('#turnstileModal', opcoes());
    };
    tentar();
  }
  function mostrarVerif() {
    if (!$('modal').open) $('turnstileCaixa').classList.add('verif--aberta');
  }
  function esconderVerif() { $('turnstileCaixa').classList.remove('verif--aberta'); }
  function obterToken() {
    return new Promise((resolve, reject) => {
      if (estado.siteKey === 'dev') return resolve('dev-token-local');
      const id = $('modal').open ? widgets.modal : widgets.pagina;
      if (!window.turnstile || id === null) return reject(new Error('turnstile'));
      pedidoToken = { resolve, reject };
      window.turnstile.reset(id);
      window.turnstile.execute(id);
      setTimeout(() => { if (pedidoToken) { pedidoToken.reject(new Error('turnstile')); pedidoToken = null; esconderVerif(); } }, 120000);
    });
  }

  // ---------------------------------------------------------------- salvar

  async function salvar() {
    if (estado.ocupado) return false;
    estado.ocupado = true; atualizarBarra();
    try {
      const corpo = { id: estado.id, itens: itensParaEnvio() };
      if (!estado.id) corpo.turnstile = await obterToken();
      const r = await postar(`${API}/doacao`, corpo);
      if (!r.ok) {
        if (r.status === 409) await sincronizarFinalizada();
        if (r.status === 400 && /Rascunho/.test(r.dados.erro || '')) estado.id = null;
        avisar(r.dados.erro || 'Não foi possível salvar. Tente novamente.', true);
        return false;
      }
      estado.id = r.dados.id;
      estado.salvo = { ...estado.escolha };
      estado.salvoEm = new Date();
      guardarLocal();
      avisar('Doação salva! Você ainda pode alterar antes de finalizar.');
      buscarTotaisAgora();
      return true;
    } catch (e) {
      avisar(e && e.message === 'turnstile'
        ? 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.'
        : 'Sem conexão. Verifique a internet e tente novamente.', true);
      return false;
    } finally {
      estado.ocupado = false; atualizarBarra();
    }
  }

  function itensParaEnvio() {
    const itens = {};
    for (const b of estado.brinquedos) itens[b.id] = estado.escolha[b.id] || 0;
    return itens;
  }

  async function buscarTotaisAgora() {
    try {
      const r = await fetch(`${API}/totais`);
      if (r.ok) { const t = await r.json(); atualizarPlacar(t.totalGeral, t.porBrinquedo); }
    } catch { /* ignora */ }
  }

  async function sincronizarFinalizada() {
    // A doação já foi finalizada (por exemplo, em outra aba): limpa e recomeça
    estado.id = null; estado.salvo = {};
    guardarLocal();
  }

  // ---------------------------------------------------------------- finalizar

  function abrirFinalizar() {
    const lista = $('modalItens');
    lista.innerHTML = '';
    for (const b of estado.brinquedos) {
      const q = estado.escolha[b.id] || 0;
      if (!q) continue;
      const li = document.createElement('li');
      li.append(el('span', '', `${q}× ${b.nome}`), el('span', '', brl(q * b.preco)));
      lista.append(li);
    }
    const { qtd, valor } = totalEscolha();
    $('modalTotal').textContent = `${plural(qtd)} · ${brl(valor)}`;
    $('modalErro').textContent = '';
    $('modal').showModal();
    setTimeout(() => $('campoNome').focus(), 50);
  }

  async function confirmar(ev) {
    ev.preventDefault();
    const nome = $('campoNome').value.trim();
    const whatsapp = $('campoWhats').value.replace(/\D/g, '');
    const email = $('campoEmail').value.trim();
    const erro = $('modalErro');
    if (nome.length < 2) return mostrarErro('Informe seu nome.', 'campoNome');
    if (whatsapp.length < 10 || whatsapp.length > 13) return mostrarErro('Informe um WhatsApp válido, com DDD.', 'campoWhats');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return mostrarErro('O e-mail parece inválido.', 'campoEmail');
    if (!$('campoAceite').checked) return mostrarErro('É preciso aceitar o aviso de privacidade.', 'campoAceite');
    erro.textContent = '';

    const btn = $('btnConfirmar');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      if (!estado.id) {
        const ok = await salvar();
        if (!ok) { mostrarErro('Não foi possível salvar sua doação. Tente novamente.'); return; }
      }
      const token = await obterToken();
      const r = await postar(`${API}/doacao/finalizar`, {
        id: estado.id, itens: itensParaEnvio(), nome, whatsapp, email, aceite: true, turnstile: token,
      });
      if (!r.ok) {
        if (r.status === 404) estado.id = null;
        mostrarErro(r.dados.erro || 'Não foi possível finalizar. Tente novamente.');
        return;
      }
      concluir(r.dados);
    } catch (e) {
      mostrarErro(e && e.message === 'turnstile'
        ? 'Não conseguimos confirmar que você não é um robô. Recarregue a página e tente de novo.'
        : 'Sem conexão. Verifique a internet e tente novamente.');
    } finally {
      btn.disabled = false; btn.textContent = 'Confirmar doação';
    }
  }

  function mostrarErro(msg, campo) {
    $('modalErro').textContent = msg;
    if (campo) $(campo).focus();
  }

  function concluir(d) {
    estado.finalizada = true;
    estado.id = null; estado.escolha = {}; estado.salvo = {};
    try { sessionStorage.removeItem(CHAVE_LOCAL); } catch { /* ignora */ }
    $('modal').close();
    $('toast').hidden = true;
    $('obrigadoNome').textContent = (d.doador && d.doador.nome ? d.doador.nome.split(' ')[0] : '');
    const tb = $('obrigadoItens');
    tb.innerHTML = '';
    for (const i of d.itens) {
      const tr = document.createElement('tr');
      tr.append(el('td', '', i.nome), el('td', '', String(i.quantidade)), el('td', '', brl(i.subtotal)));
      tb.append(tr);
    }
    $('obrigadoQtd').textContent = String(d.totalBrinquedos);
    $('obrigadoValor').textContent = brl(d.valorTotal);
    $('obrigadoValorPix').textContent = brl(d.valorTotal);
    const codigo = pixComValor(d.valorTotal);
    try { $('qrValor').src = qrDataUrl(codigo); } catch { $('qrValor').closest('figure').hidden = true; }
    $('btnCopiarValor').onclick = () => copiar(codigo, $('btnCopiarValor'), 'Código copiado! Cole no app do seu banco em PIX Copia e Cola.');
    const paraMim = `Minha doação para a Campanha de Natal da IPa: ${brl(d.valorTotal)}.\nCódigo PIX (copia e cola):\n${codigo}`;
    $('btnMeuWhats').href = `https://wa.me/?text=${encodeURIComponent(paraMim)}`;
    const msg = `Olá! Fiz uma doação de ${d.totalBrinquedos} brinquedo(s) na Campanha de Natal da IPa, no valor de ${brl(d.valorTotal)}. Segue o comprovante do PIX.`;
    $('linkComprovante').href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
    $('obrigadoInstrucoes').textContent = d.instrucoes || '';
    $('obrigadoInstrucoes').hidden = !d.instrucoes;
    document.querySelector('.hero').hidden = true;
    $('principal').hidden = true;
    $('barra').hidden = true;
    $('obrigado').hidden = false;
    window.scrollTo({ top: 0 });
    $('obrigado').focus();
  }

  // ---------------------------------------------------------------- campanha encerrada

  function encerrar() {
    estado.encerrada = true;
    $('avisoEncerrada').hidden = false;
    for (const b of estado.brinquedos) pintarCartao(b);
    atualizarBarra();
  }

  // ---------------------------------------------------------------- apoio

  async function postar(url, corpo) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(corpo),
    });
    let dados = {};
    try { dados = await r.json(); } catch { /* resposta vazia */ }
    return { ok: r.ok, status: r.status, dados };
  }

  function guardarLocal() {
    try { sessionStorage.setItem(CHAVE_LOCAL, JSON.stringify({ id: estado.id, escolha: estado.escolha, salvo: estado.salvo })); } catch { /* sem armazenamento */ }
  }
  function recuperarLocal() {
    try {
      const s = JSON.parse(sessionStorage.getItem(CHAVE_LOCAL) || 'null');
      if (!s) return;
      if (typeof s.id === 'string' && /^[0-9a-f-]{36}$/.test(s.id)) estado.id = s.id;
      for (const [fonte, destino] of [[s.escolha, estado.escolha], [s.salvo, estado.salvo]]) {
        if (fonte && typeof fonte === 'object') {
          for (const [k, v] of Object.entries(fonte)) if (Number.isInteger(v) && v > 0 && v <= 500) destino[k] = v;
        }
      }
    } catch { /* ignora */ }
  }

  let timerToast = null;
  function avisar(msg, erro = false) {
    const t = $('toast');
    t.textContent = msg;
    t.className = erro ? 'toast toast--erro' : 'toast';
    t.hidden = false;
    clearTimeout(timerToast);
    timerToast = setTimeout(() => { t.hidden = true; }, erro ? 6000 : 3500);
  }

  function el(tag, cls, texto) { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = texto; return e; }
  function botao(txt, rotulo) { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.setAttribute('aria-label', rotulo); return b; }

  // máscara simples de WhatsApp
  $('campoWhats').addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    let f = d;
    if (d.length > 2) f = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) f = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    e.target.value = f;
  });

  $('btnSalvar').addEventListener('click', salvar);
  $('btnFinalizar').addEventListener('click', abrirFinalizar);
  $('btnFechar').addEventListener('click', () => $('modal').close());
  $('formFinalizar').addEventListener('submit', confirmar);
  $('btnImprimir').addEventListener('click', () => window.print());

  window.addEventListener('beforeunload', (e) => {
    if (!estado.finalizada && totalEscolha().qtd > 0) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------------------------------------------------------------- PIX

  // Gera o código PIX (BR Code estático) com o valor embutido, a partir do código oficial da IPa.
  function crc16(txt) {
    let crc = 0xFFFF;
    const bytes = new TextEncoder().encode(txt);
    for (const b of bytes) {
      crc ^= b << 8;
      for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  function lerTLV(txt) {
    const campos = []; let i = 0;
    while (i + 4 <= txt.length) {
      const id = txt.slice(i, i + 2), tam = parseInt(txt.slice(i + 2, i + 4), 10);
      campos.push([id, txt.slice(i + 4, i + 4 + tam)]); i += 4 + tam;
    }
    return campos;
  }
  function pixComValor(centavos) {
    const valor = (centavos / 100).toFixed(2);
    const campos = lerTLV(PIX_COPIA_COLA).filter(([id]) => id !== '54' && id !== '63');
    const pos = campos.findIndex(([id]) => id === '58');
    campos.splice(pos, 0, ['54', valor]);
    const corpo = campos.map(([id, v]) => id + String(v.length).padStart(2, '0') + v).join('') + '6304';
    return corpo + crc16(corpo);
  }
  function qrDataUrl(texto) {
    const qr = window.qrcode(0, 'M');
    qr.addData(texto); qr.make();
    return qr.createDataURL(6, 16);
  }

  function montarPix() {
    for (const alvo of document.querySelectorAll('[data-pix]')) {
      alvo.innerHTML = '';
      const qr = document.createElement('figure');
      qr.className = 'pix__qr';
      const img = document.createElement('img');
      img.src = 'img/qrcode-pix.png'; img.alt = 'QR Code PIX da IPa Movimento Comunitário'; img.width = 220; img.height = 220; img.loading = 'lazy';
      qr.append(img, el('figcaption', '', 'Aponte a câmera do app do banco'));

      const lado = document.createElement('div');
      lado.className = 'pix__acoes';
      const b1 = document.createElement('button');
      b1.type = 'button'; b1.className = 'botao botao--primario botao--largo';
      b1.textContent = 'Copiar código PIX (copia e cola)';
      b1.addEventListener('click', () => copiar(PIX_COPIA_COLA, b1, 'Código copiado! Cole no app do seu banco.'));
      const chave = document.createElement('div');
      chave.className = 'pix__chave';
      chave.append(el('span', '', 'Chave PIX (CNPJ)'), el('strong', '', PIX_CNPJ_FORMATADO));
      const b2 = document.createElement('button');
      b2.type = 'button'; b2.className = 'botao botao--secundario';
      b2.textContent = 'Copiar chave';
      b2.addEventListener('click', () => copiar(PIX_CNPJ, b2, 'Chave PIX copiada!'));
      chave.append(b2);
      lado.append(b1, chave, el('p', 'pix__favorecido', 'Favorecido: IPA MOVIMENTO COMUNITARIO · Indaiatuba'));
      alvo.append(qr, lado);
    }
  }

  async function copiar(texto, botao, msg) {
    let ok = false;
    try { await navigator.clipboard.writeText(texto); ok = true; } catch { /* tenta o método antigo */ }
    if (!ok) {
      const t = document.createElement('textarea');
      t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.append(t); t.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      t.remove();
    }
    if (ok) {
      const original = botao.textContent;
      botao.textContent = 'Copiado ✓';
      setTimeout(() => { botao.textContent = original; }, 2500);
      avisar(msg);
    } else {
      avisar('Não foi possível copiar automaticamente. Selecione e copie manualmente.', true);
    }
  }

  montarPix();
  iniciar();
})();
