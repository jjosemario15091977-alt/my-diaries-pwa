"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Idioma = "pt" | "en" | "es";

interface Translations {
  [key: string]: {
    [key in Idioma]: string;
  };
}

const t: Translations = {
  appName: { pt: "My Diaries", en: "My Diaries", es: "My Diaries" },
  subtitle: { pt: "Agenda Inteligente por Voz", en: "Smart Voice Agenda", es: "Agenda Inteligente por Voz" },
  installApp: { pt: "Instalar App", en: "Install App", es: "Instalar App" },
  agenda: { pt: "Agenda", en: "Schedule", es: "Agenda" },
  agendar: { pt: "Agendar", en: "New Event", es: "Agendar" },
  perfil: { pt: "Perfil", en: "Profile", es: "Perfil" },
  todos: { pt: "Todos", en: "All", es: "Todos" },
  profissional: { pt: "Profissional", en: "Professional", es: "Profesional" },
  pessoal: { pt: "Pessoal", en: "Personal", es: "Personal" },
  nenhumCompromisso: {
    pt: "Nenhum compromisso encontrado na sua agenda.",
    en: "No events found in your schedule.",
    es: "No se encontraron eventos en tu agenda.",
  },
  novoPorVoz: {
    pt: "Criar compromisso agora",
    en: "Create event now",
    es: "Crear evento ahora",
  },
  faleNaturalmente: {
    pt: "Diga ou digite o que deseja agendar:",
    en: "Say or type what you want to schedule:",
    es: "Di o escribe lo que deseas agendar:",
  },
  exemploVoz: {
    pt: "“Reunião de alinhamento amanhã às 15h”",
    en: "“Alignment meeting tomorrow at 3 PM”",
    es: "“Reunión de alineación mañana a las 15:00”",
  },
  toqueParaFalar: { pt: "Toque para falar com a IA", en: "Tap to speak with AI", es: "Toca para hablar con la IA" },
  gravando: { pt: "Ouvindo... Toque para finalizar", en: "Listening... Tap to finish", es: "Escuchando... Toca para terminar" },
  transcrevendo: { pt: "Processando com Inteligência Artificial...", en: "Processing with Artificial Intelligence...", es: "Procesando con Inteligencia Artificial..." },
  digiteCompromisso: {
    pt: "Escreva os detalhes do seu compromisso...",
    en: "Type your event details...",
    es: "Escribe los detalles de tu evento...",
  },
  contaConectada: { pt: "Conta conectada", en: "Connected account", es: "Cuenta conectada" },
  notificacoesPush: {
    pt: "Notificações Inteligentes (Push)",
    en: "Smart Notifications (Push)",
    es: "Notificaciones Inteligentes (Push)",
  },
  ativado: { pt: "Ativado", en: "Enabled", es: "Activado" },
  ativar: { pt: "Ativar", en: "Enable", es: "Activar" },
  privacidadeTermos: {
    pt: "Política de Privacidade e LGPD",
    en: "Privacy Policy & Terms",
    es: "Política de Privacidad y Términos",
  },
  sairConta: { pt: "Sair da Conta", en: "Sign Out", es: "Cerrar Sesión" },
  excluirConta: {
    pt: "Excluir Conta e Dados (LGPD)",
    en: "Delete Account & Data",
    es: "Eliminar Cuenta y Datos",
  },
  idiomaLabel: { pt: "Idioma do Aplicativo", en: "App Language", es: "Idioma de la Aplicación" },
  oQueQuerFazer: { pt: "O que você quer fazer agora?", en: "What do you want to do now?", es: "¿Qué quieres hacer ahora?" },
  cardEscrever: { pt: "Escrever Compromisso", en: "Write Event", es: "Escribir Evento" },
  cardEscreverSub: { pt: "Digitar detalhes rapidamente com inteligência", en: "Type details quickly", es: "Escribir detalles rápido" },
  cardGravar: { pt: "Gravar Áudio com IA", en: "Record Audio with AI", es: "Grabar Audio con IA" },
  cardGravarSub: { pt: "Falar naturalmente o seu plano por voz", en: "Speak your plan naturally", es: "Hablar tu plan naturalmente" },
  voltarHub: { pt: "Voltar ao Início", en: "Back to Home", es: "Volver al Inicio" },
};

interface LanguageContextData {
  idioma: Idioma;
  setIdioma: (id: Idioma) => void;
  __(key: string): string;
}

const LanguageContext = createContext<LanguageContextData>({} as LanguageContextData);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [idioma, setIdiomaState] = useState<Idioma>("pt");

  useEffect(() => {
    const salvo = localStorage.getItem("my_diaries_lang") as Idioma;
    if (salvo && ["pt", "en", "es"].includes(salvo)) {
      setIdiomaState(salvo);
    }
  }, []);

  const setIdioma = (novo: Idioma) => {
    setIdiomaState(novo);
    localStorage.setItem("my_diaries_lang", novo);
  };

  const __ = (key: string): string => {
    if (t[key] && t[key][idioma]) {
      return t[key][idioma];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ idioma, setIdioma, __ }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);