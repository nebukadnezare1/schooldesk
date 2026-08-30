import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

export const sendVerificationCodeEmail = async (to: string, code: string) => {
    await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to,
        subject: 'Votre code de vérification SchoolDesk',
        text: `Votre code de vérification est : ${code}\n\nCe code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        html: `<div style="font-family:sans-serif;color:#18352b"><p>Voici votre code de vérification pour créer votre école sur SchoolDesk :</p><p style="font-size:28px;font-weight:600;letter-spacing:0.2em;margin:16px 0">${code}</p><p style="color:#557064;font-size:14px">Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p></div>`
    });
};
