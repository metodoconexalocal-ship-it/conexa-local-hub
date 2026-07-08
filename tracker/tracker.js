/*!
 * DC Tracker v2.0 — DigitalCreate Hub (Firebase/Firestore)
 * Rastreamento de origem de leads: UTM, referrer, cliques e conversões
 *
 * ── Como usar ──────────────────────────────────────────────────────────────
 *
 *  Cole ANTES do </body> na landing page do cliente:
 *
 *  <script>
 *    window.TRACKER_CONFIG = {
 *      projectId: 'crm-digitalcreate',
 *      apiKey:    'AIzaSyD775h8BBglzDCSx2jkC5hKT97qJGZ-MJg',
 *      site: 'nome-do-cliente',    // ex: 'escola-futebol' ou 'clinica-dental'
 *      whatsappTrack: true,        // injeta origem na mensagem do WA (padrão: true)
 *      autoTrackClicks: true,      // rastreia cliques automáticos (padrão: true)
 *    };
 *  </script>
 *  <script src="URL/tracker.js"></script>
 *
 * ── Regras do Firestore (Firebase Console > Firestore > Regras) ────────────
 *
 *  match /lead_sessions/{id} {
 *    allow create: if true;
 *    allow read, update, delete: if request.auth != null;
 *  }
 *  match /lead_events/{id} {
 *    allow create: if true;
 *    allow read, update, delete: if request.auth != null;
 *  }
 */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────────────────────────── */

  var CFG     = window.TRACKER_CONFIG || {};
  var SITE    = CFG.site      || window.location.hostname;
  var FB_PROJ = CFG.projectId || 'crm-digitalcreate';
  var FB_KEY  = CFG.apiKey    || 'AIzaSyD775h8BBglzDCSx2jkC5hKT97qJGZ-MJg';
  var FS_BASE = 'https://firestore.googleapis.com/v1/projects/' + FB_PROJ
    + '/databases/(default)/documents/';

  /* ── Utilitários ─────────────────────────────────────────────────────────── */

  function getParam(name) {
    try { return new URLSearchParams(window.location.search).get(name) || null; }
    catch (e) { return null; }
  }

  function deviceType() {
    return /Mobi|Android|iPhone|iPad|Windows Phone/i.test(navigator.userAgent)
      ? 'mobile' : 'desktop';
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /* ── Firestore REST helpers ──────────────────────────────────────────────── */

  function fsVal(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number')  return { doubleValue: v };
    if (typeof v === 'object') {
      var fields = {};
      Object.keys(v).forEach(function(k) { fields[k] = fsVal(v[k]); });
      return { mapValue: { fields: fields } };
    }
    return { stringValue: String(v) };
  }

  /* docId: passa UUID para usar PATCH (cria/substitui com ID fixo). Sem docId: POST (ID automático). */
  function fsInsert(coll, payload, docId) {
    if (typeof fetch === 'undefined') return;
    var fields = {};
    Object.keys(payload).forEach(function(k) { fields[k] = fsVal(payload[k]); });
    fields.created_at = { timestampValue: new Date().toISOString() };
    var url = FS_BASE + coll + (docId ? '/' + docId : '') + '?key=' + FB_KEY;
    fetch(url, {
      method:  docId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields: fields }),
      keepalive: true,
    }).catch(function () { /* silencioso */ });
  }

  /* ── Classificação de origem ─────────────────────────────────────────────── */

  function classify() {
    var src = (getParam('utm_source') || '').toLowerCase().trim();
    var med = (getParam('utm_medium') || '').toLowerCase().trim();
    var ref = (document.referrer || '').toLowerCase();

    /* UTM tem prioridade absoluta */
    if (src) {
      if (src === 'google') {
        if (med === 'cpc' || med === 'paid' || med === 'ppc')
          return { source: 'google_ads',     label: 'Google Ads',          medium: 'cpc' };
        return     { source: 'google_organic', label: 'Google Orgânico',     medium: 'organic' };
      }
      if (src === 'gmb' || src === 'google_business' || src === 'google-business' || src === 'gbp')
        return     { source: 'gmb',            label: 'Google Meu Negócio',  medium: 'gmb' };
      if (src === 'instagram' || src === 'ig')
        return     { source: 'instagram',      label: 'Instagram',            medium: med || 'social' };
      if (src === 'facebook' || src === 'fb')
        return     { source: 'facebook',       label: 'Facebook',             medium: med || 'social' };
      if (src === 'tiktok' || src === 'tt')
        return     { source: 'tiktok',         label: 'TikTok',               medium: med || 'social' };
      if (src === 'youtube' || src === 'yt')
        return     { source: 'youtube',        label: 'YouTube',              medium: med || 'social' };
      if (src === 'whatsapp' || src === 'wa')
        return     { source: 'whatsapp',       label: 'WhatsApp',             medium: med || 'messaging' };
      if (src === 'email' || src === 'newsletter')
        return     { source: 'email',          label: 'E-mail / Newsletter',  medium: med || 'email' };
      return       { source: src, label: src.charAt(0).toUpperCase() + src.slice(1), medium: med || 'other' };
    }

    /* Sem UTM — infere pelo referrer */
    if (!ref) return { source: 'direct', label: 'Direto / Digitado', medium: 'direct' };
    if (ref.includes('maps.google') || ref.includes('google.com/maps') || ref.includes('maps.app.goo.gl'))
      return { source: 'gmb',            label: 'Google Meu Negócio',  medium: 'gmb' };
    if (ref.includes('google.'))
      return { source: 'google_organic', label: 'Google Orgânico',     medium: 'organic' };
    if (ref.includes('instagram.com') || ref.includes('l.instagram.com'))
      return { source: 'instagram',      label: 'Instagram',            medium: 'social' };
    if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('m.facebook'))
      return { source: 'facebook',       label: 'Facebook',             medium: 'social' };
    if (ref.includes('tiktok.com'))
      return { source: 'tiktok',         label: 'TikTok',               medium: 'social' };
    if (ref.includes('youtube.com') || ref.includes('youtu.be'))
      return { source: 'youtube',        label: 'YouTube',              medium: 'social' };
    if (ref.includes('bing.com') || ref.includes('yahoo.com') || ref.includes('duckduckgo.com'))
      return { source: 'other_search',   label: 'Outro Buscador',       medium: 'organic' };
    if (ref.includes('whatsapp.com') || ref.includes('wa.me'))
      return { source: 'whatsapp',       label: 'WhatsApp',             medium: 'messaging' };
    return { source: 'referral', label: 'Indicação / Link', medium: 'referral' };
  }

  /* ── Sessão ──────────────────────────────────────────────────────────────── */

  var SESSION_STORAGE_KEY = 'dc_trk_session';
  var SESSION_SENT_KEY    = 'dc_trk_sent';
  var session = null;

  function initSession() {
    try {
      var stored = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY));
      if (stored && stored.id) { session = stored; return; }
    } catch (e) {}

    var cls = classify();
    session = {
      id:           uuid(),
      source:       cls.source,
      source_label: cls.label,
      medium:       cls.medium,
      campaign:     getParam('utm_campaign'),
      keyword:      getParam('utm_term'),
      ad_content:   getParam('utm_content'),
      landing_url:  window.location.href.substring(0, 500),
      referrer:     document.referrer || null,
      device:       deviceType(),
      site:         SITE,
      user_agent:   navigator.userAgent.substring(0, 250),
    };
    try { sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session)); } catch (e) {}
  }

  /* ── Registrar evento ────────────────────────────────────────────────────── */

  function trackEvent(type, data) {
    if (!session) return;
    fsInsert('lead_events', {
      session_id: session.id,
      event_type: type,
      event_data: data ? JSON.stringify(data) : null,
    });
  }

  /* ── Inicializa e envia sessão ───────────────────────────────────────────── */

  initSession();

  var alreadySent = false;
  try { alreadySent = !!sessionStorage.getItem(SESSION_SENT_KEY); } catch (e) {}

  if (!alreadySent) {
    try { sessionStorage.setItem(SESSION_SENT_KEY, '1'); } catch (e) {}
    fsInsert('lead_sessions', {
      source:       session.source,
      source_label: session.source_label,
      medium:       session.medium       || null,
      campaign:     session.campaign     || null,
      keyword:      session.keyword      || null,
      ad_content:   session.ad_content   || null,
      landing_url:  session.landing_url,
      referrer:     session.referrer,
      device:       session.device,
      site:         session.site,
      user_agent:   session.user_agent,
    }, session.id /* UUID vira o ID do documento Firestore */);
  }

  /* Pageview desta página */
  trackEvent('pageview', {
    page:  window.location.pathname,
    title: document.title.substring(0, 120),
  });

  /* ── Rastreamento automático de cliques ──────────────────────────────────── */

  if (CFG.autoTrackClicks !== false) {

    document.addEventListener('click', function (e) {
      var el = e.target;

      for (var depth = 0; depth < 5; depth++) {
        if (!el || el === document.body) break;

        var href = (el.getAttribute ? el.getAttribute('href') || '' : '').toLowerCase();
        var tag  = (el.tagName || '').toLowerCase();
        var text = (el.innerText || el.textContent || '').trim().substring(0, 80);
        var cls  = (el.className || '').toString().toLowerCase();

        /* ── WhatsApp ── */
        if (href.includes('wa.me') || href.includes('api.whatsapp') || href.includes('whatsapp.com/send')) {
          trackEvent('whatsapp_click', { text: text, source: session.source });

          if (CFG.whatsappTrack !== false && el.href) {
            try {
              var waUrl  = new URL(el.href);
              var oriMsg = '\n\n_[Origem: ' + session.source_label
                + (session.keyword  ? ' | Busca: '  + session.keyword  : '')
                + (session.campaign ? ' | Camp.: ' + session.campaign : '')
                + ']_';
              var curMsg = waUrl.searchParams.get('text') || '';
              waUrl.searchParams.set('text', curMsg + oriMsg);
              el.href = waUrl.toString();
            } catch (err) {}
          }
          return;
        }

        /* ── Telefone ── */
        if (href.startsWith('tel:')) {
          trackEvent('phone_click', { phone: href.replace('tel:', ''), text: text });
          return;
        }

        /* ── Google Maps ── */
        if (href.includes('maps.google') || href.includes('goo.gl/maps') || href.includes('maps.app.goo.gl')) {
          trackEvent('maps_click', { text: text });
          return;
        }

        /* ── Instagram ── */
        if (href.includes('instagram.com') && tag === 'a') {
          trackEvent('instagram_click', { text: text });
          return;
        }

        /* ── CTA genérico ── */
        if (
          (tag === 'button' || tag === 'a') &&
          (cls.includes('cta') || cls.includes('btn') || cls.includes('whatsapp') ||
           cls.includes('contato') || cls.includes('agendar'))
        ) {
          trackEvent('cta_click', { text: text, tag: tag, class: el.className.toString().substring(0, 100) });
          return;
        }

        el = el.parentElement;
      }
    }, true);

    /* ── Formulários ── */
    document.addEventListener('submit', function (e) {
      var form = e.target;
      trackEvent('form_submit', {
        form_id: form.id   || form.name || null,
        action:  (form.action || '').substring(0, 100),
      });
    }, true);
  }

  /* ── API pública para uso manual na LP ──────────────────────────────────── */

  window.DCTracker = {
    trackEvent: trackEvent,

    getSession: function () { return session ? Object.assign({}, session) : null; },

    getOriginLabel: function () {
      if (!session) return '';
      var parts = [session.source_label];
      if (session.keyword)  parts.push('🔍 ' + session.keyword);
      if (session.campaign) parts.push('📢 ' + session.campaign);
      return parts.join(' · ');
    },

    openWhatsApp: function (number, message) {
      var origin = '\n\n_[Origem: ' + session.source_label
        + (session.keyword ? ' | Busca: ' + session.keyword : '') + ']_';
      trackEvent('whatsapp_click', { number: number, source: session.source });
      var url = 'https://wa.me/' + number.replace(/\D/g, '')
        + '?text=' + encodeURIComponent((message || '') + origin);
      window.open(url, '_blank');
    },
  };

  if (CFG.debug) {
    console.group('[DC Tracker v2] Sessão iniciada');
    console.log('ID:', session.id);
    console.log('Origem:', session.source_label);
    console.log('Medium:', session.medium);
    if (session.keyword)  console.log('Palavra-chave:', session.keyword);
    if (session.campaign) console.log('Campanha:', session.campaign);
    console.log('Dispositivo:', session.device);
    console.log('Site:', session.site);
    console.log('Referrer:', session.referrer || '(nenhum)');
    console.groupEnd();
  }

})();
