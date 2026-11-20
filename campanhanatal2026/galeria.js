// Galeria "A IPa em ação": álbuns animados → mosaico → foto em tela cheia.
(() => {
  'use strict';
  const albuns = Array.isArray(window.GALERIA) ? window.GALERIA.filter((a) => a.fotos && a.fotos.length) : [];
  if (!albuns.length) return;

  const $ = (id) => document.getElementById(id);
  const base = (a) => `img/galeria/${a.pasta}/`;
  const pequena = (a, f) => base(a) + f + '-p.webp';
  const grande = (a, f) => base(a) + f + '-g.webp';
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const secao = $('galeria');
  const lista = $('galeriaAlbuns');
  secao.hidden = false;

  // ---------------- cartões dos álbuns (capas que trocam sozinhas)
  const capas = [];
  albuns.forEach((a, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'galeria__album';
    btn.setAttribute('aria-label', `Abrir álbum ${a.titulo}, ${a.fotos.length} fotos`);

    const capa = document.createElement('div');
    capa.className = 'galeria__capa';
    const amostra = a.fotos.slice(0, 5);
    amostra.forEach((f, i) => {
      const img = document.createElement('img');
      img.src = pequena(a, f); img.alt = ''; img.loading = 'lazy'; img.width = 600; img.height = 450;
      if (i === 0) img.className = 'ativa';
      capa.append(img);
    });

    const info = document.createElement('div');
    info.className = 'galeria__info';
    const t = document.createElement('h3'); t.textContent = a.titulo;
    const d = document.createElement('p'); d.textContent = a.descricao || '';
    const c = document.createElement('span'); c.className = 'galeria__qtd'; c.textContent = `${a.fotos.length} fotos · Ver álbum`;
    info.append(t, d, c);

    btn.append(capa, info);
    btn.addEventListener('click', () => abrirAlbum(idx));
    lista.append(btn);
    capas.push({ el: capa, i: 0, total: amostra.length, atraso: idx * 900 });
  });

  // setas: avançam/voltam uma "página" de álbuns (3 no computador, 1 no celular)
  const ant = $('galeriaAnt'), prox = $('galeriaProx');
  function atualizarSetas() {
    const max = lista.scrollWidth - lista.clientWidth;
    ant.disabled = lista.scrollLeft <= 8;
    prox.disabled = lista.scrollLeft >= max - 8;
    const unica = max <= 8;
    ant.hidden = prox.hidden = unica;
  }
  // animação própria (não depende das configurações de animação do Windows/navegador)
  let animando = false;
  function deslizarPara(destino) {
    const inicio = lista.scrollLeft, dist = destino - inicio, dur = 650, t0 = performance.now();
    if (Math.abs(dist) < 1) return;
    animando = true;
    lista.classList.add('galeria__albuns--animando');
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const passo = (agora) => {
      const t = Math.min(1, (agora - t0) / dur);
      lista.scrollLeft = inicio + dist * ease(t);
      if (t < 1) requestAnimationFrame(passo);
      else { lista.classList.remove('galeria__albuns--animando'); animando = false; atualizarSetas(); }
    };
    requestAnimationFrame(passo);
  }
  function pagina(dir) {
    if (animando) return;
    const card = lista.querySelector('.galeria__album');
    const gap = parseFloat(getComputedStyle(lista).columnGap) || 16;
    const largura = card.offsetWidth + gap;
    const porPagina = Math.max(1, Math.round((lista.clientWidth + gap) / largura));
    const max = lista.scrollWidth - lista.clientWidth;
    const atual = Math.round(lista.scrollLeft / largura);
    const destino = Math.max(0, Math.min(max, (atual + dir * porPagina) * largura));
    deslizarPara(destino);
  }
  ant.addEventListener('click', () => pagina(-1));
  prox.addEventListener('click', () => pagina(1));
  lista.addEventListener('scroll', () => requestAnimationFrame(atualizarSetas), { passive: true });
  addEventListener('resize', atualizarSetas);
  atualizarSetas();

  // troca as capas em sequência, só quando a seção está visível
  let visivel = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((e) => { visivel = e[0].isIntersecting; }, { threshold: 0.2 }).observe(secao);
  } else visivel = true;
  if (!calmo) {
    capas.forEach((c) => {
      if (c.total < 2) return;
      setTimeout(() => setInterval(() => {
        if (!visivel || document.hidden) return;
        const imgs = c.el.children;
        imgs[c.i].classList.remove('ativa');
        c.i = (c.i + 1) % c.total;
        imgs[c.i].classList.add('ativa');
      }, 3200), c.atraso);
    });
  }

  // ---------------- mosaico
  const modalAlbum = $('albumModal');
  let atual = 0;
  function abrirAlbum(idx) {
    atual = idx;
    const a = albuns[idx];
    $('albumTitulo').textContent = a.titulo;
    $('albumInfo').textContent = [a.descricao, `${a.fotos.length} fotos`].filter(Boolean).join(' · ');
    const caixa = $('albumMosaico');
    caixa.innerHTML = '';
    const m = document.createElement('div');
    m.className = 'album__grade';
    caixa.append(m);
    a.fotos.forEach((f, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'album__foto';
      b.setAttribute('aria-label', `Ampliar foto ${i + 1} de ${a.fotos.length}`);
      const img = document.createElement('img');
      img.src = pequena(a, f); img.alt = `${a.titulo}, foto ${i + 1}`; img.loading = 'lazy';
      b.append(img);
      b.addEventListener('click', () => abrirFoto(i));
      m.append(b);
    });
    document.body.classList.add('sem-rolagem');
    modalAlbum.showModal();
    caixa.scrollTop = 0;
  }
  function fecharAlbum() { modalAlbum.close(); }
  modalAlbum.addEventListener('close', () => document.body.classList.remove('sem-rolagem'));
  $('albumFechar').addEventListener('click', fecharAlbum);
  modalAlbum.addEventListener('click', (e) => { if (e.target === modalAlbum) fecharAlbum(); });

  // ---------------- foto em tela cheia
  const modalFoto = $('fotoModal');
  const imgFoto = $('fotoImg');
  let fotoIdx = 0;
  function mostrar(i) {
    const a = albuns[atual];
    fotoIdx = (i + a.fotos.length) % a.fotos.length;
    const f = a.fotos[fotoIdx];
    imgFoto.src = grande(a, f);
    imgFoto.alt = `${a.titulo}, foto ${fotoIdx + 1}`;
    $('fotoContador').textContent = `${fotoIdx + 1} / ${a.fotos.length}`;
    // pré-carrega a próxima
    const prox = a.fotos[(fotoIdx + 1) % a.fotos.length];
    const pre = new Image(); pre.src = grande(a, prox);
  }
  function abrirFoto(i) { mostrar(i); modalFoto.showModal(); }
  $('fotoFechar').addEventListener('click', () => modalFoto.close());
  $('fotoAnt').addEventListener('click', () => mostrar(fotoIdx - 1));
  $('fotoProx').addEventListener('click', () => mostrar(fotoIdx + 1));
  modalFoto.addEventListener('click', (e) => { if (e.target === modalFoto) modalFoto.close(); });
  modalFoto.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') mostrar(fotoIdx - 1);
    if (e.key === 'ArrowRight') mostrar(fotoIdx + 1);
  });
  // deslizar o dedo no celular
  let x0 = null;
  modalFoto.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  modalFoto.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) mostrar(fotoIdx + (dx < 0 ? 1 : -1));
  });
})();
