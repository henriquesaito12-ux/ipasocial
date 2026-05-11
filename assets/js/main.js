/* ===========================
   NAVBAR — Toggle mobile
   =========================== */

const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');

navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('active');
  navMenu.classList.toggle('active');
});

// Fecha menu ao clicar em um link
navMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('active');
    navMenu.classList.remove('active');
  });
});

/* ===========================
   NAVBAR — Scroll effect
   =========================== */

const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
  } else {
    navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
  }
});

/* ===========================
   GALERIA — Filtro por categoria
   =========================== */

const filtros = document.querySelectorAll('.galeria__filtro');
const galeriaItems = document.querySelectorAll('.galeria__item');

filtros.forEach(filtro => {
  filtro.addEventListener('click', () => {
    // Atualiza botão ativo
    filtros.forEach(f => f.classList.remove('galeria__filtro--ativo'));
    filtro.classList.add('galeria__filtro--ativo');

    const categoria = filtro.dataset.filter;

    galeriaItems.forEach(item => {
      if (categoria === 'todos' || item.dataset.category === categoria) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  });
});

/* ===========================
   IMPACTO — Contagem animada
   =========================== */

function animarNumero(el, target) {
  const duration = 2000;
  const start = performance.now();

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Easing: ease-out
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    el.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(update);
}

const impactoObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      const isText = el.dataset.text === 'true';

      if (!isText && target > 0) {
        animarNumero(el, target);
      }

      impactoObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.impacto__numero').forEach(el => {
  impactoObserver.observe(el);
});

/* ===========================
   CARROSSEL — Scroll contínuo
   =========================== */

(function () {
  const track = document.querySelector('.carrossel__track');
  if (!track) return;

  let offset = 0;
  const speed = 0.8; // px por frame

  function getHalfWidth() {
    const imgs = track.querySelectorAll('img:not([aria-hidden])');
    let w = 0;
    imgs.forEach(img => { w += img.offsetWidth; });
    w += (imgs.length) * 16; // gap
    return w;
  }

  let halfWidth = 0;

  function startScroll() {
    halfWidth = getHalfWidth();
    function step() {
      offset -= speed;
      if (Math.abs(offset) >= halfWidth) {
        offset += halfWidth;
      }
      track.style.transform = 'translateX(' + offset + 'px)';
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // esperar imagens carregarem para medir corretamente
  const imgs = track.querySelectorAll('img');
  let loaded = 0;
  imgs.forEach(img => {
    if (img.complete) {
      loaded++;
    } else {
      img.addEventListener('load', () => {
        loaded++;
        if (loaded === imgs.length) startScroll();
      });
    }
  });
  if (loaded === imgs.length) startScroll();

  window.addEventListener('resize', () => { halfWidth = getHalfWidth(); });
})();

/* ===========================
   PIX — Copiar chave
   =========================== */

const btnCopiarPix = document.getElementById('btnCopiarPix');
const pixChave = document.getElementById('pixChave');

if (btnCopiarPix) {
  btnCopiarPix.addEventListener('click', () => {
    const texto = pixChave.textContent;
    navigator.clipboard.writeText(texto).then(() => {
      const original = btnCopiarPix.textContent;
      btnCopiarPix.textContent = 'Copiado!';
      setTimeout(() => {
        btnCopiarPix.textContent = original;
      }, 2000);
    });
  });
}

/* ===========================
   FORMULÁRIOS — Envio por e-mail
   =========================== */

const emailDestino = 'ipasolidario01@gmail.com';

const formParceiro = document.getElementById('formParceiro');
if (formParceiro) {
  formParceiro.addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(formParceiro);
    const assunto = encodeURIComponent('Nova proposta de parceria — ' + dados.get('empresa'));
    const corpo = encodeURIComponent(
      'Empresa: ' + dados.get('empresa') + '\n' +
      'Responsável: ' + dados.get('contato') + '\n' +
      'E-mail: ' + dados.get('email') + '\n' +
      'Telefone: ' + (dados.get('telefone') || 'Não informado') + '\n' +
      'Mensagem: ' + (dados.get('mensagem') || 'Não informada')
    );
    window.location.href = 'mailto:' + emailDestino + '?subject=' + assunto + '&body=' + corpo;
  });
}

const formVoluntario = document.getElementById('formVoluntario');
if (formVoluntario) {
  formVoluntario.addEventListener('submit', (e) => {
    e.preventDefault();
    const dados = new FormData(formVoluntario);
    const assunto = encodeURIComponent('Novo voluntário — ' + dados.get('nome'));
    const corpo = encodeURIComponent(
      'Nome: ' + dados.get('nome') + '\n' +
      'E-mail: ' + dados.get('email') + '\n' +
      'WhatsApp: ' + dados.get('whatsapp') + '\n' +
      'Disponibilidade: ' + (dados.get('disponibilidade') || 'Não informada') + '\n' +
      'Como gostaria de ajudar: ' + (dados.get('habilidades') || 'Não informado')
    );
    window.location.href = 'mailto:' + emailDestino + '?subject=' + assunto + '&body=' + corpo;
  });
}

/* ===========================
   GLightbox — Inicialização
   =========================== */

if (typeof GLightbox !== 'undefined') {
  GLightbox({
    selector: '.glightbox',
    touchNavigation: true,
    loop: true,
  });
}

/* ===========================
   SCROLL REVEAL — Animação de entrada
   =========================== */

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.section, .card, .impacto__item, .contato__item').forEach(el => {
  el.classList.add('reveal');
  revealObserver.observe(el);
});

// CSS para reveal (adicionado via JS para não depender de CSS extra)
const style = document.createElement('style');
style.textContent = `
  .reveal {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .revealed {
    opacity: 1;
    transform: translateY(0);
  }
`;
document.head.appendChild(style);
