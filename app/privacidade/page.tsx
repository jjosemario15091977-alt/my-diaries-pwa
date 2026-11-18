import Link from "next/link";

export default function PrivacidadePage() {
  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6 text-slate-300">
      <Link href="/" className="text-blue-400 text-sm hover:underline">
        ← Voltar para o My Diaries
      </Link>
      <h1 className="text-2xl font-bold text-white">
        Política de Privacidade e Termos de Uso (LGPD)
      </h1>
      <p className="text-sm leading-relaxed">
        O <strong>My Diaries</strong> coleta exclusivamente seu e-mail de cadastro, nome de exibição e os registros de compromissos inseridos por texto ou voz para organização da sua agenda e disparo de lembretes programados.
      </p>
      <h2 className="text-lg font-semibold text-white">
        1. Processamento de Áudio e IA
      </h2>
      <p className="text-sm leading-relaxed">
        As gravações de voz são transmitidas de forma criptografada exclusivamente para transcrição e extração de data, horário e título do compromisso, não sendo comercializadas ou compartilhadas com terceiros.
      </p>
      <h2 className="text-lg font-semibold text-white">
        2. Seus Direitos e Exclusão Definitiva
      </h2>
      <p className="text-sm leading-relaxed">
        Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode excluir permanentemente sua conta e todos os eventos associados a qualquer momento na aba <strong>Perfil - Excluir Minha Conta</strong>.
      </p>
    </main>
  );
}