"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  Download,
  LogOut,
  MapPin,
  Mic,
  Plus,
  Send,
  Shield,
  Square,
  Trash2,
  User,
  Sparkles,
  ArrowLeft,
  FileText,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

interface Evento {
  id: string;
  title: string;
  category: "Pessoal" | "Profissional";
  start_at: string;
  end_at: string;
  location: string;
  description: string;
  transcription?: string;
}

function urlBase64ToUint8Array(base64String: string) {
  const clean = base64String.trim().replace(/^["']|["']$/g, "");
  const padding = "=".repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function MyDiariesApp() {
  const { idioma, setIdioma, __ } = useLanguage();

  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados de Onboarding e Fluxo Inicial
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [hubAction, setHubAction] = useState<"hub" | "escrever" | "gravar">("hub");

  // Estados de Autenticação & Avatar
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🦊");
  const [authMsg, setAuthMsg] = useState("");

  // FIX: Inicia diretamente na aba "novo" (Agendar) após o login
  const [activeTab, setActiveTab] = useState<"agenda" | "novo" | "perfil">("novo");
  const [filtroCategoria, setFiltroCategoria] = useState<"Todos" | "Pessoal" | "Profissional">("Todos");
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [textoComando, setTextoComando] = useState("");
  const [processandoIA, setProcessandoIA] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);

  // Gravação de Voz Nativa
  const [gravando, setGravando] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // PWA Install & Push Notifications
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pushAtivo, setPushAtivo] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("my_diaries_onboarding");
    if (hasSeenOnboarding) setShowOnboarding(false);

    async function initPWA() {
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.register("/sw.js");
          const existingSub = await reg.pushManager.getSubscription();
          if (existingSub && typeof Notification !== "undefined" && Notification.permission === "granted") {
            setPushAtivo(true);
          }
        } catch (err) {
          console.error("Erro ao registrar Service Worker:", err);
        }
      }
    }
    initPWA();

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    carregarEventos();
  }, [session]);

  async function carregarEventos() {
    try {
      const resp = await fetch(`${API_URL}/events`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setEventos(data.events || []);
        localStorage.setItem("my_diaries_cache", JSON.stringify(data.events || []));
      }
    } catch {
      const cached = localStorage.getItem("my_diaries_cache");
      if (cached) setEventos(JSON.parse(cached));
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthMsg("");
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName || email.split("@")[0], avatar: selectedAvatar } },
      });
      if (error) setAuthMsg(error.message);
      else setAuthMsg("Conta criada! Verifique seu e-mail ou faça login.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthMsg("E-mail ou senha incorretos.");
    }
  }

  async function instalarPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  async function ativarNotificacoesPush() {
    setFeedback(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setFeedback({ tipo: "erro", msg: "Este navegador não suporta notificações Web Push." });
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setFeedback({ tipo: "erro", msg: "Permissão de notificação negada no navegador." });
        return;
      }

      const keyResp = await fetch(`${API_URL}/vapid-public-key`);
      if (!keyResp.ok) {
        throw new Error(`Erro ao obter chave VAPID (${keyResp.status})`);
      }
      const data = await keyResp.json();
      const public_key = data.public_key;

      if (!public_key || !public_key.trim()) {
        setFeedback({ tipo: "erro", msg: "VAPID_PUBLIC_KEY vazia no .env da API." });
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        await existingSub.unsubscribe();
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });

      const subJson = subscription.toJSON();
      const subResp = await fetch(`${API_URL}/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || "",
          auth: subJson.keys?.auth || "",
          device_label: navigator.userAgent.slice(0, 60),
        }),
      });

      if (!subResp.ok) {
        const errData = await subResp.json().catch(() => ({}));
        throw new Error(errData.detail || `Falha ao salvar assinatura (${subResp.status})`);
      }

      setPushAtivo(true);
      setFeedback({ tipo: "ok", msg: "Alertas Push ativados com sucesso!" });
    } catch (err: any) {
      console.error("Detalhe do erro Push:", err);
      setPushAtivo(false);
      setFeedback({ tipo: "erro", msg: `Falha no Push: ${err?.message || "Erro desconhecido"}` });
    }
  }

  async function iniciarGravacao() {
    setFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await enviarParaIA(undefined, blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setGravando(true);
    } catch {
      setFeedback({ tipo: "erro", msg: "Permita o acesso ao microfone para falar seu compromisso." });
    }
  }

  function pararGravacao() {
    if (mediaRecorderRef.current && gravando) {
      mediaRecorderRef.current.stop();
      setGravando(false);
    }
  }

  async function enviarParaIA(texto?: string, audioBlob?: Blob) {
    setProcessandoIA(true);
    setFeedback(null);
    try {
      const formData = new FormData();
      if (texto) formData.append("texto", texto);
      if (audioBlob) formData.append("audio", audioBlob, "voz.webm");

      const resp = await fetch(`${API_URL}/events/ai`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) {
        setFeedback({ tipo: "erro", msg: data.detail || "Erro ao agendar." });
      } else {
        setTextoComando("");
        setFeedback({ tipo: "ok", msg: `Compromisso salvo: ${data.event.title}` });
        await carregarEventos();
        setHubAction("hub");
        setActiveTab("agenda");
      }
    } catch {
      setFeedback({ tipo: "erro", msg: "Sem conexão com o servidor." });
    } finally {
      setProcessandoIA(false);
    }
  }

  async function excluirEvento(id: string) {
    await fetch(`${API_URL}/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setEventos((prev) => prev.filter((e) => e.id !== id));
  }

  async function excluirContaLGPD() {
    const confirma = window.confirm(
      "Tem certeza? Todos os seus compromissos e dados serão apagados permanentemente (LGPD)."
    );
    if (!confirma) return;
    await fetch(`${API_URL}/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    await supabase.auth.signOut();
  }

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080c10]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center animate-pulse">
            <CalendarIcon className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="text-slate-300 font-medium text-sm">Carregando My Diaries...</div>
        </div>
      </div>
    );
  }

  // --- ONBOARDING ---
  if (!session && showOnboarding) {
    return (
      <main className="min-h-screen flex flex-col justify-between p-6 max-w-md mx-auto bg-[#080c10] text-slate-100">
        <div className="flex justify-end pt-2">
          <button
            onClick={() => {
              localStorage.setItem("my_diaries_onboarding", "true");
              setShowOnboarding(false);
            }}
            className="text-xs text-slate-400 hover:text-white font-medium"
          >
            Pular introdução
          </button>
        </div>

        <div className="text-center space-y-6 my-auto">
          <div className="w-24 h-24 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/20 text-slate-950">
            <CalendarIcon className="w-12 h-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-white">{__("appName")}</h1>
            <p className="text-slate-400 text-sm font-medium">{__("subtitle")}</p>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed max-w-xs mx-auto bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
            Deixe que o My Diaries lembra daquela reunião ou compromisso importante antes que você precise pensar nele. Simples, rápido e inteligente.
          </p>
        </div>

        <div className="space-y-3 pb-4">
          <button
            onClick={() => {
              localStorage.setItem("my_diaries_onboarding", "true");
              setShowOnboarding(false);
            }}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
          >
            Começar Experiência
          </button>
        </div>
      </main>
    );
  }

  // --- AUTENTICAÇÃO ---
  if (!session) {
    return (
      <main className="min-h-screen flex flex-col justify-center px-6 max-w-md mx-auto bg-[#080c10] text-slate-100">
        <div className="mb-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg text-slate-950">
            <CalendarIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{__("appName")}</h1>
          <p className="text-slate-400 text-xs mt-1">{__("subtitle")}</p>
        </div>

        <form onSubmit={handleAuth} className="bg-slate-900/70 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-2xl backdrop-blur-xl">
          {authMode === "signup" && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">Escolha seu Avatar</label>
              <div className="flex justify-around bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
                {["🦊", "🦉", "⚡", "🚀", "💡", "🌿"].map((av) => (
                  <button
                    type="button"
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    className={`text-xl p-2 rounded-xl transition ${selectedAvatar === av ? "bg-emerald-500/20 scale-110 border border-emerald-500" : "opacity-60 hover:opacity-100"}`}
                  >
                    {av}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Seu Nome</label>
                <input
                  type="text"
                  placeholder="Como prefere ser chamado"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Senha</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
              required
            />
          </div>
          {authMsg && <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">{authMsg}</p>}
          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
          >
            {authMode === "login" ? "Entrar no App" : "Criar Conta Grátis"}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
            className="w-full text-xs text-slate-400 hover:text-white pt-1 transition"
          >
            {authMode === "login" ? "Não tem conta? Cadastre-se" : "Já possui conta? Fazer login"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Ao continuar, você concorda com nossos{" "}
          <Link href="/privacidade" className="underline text-emerald-400 hover:text-emerald-300 transition">
            Termos e LGPD
          </Link>
          .
        </p>
      </main>
    );
  }

  const eventosFiltrados = eventos.filter((ev) =>
    filtroCategoria === "Todos" ? true : ev.category === filtroCategoria
  );

  const totalProfissional = eventos.filter(e => e.category === "Profissional").length;
  const totalPessoal = eventos.filter(e => e.category === "Pessoal").length;

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto flex flex-col bg-[#080c10] text-slate-100">
      {/* Cabeçalho Superior Clean */}
      <header className="sticky top-0 z-20 bg-[#080c10]/90 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              {__("appName")} <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">{__("subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {deferredPrompt && (
            <button
              onClick={instalarPWA}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-slate-800 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" /> {__("installApp")}
            </button>
          )}
          <button
            onClick={ativarNotificacoesPush}
            title="Ativar notificações"
            className={`p-2.5 rounded-xl border transition shadow-sm ${
              pushAtivo
                ? "bg-slate-900 border-slate-700 text-emerald-400"
                : "bg-slate-900 border-slate-700 text-amber-400 hover:bg-slate-800 animate-pulse"
            }`}
          >
            <Bell className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Banner de Feedback */}
      {feedback && (
        <div
          className={`mx-6 mt-4 p-4 rounded-2xl text-xs font-medium flex items-center gap-3 shadow-lg ${
            feedback.tipo === "ok"
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
              : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="leading-relaxed">{feedback.msg}</span>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="flex-1 px-6 pt-6">
        {activeTab === "agenda" && (
          <div className="space-y-5">
            {/* Bloco de Resumo / Estatísticas */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-lg flex items-center justify-around backdrop-blur-md">
              <div className="text-center">
                <span className="text-2xl font-black text-white">{eventos.length}</span>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">Total</p>
              </div>
              <div className="w-[1px] h-8 bg-slate-800"></div>
              <div className="text-center">
                <span className="text-2xl font-black text-emerald-400">{totalProfissional}</span>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">{__("profissional")}</p>
              </div>
              <div className="w-[1px] h-8 bg-slate-800"></div>
              <div className="text-center">
                <span className="text-2xl font-black text-cyan-400">{totalPessoal}</span>
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">{__("pessoal")}</p>
              </div>
            </div>

            {/* Filtros em Pílula */}
            <div className="flex gap-2 p-1 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-sm">
              {(["Todos", "Profissional", "Pessoal"] as const).map((cat) => {
                const labelCat =
                  cat === "Todos"
                    ? __("todos")
                    : cat === "Profissional"
                    ? __("profissional")
                    : __("pessoal");
                return (
                  <button
                    key={cat}
                    onClick={() => setFiltroCategoria(cat)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition ${
                      filtroCategoria === cat
                        ? "bg-slate-800 text-white shadow border border-slate-700"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {labelCat}
                  </button>
                );
              })}
            </div>

            {eventosFiltrados.length === 0 ? (
              <div className="text-center py-20 px-6 bg-slate-900/40 border border-slate-800/80 rounded-3xl shadow-lg flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-1">
                  <CalendarIcon className="w-8 h-8 opacity-70" />
                </div>
                <p className="text-slate-300 text-sm font-medium">{__("nenhumCompromisso")}</p>
                <button
                  onClick={() => { setActiveTab("novo"); setHubAction("hub"); }}
                  className="inline-flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" /> {__("novoPorVoz")}
                </button>
              </div>
            ) : (
              <div className="space-y-3.5">
                {eventosFiltrados.map((ev) => {
                  const dataObj = new Date(ev.start_at);
                  const diaStr = dataObj.toLocaleDateString(
                    idioma === "en" ? "en-US" : idioma === "es" ? "es-ES" : "pt-BR",
                    { weekday: "short", day: "2-digit", month: "short" }
                  );
                  const horaStr = dataObj.toLocaleTimeString(
                    idioma === "en" ? "en-US" : idioma === "es" ? "es-ES" : "pt-BR",
                    { hour: "2-digit", minute: "2-digit" }
                  );
                  const isProf = ev.category === "Profissional";
                  return (
                    <div
                      key={ev.id}
                      className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-lg transition hover:border-slate-700 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                              isProf
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            }`}
                          >
                            {isProf ? __("profissional") : __("pessoal")}
                          </span>
                          <h3 className="text-base font-bold text-white mt-2 group-hover:text-emerald-300 transition">
                            {ev.title}
                          </h3>
                        </div>
                        <button
                          onClick={() => excluirEvento(ev.id)}
                          className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition"
                          title="Excluir evento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-300 font-medium bg-slate-950/60 border border-slate-800/80 px-3 py-2 rounded-xl w-fit">
                        <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{diaStr} às {horaStr}</span>
                      </div>

                      {ev.location && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-950/40 border border-slate-800/80 px-3 py-2 rounded-xl transition w-full"
                        >
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate underline">{ev.location}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "novo" && (
          <div className="space-y-6 pt-2">
            {/* PAINEL 3: O HUB CENTRAL DE ESCOLHA ("O que você quer fazer agora?") */}
            {hubAction === "hub" && (
              <div className="space-y-5 animate-fadeIn">
                <div className="text-center pb-1">
                  <h2 className="text-xl font-black text-white">{__("oQueQuerFazer")}</h2>
                  <p className="text-xs text-slate-400 mt-1">Escolha como prefere registrar o seu compromisso</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Card 1: Escrever */}
                  <button
                    onClick={() => setHubAction("escrever")}
                    className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 p-6 rounded-3xl text-left transition shadow-lg flex items-center gap-4 group backdrop-blur-md"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition shrink-0">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">{__("cardEscrever")}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{__("cardEscreverSub")}</p>
                    </div>
                  </button>

                  {/* Card 2: Gravar Áudio */}
                  <button
                    onClick={() => setHubAction("gravar")}
                    className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 p-6 rounded-3xl text-left transition shadow-lg flex items-center gap-4 group backdrop-blur-md"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 group-hover:scale-105 transition shrink-0">
                      <Radio className="w-7 h-7 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition">{__("cardGravar")}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{__("cardGravarSub")}</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* PAINEL 4A: EXECUÇÃO - GRAVAR ÁUDIO */}
            {hubAction === "gravar" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setHubAction("hub")}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> {__("voltarHub")}
                  </button>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-7 text-center space-y-5 shadow-xl backdrop-blur-md">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">{__("faleNaturalmente")}</p>
                    <p className="text-xs text-slate-300 italic bg-slate-950 border border-slate-800 py-2.5 px-4 rounded-xl mt-2 inline-block">
                      {__("exemploVoz")}
                    </p>
                  </div>

                  <div className="py-4">
                    {!gravando ? (
                      <button
                        onClick={iniciarGravacao}
                        disabled={processandoIA}
                        className="w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 hover:opacity-95 mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50 border-4 border-slate-950 text-slate-950"
                      >
                        <Mic className="w-10 h-10 animate-pulse" />
                      </button>
                    ) : (
                      <button
                        onClick={pararGravacao}
                        className="w-28 h-28 rounded-full bg-gradient-to-tr from-rose-600 to-pink-600 animate-pulse mx-auto flex items-center justify-center shadow-xl shadow-rose-600/30 border-4 border-slate-950 text-white"
                      >
                        <Square className="w-10 h-10" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-400 tracking-wide">
                    {processandoIA ? __("transcrevendo") : gravando ? __("gravando") : __("toqueParaFalar")}
                  </p>
                </div>
              </div>
            )}

            {/* PAINEL 4B: EXECUÇÃO - ESCREVER TEXTO */}
            {hubAction === "escrever" && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setHubAction("hub")}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition"
                  >
                    <ArrowLeft className="w-4 h-4" /> {__("voltarHub")}
                  </button>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl backdrop-blur-md">
                  <p className="text-sm font-semibold text-white">{__("faleNaturalmente")}</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (textoComando.trim()) enviarParaIA(textoComando);
                    }}
                    className="space-y-3"
                  >
                    <textarea
                      rows={4}
                      placeholder={__("digiteCompromisso")}
                      value={textoComando}
                      onChange={(e) => setTextoComando(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
                    />
                    <button
                      type="submit"
                      disabled={processandoIA || !textoComando.trim()}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 py-3.5 rounded-2xl text-slate-950 font-bold disabled:opacity-40 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Salvar com Inteligência Artificial
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "perfil" && (
          <div className="space-y-4 pt-1">
            {/* Card de Perfil */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg text-2xl text-slate-950 font-bold">
                  {selectedAvatar || "🦊"}
                </div>
                <div className="overflow-hidden">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{__("contaConectada")}</p>
                  <p className="text-sm font-bold text-white truncate mt-0.5">{session.user.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 text-center">
                  <span className="text-lg font-bold text-emerald-400">{eventos.length}</span>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">{__("agenda")}</p>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 text-center">
                  <span className="text-lg font-bold text-teal-400">{pushAtivo ? "Ativo" : "Off"}</span>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Push</p>
                </div>
              </div>
            </div>

            {/* Seletor de Idioma */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex items-center justify-between text-sm shadow-xl">
              <span className="flex items-center gap-3 text-slate-300 font-medium">
                <span className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 text-base">🌐</span>
                {__("idiomaLabel")}
              </span>
              <select
                value={idioma}
                onChange={(e) => setIdioma(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 cursor-pointer transition"
              >
                <option value="pt">Português (BR)</option>
                <option value="en">English (US)</option>
                <option value="es">Español</option>
              </select>
            </div>

            <button
              onClick={ativarNotificacoesPush}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex items-center justify-between text-sm shadow-xl hover:border-slate-700 transition"
            >
              <span className="flex items-center gap-3 text-slate-300 font-medium">
                <span className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Bell className="w-4 h-4" />
                </span>
                {__("notificacoesPush")}
              </span>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {pushAtivo ? __("ativado") : __("ativar")}
              </span>
            </button>

            <Link
              href="/privacidade"
              className="w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex items-center gap-3 text-sm text-slate-300 font-medium shadow-xl hover:border-slate-700 transition"
            >
              <span className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                <Shield className="w-4 h-4" />
              </span>
              {__("privacidadeTermos")}
            </Link>

            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-4 flex items-center gap-3 text-sm text-slate-300 font-medium shadow-xl hover:border-slate-700 transition"
            >
              <span className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
                <LogOut className="w-4 h-4" />
              </span>
              {__("sairConta")}
            </button>

            <button
              onClick={excluirContaLGPD}
              className="w-full bg-rose-950/20 border border-rose-900/30 rounded-3xl p-4 flex items-center gap-3 text-sm text-rose-300 font-medium shadow-xl hover:bg-rose-950/40 transition"
            >
              <span className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Trash2 className="w-4 h-4" />
              </span>
              {__("excluirConta")}
            </button>
          </div>
        )}
      </main>

      {/* Barra de Navegação Inferior Flutuante */}
      <nav className="fixed bottom-4 inset-x-5 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl max-w-md mx-auto grid grid-cols-3 p-2 shadow-2xl z-30">
        <button
          onClick={() => { setActiveTab("agenda"); setHubAction("hub"); }}
          className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl text-xs font-medium transition ${
            activeTab === "agenda"
              ? "bg-slate-800 border border-slate-700 text-white font-bold shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CalendarIcon className="w-5 h-5" />
          {__("agenda")}
        </button>

        <button
          onClick={() => { setActiveTab("novo"); setHubAction("hub"); }}
          className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl text-xs font-medium transition ${
            activeTab === "novo"
              ? "bg-slate-800 border border-slate-700 text-white font-bold shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Plus className="w-5 h-5" />
          {__("agendar")}
        </button>

        <button
          onClick={() => { setActiveTab("perfil"); setHubAction("hub"); }}
          className="flex flex-col items-center gap-1 py-2.5 rounded-2xl text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <User className="w-5 h-5" />
          {__("perfil")}
        </button>
      </nav>
    </div>
  );
}