/* ============================================================
   ORIONNEX — Rastreamento (LUGAR ÚNICO para pixels)
   ------------------------------------------------------------
   Cole aqui SOMENTE IDs PÚBLICOS:
     - META_PIXEL_ID  → ex: "123456789012345" (Meta Pixel)
     - GOOGLE_ADS_ID  → ex: "AW-123456789"   (Google Ads)
   Deixe "" (vazio) enquanto não tiver o ID: nada é carregado.

   NUNCA cole aqui: tokens de API, access token da API de
   Conversões (CAPI), senhas ou chaves privadas. Tudo neste
   arquivo vai para o navegador e pode ser lido por qualquer
   visitante. Segredos reais ficam SÓ em backend/servidor.
   (O ID do pixel em si é público por natureza — Meta/Google
   exigem isso; não é vazamento, é o funcionamento normal.)
   ============================================================ */
const TRACKING = {
  META_PIXEL_ID: "",
  GOOGLE_ADS_ID: "",
};

(function () {
  // Meta Pixel — carrega só se o ID estiver preenchido
  if (TRACKING.META_PIXEL_ID) {
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", TRACKING.META_PIXEL_ID);
    fbq("track", "PageView");
  }

  // Google Ads / gtag — carrega só se o ID estiver preenchido
  if (TRACKING.GOOGLE_ADS_ID) {
    var g = document.createElement("script");
    g.async = true;
    g.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(TRACKING.GOOGLE_ADS_ID);
    document.head.appendChild(g);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", TRACKING.GOOGLE_ADS_ID);
  }
})();
