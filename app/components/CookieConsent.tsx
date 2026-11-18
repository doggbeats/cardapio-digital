"use client";

import { useEffect, useState } from "react";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  savedAt: string;
};

const COOKIE_NAME = "cardapio_cookie_consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;
const OPEN_EVENT = "cardapio:open-cookie-settings";

function readConsent(): Consent | null {
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
    const parsed = JSON.parse(value) as Partial<Consent>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      necessary: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
  } catch {
    return null;
  }
}

function saveConsent(analytics: boolean, marketing: boolean) {
  const value: Consent = {
    necessary: true,
    analytics,
    marketing,
    savedAt: new Date().toISOString(),
  };
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(value),
  )}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timer = 0;

    void Promise.resolve().then(() => {
      const saved = readConsent();
      if (!isMounted) return;
      if (!saved) {
        timer = window.setTimeout(() => setOpen(true), 700);
        return;
      }
      setAnalytics(saved.analytics);
      setMarketing(saved.marketing);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    function handleOpen() {
      const saved = readConsent();
      if (saved) {
        setAnalytics(saved.analytics);
        setMarketing(saved.marketing);
      }
      setCustomizing(true);
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_EVENT, handleOpen);
  }, []);

  function finish(nextAnalytics: boolean, nextMarketing: boolean) {
    saveConsent(nextAnalytics, nextMarketing);
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    setOpen(false);
    setCustomizing(false);
    setDetails(false);
  }

  if (!open) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="cookie-content">
        <div className="cookie-heading">
          <span className="cookie-icon" aria-hidden="true">*</span>
          <div>
            <h2 id="cookie-title">Sobre os cookies</h2>
            <p>
              Usamos cookies necessários para manter sua sessão, sua sacola e seus favoritos.
              Você pode autorizar cookies opcionais para nos ajudar a melhorar o cardápio.
            </p>
          </div>
        </div>

        {details && (
          <div className="cookie-details">
            <div>
              <strong>Necessários</strong>
              <span>Sessão do Supabase, sacola e favoritos. Não podem ser desativados.</span>
            </div>
            <div>
              <strong>Analíticos</strong>
              <span>Nos ajudam a entender quais itens são mais visitados.</span>
            </div>
            <div>
              <strong>Marketing</strong>
              <span>Permitem exibir ofertas relevantes. Nenhum script de terceiros é carregado sem sua autorização.</span>
            </div>
          </div>
        )}

        {customizing && (
          <div className="cookie-options">
            <label>
              <input type="checkbox" checked disabled />
              <span><strong>Necessários</strong> — sempre ativos</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
              />
              <span>Analíticos</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
              />
              <span>Marketing</span>
            </label>
          </div>
        )}

        <div className="cookie-actions">
          {customizing ? (
            <>
              <button className="cookie-accept" type="button" onClick={() => finish(analytics, marketing)}>
                Salvar preferências
              </button>
              <button className="cookie-secondary" type="button" onClick={() => finish(false, false)}>
                Recusar opcionais
              </button>
            </>
          ) : (
            <>
              <button className="cookie-accept" type="button" onClick={() => finish(true, true)}>
                Aceitar todos
              </button>
              <button className="cookie-secondary" type="button" onClick={() => finish(false, false)}>
                Recusar
              </button>
              <button className="cookie-link" type="button" onClick={() => setCustomizing(true)}>
                Personalizar
              </button>
            </>
          )}
          <button className="cookie-link" type="button" onClick={() => setDetails((value) => !value)}>
            {details ? "Ocultar detalhes" : "Saiba mais"}
          </button>
        </div>
      </div>
    </div>
  );
}
