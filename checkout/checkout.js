/* Checkout Orionnex — sem dependências. Sem innerHTML. Preço fixo exibido; o backend define o valor real. */
(function () {
  "use strict";

  var API = "";
  var statusEl = document.getElementById("checkout-status");
  var form = document.getElementById("checkout-form");
  var method = "pix";
  var idempotencyKey = genUuid();
  var pollTimer = null;
  var brickLoaded = false;

  function genUuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function setStatus(text, state) {
    statusEl.textContent = text;
    statusEl.setAttribute("data-state", state || "idle");
  }

  function setError(id, msg) {
    var el = document.querySelector('[data-err="' + id + '"]');
    if (el) el.textContent = msg || "";
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function validEmail(v) {
    return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(v) && v.length <= 120;
  }

  function validCpf(v) {
    var d = v.replace(/\D/g, "");
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    var sum = 0, i, mod;
    for (i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
    mod = (sum * 10) % 11;
    if (mod === 10) mod = 0;
    if (mod !== Number(d[9])) return false;
    sum = 0;
    for (i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
    mod = (sum * 10) % 11;
    if (mod === 10) mod = 0;
    return mod === Number(d[10]);
  }

  function validPhone(v) {
    var d = v.replace(/\D/g, "");
    return d.length === 10 || d.length === 11;
  }

  function customerData() {
    var ok = true;
    var name = val("f-name"), email = val("f-email"), cpf = val("f-cpf"), phone = val("f-phone");
    setError("f-name", ""); setError("f-email", ""); setError("f-cpf", ""); setError("f-phone", "");
    if (name.length < 3 || name.length > 80) { setError("f-name", "Informe seu nome completo."); ok = false; }
    if (!validEmail(email)) { setError("f-email", "Informe um e-mail válido."); ok = false; }
    if (!validCpf(cpf)) { setError("f-cpf", "Informe um CPF válido."); ok = false; }
    if (!validPhone(phone)) { setError("f-phone", "Informe um WhatsApp com DDD."); ok = false; }
    if (!ok) return null;
    return { name: name, email: email, cpf: cpf, whatsapp: phone };
  }

  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function checkStatus(orderId, done) {
    fetch(API + "/api/order-status?id=" + encodeURIComponent(orderId), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.status === "approved") {
          stopPoll();
          try { sessionStorage.setItem("orionnex_order", orderId); } catch (e) {}
          setStatus("Pagamento aprovado!", "approved");
          setTimeout(function () { window.location.href = "../obrigado/?order=" + encodeURIComponent(orderId); }, 1200);
        } else if (data.status === "rejected" || data.status === "cancelled" || data.status === "refunded") {
          stopPoll();
          setStatus("Pagamento não aprovado. Tente novamente ou fale no WhatsApp.", "rejected");
        } else {
          setStatus("Aguardando pagamento...", "pending");
        }
        if (done) done(data.status);
      })
      .catch(function () {
        setStatus("Não foi possível verificar o status agora. Aguarde ou fale no WhatsApp.", "error");
      });
  }

  function startPoll(orderId) {
    stopPoll();
    var tries = 0;
    setStatus("Aguardando pagamento...", "pending");
    pollTimer = setInterval(function () {
      tries += 1;
      if (tries > 120) { stopPoll(); return; } // ~10 min
      checkStatus(orderId);
    }, 5000);
  }

  // Abas de pagamento
  var tabPix = document.getElementById("tab-pix");
  var tabCard = document.getElementById("tab-card");
  var panelPix = document.getElementById("panel-pix");
  var panelCard = document.getElementById("panel-card");

  function selectTab(which) {
    method = which;
    var isPix = which === "pix";
    tabPix.setAttribute("aria-selected", String(isPix));
    tabCard.setAttribute("aria-selected", String(!isPix));
    panelPix.classList.toggle("active", isPix);
    panelCard.classList.toggle("active", !isPix);
    if (!isPix) loadBrick();
  }
  tabPix.addEventListener("click", function () { selectTab("pix"); });
  tabCard.addEventListener("click", function () { selectTab("card"); });

  // Fluxo Pix
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (method !== "pix") return;
    var customer = customerData();
    if (!customer) return;
    var btn = document.getElementById("btn-pix");
    btn.disabled = true;
    setStatus("Gerando Pix...", "processing");
    fetch(API + "/api/create-order", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ name: customer.name, email: customer.email, cpf: customer.cpf, whatsapp: customer.whatsapp, method: "pix" }),
    })
      .then(function (r) {
        if (r.status === 409) throw new Error("Pedido já enviado. Aguarde ou recarregue a página para nova tentativa.");
        if (!r.ok) throw new Error("Falha ao gerar o Pix.");
        return r.json();
      })
      .then(function (data) {
        if (!data.orderId || !data.pix || (!data.pix.qrCodeBase64 && !data.pix.qrCode)) {
          throw new Error("Resposta inválida do servidor.");
        }
        var box = document.getElementById("pix-result");
        box.hidden = false;
        if (data.pix.qrCodeBase64) {
          var qr = document.getElementById("pix-qr");
          qr.textContent = "";
          var img = document.createElement("img");
          img.src = "data:image/png;base64," + data.pix.qrCodeBase64;
          img.alt = "QR Code Pix para pagamento de R$647,90";
          qr.appendChild(img);
        }
        var code = document.getElementById("pix-code");
        code.textContent = data.pix.qrCode || "";
        // Nova tentativa futura usa outra chave: a atual já foi consumida.
        idempotencyKey = genUuid();
        startPoll(data.orderId);
      })
      .catch(function (err) {
        setStatus(err && err.message ? err.message : "Não foi possível processar o pagamento. Verifique os dados e tente novamente.", "error");
      })
      .finally(function () { btn.disabled = false; });
  });

  document.getElementById("btn-copy").addEventListener("click", function () {
    var code = document.getElementById("pix-code").textContent || "";
    function done() { setStatus("Código Pix copiado.", "pending"); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () { setStatus("Não foi possível copiar. Selecione o código manualmente.", "error"); });
    } else {
      setStatus("Selecione o código manualmente para copiar.", "error");
    }
  });

  // Card Payment Brick (Mercado Pago) — carregado sob demanda, só na aba cartão.
  function loadBrick() {
    if (brickLoaded) return;
    brickLoaded = true;
    setStatus("Carregando pagamento com cartão...", "processing");
    fetch(API + "/api/config", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("config");
        return r.json();
      })
      .then(function (cfg) {
        if (!cfg.publicKey) throw new Error("config");
        var s = document.createElement("script");
        s.src = "https://sdk.mercadopago.com/js/v2";
        s.onload = function () { initBrick(cfg.publicKey); };
        s.onerror = function () {
          setStatus("Não foi possível carregar o cartão agora. Tente o Pix ou fale no WhatsApp.", "error");
        };
        document.head.appendChild(s);
      })
      .catch(function () {
        setStatus("Checkout indisponível no momento. Tente novamente ou fale no WhatsApp.", "error");
      });
  }

  function initBrick(publicKey) {
    try {
      var mp = new window.MercadoPago(publicKey);
      var bricks = mp.bricks();
      bricks.create("cardPayment", "card-brick", {
        initialization: { amount: 647.9 },
        callbacks: {
          onReady: function () { setStatus("", "idle"); },
          onError: function () {
            setStatus("Não foi possível processar o pagamento. Verifique os dados e tente novamente.", "error");
          },
          onSubmit: function (formData) {
            var customer = customerData();
            if (!customer) return Promise.reject();
            setStatus("Processando pagamento...", "processing");
            return fetch(API + "/api/create-order", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
              body: JSON.stringify({
                name: customer.name,
                email: customer.email,
                cpf: customer.cpf,
                whatsapp: customer.whatsapp,
                method: "card",
                cardToken: formData.token,
                paymentMethodId: formData.payment_method_id,
                installments: formData.installments,
                identificationType: formData.payer && formData.payer.identification ? formData.payer.identification.type : undefined,
                identificationNumber: formData.payer && formData.payer.identification ? formData.payer.identification.number : undefined,
              }),
            })
              .then(function (r) {
                if (r.status === 409) throw new Error("Pagamento já enviado. Aguarde a confirmação.");
                if (!r.ok) throw new Error("Falha no pagamento.");
                return r.json();
              })
              .then(function (data) {
                idempotencyKey = genUuid();
                if (data.status === "approved" && data.orderId) {
                  try { sessionStorage.setItem("orionnex_order", data.orderId); } catch (e) {}
                  setStatus("Pagamento aprovado!", "approved");
                  setTimeout(function () { window.location.href = "../obrigado/?order=" + encodeURIComponent(data.orderId); }, 1200);
                } else if (data.orderId) {
                  startPoll(data.orderId);
                } else {
                  throw new Error("Resposta inválida do servidor.");
                }
              })
              .catch(function (err) {
                setStatus(err && err.message ? err.message : "Não foi possível processar o pagamento. Verifique os dados e tente novamente.", "error");
                throw err;
              });
          },
        },
      });
    } catch (e) {
      setStatus("Não foi possível carregar o cartão agora. Tente o Pix ou fale no WhatsApp.", "error");
    }
  }
})();
