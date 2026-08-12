/* ============ PRO SCOOTER SHOP — письма покупателям ============
   Отправка идёт через бесплатный сервис EmailJS с почтового ящика
   владельца магазина. Как подключить — см. ПОЧТА-НАСТРОЙКА.md.
   Пока window.EMAILJS_CONFIG не задан (файл email-config.js),
   письма не уходят — сайт работает в тестовом режиме. */

(function () {
  "use strict";

  window.MAILER = {
    get configured() { return !!window.EMAILJS_CONFIG; },

    /* Шлёт письмо покупателю. Возвращает "sent", если письмо ушло,
       и "test", если почта не подключена или сервис не ответил. */
    send: function (toEmail, subject, message) {
      var cfg = window.EMAILJS_CONFIG;
      if (!cfg) return Promise.resolve("test");
      return fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          template_params: { to_email: toEmail, subject: subject, message: message }
        })
      }).then(function (res) { return res.ok ? "sent" : "test"; })
        .catch(function () { return "test"; });
    }
  };
})();
