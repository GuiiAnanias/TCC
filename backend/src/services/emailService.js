import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Envio de e-mails do sistema por SMTP. Em desenvolvimento e na demonstração, o
// destino é o Mailpit do docker-compose, que guarda as mensagens sem enviá-las de fato.
let transporter;
function transport() {
  if (!transporter) {
    const { host, port, secure, user, pass } = env.mail;
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }
  return transporter;
}

export const emailService = {
  async enviar({ para, assunto, texto, html }) {
    await transport().sendMail({
      from: env.mail.from,
      to: para,
      subject: assunto,
      text: texto,
      html,
    });
  },
};
