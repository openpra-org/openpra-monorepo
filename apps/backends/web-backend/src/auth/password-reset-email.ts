import { EMAIL_LOGO_CID } from "./email-logo";

const SUBJECT = "Reset your OpenPRA password";
const SITE_URL = "https://openpra.org";
const HELP_ADDRESS = "info@openpra.org";
const VIOLET = "#8F4EC7";
const VIOLET_TEXT = "#7639AA";
const INK = "#1B1226";
const MUTED = "#675A72";
const MIST = "#F5F0FA";
const LINE = "#E3D8F0";
const WHITE = "#FFFFFF";
const FONT_UI = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "'STIX Two Text', Georgia, 'Times New Roman', serif";
const FONT_DATA = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";

export interface PasswordResetEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPasswordResetEmail(resetUrl: string, appBaseUrl: string): PasswordResetEmail {
  const link = escapeHtml(resetUrl);
  const home = escapeHtml(appBaseUrl);

  const text = [
    "Reset your OpenPRA password",
    "",
    "We received a request to reset the password for the OpenPRA account that uses this email address.",
    "",
    "Open this link to choose a new password. It works for one hour and only once.",
    "",
    resetUrl,
    "",
    "If you did not ask for this, you can ignore this email. Your password stays the same until you use the link.",
    "",
    "OpenPRA",
    SITE_URL,
    `This address does not accept replies. For help, write to ${HELP_ADDRESS}.`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background-color:${MIST};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Choose a new password. The link works for one hour.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${MIST};">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
<tr>
<td style="padding:0 0 24px 0;">
<a href="${home}" style="text-decoration:none;"><img src="cid:${EMAIL_LOGO_CID}" width="160" height="48" alt="OpenPRA" style="display:block;border:0;outline:none;width:160px;height:48px;"></a>
</td>
</tr>
<tr>
<td style="background-color:${WHITE};border:1px solid ${LINE};border-radius:12px;padding:40px 32px 32px 32px;">
<p style="margin:0 0 12px 0;font-family:${FONT_DATA};font-size:12px;line-height:16px;letter-spacing:0.18em;text-transform:uppercase;color:${VIOLET_TEXT};">Password reset</p>
<h1 style="margin:0 0 16px 0;font-family:${FONT_DISPLAY};font-size:28px;line-height:36px;font-weight:400;color:${INK};">Reset your password</h1>
<p style="margin:0 0 16px 0;font-family:${FONT_UI};font-size:16px;line-height:24px;color:${INK};">We received a request to reset the password for the OpenPRA account that uses this email address.</p>
<p style="margin:0 0 24px 0;font-family:${FONT_UI};font-size:16px;line-height:24px;color:${INK};">Choose a new password with the button below. The link works for one hour and only once.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
<tr>
<td bgcolor="${VIOLET}" style="background-color:${VIOLET};border-radius:8px;">
<a href="${link}" style="display:inline-block;padding:12px 24px;font-family:${FONT_UI};font-size:16px;line-height:24px;font-weight:500;color:${WHITE};text-decoration:none;border-radius:8px;">Choose a new password</a>
</td>
</tr>
</table>
<p style="margin:0 0 8px 0;font-family:${FONT_UI};font-size:14px;line-height:20px;color:${MUTED};">If the button does not open, copy this link into your browser:</p>
<p style="margin:0 0 24px 0;font-family:${FONT_DATA};font-size:13px;line-height:20px;word-break:break-all;"><a href="${link}" style="color:${VIOLET_TEXT};text-decoration:underline;">${link}</a></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="border-top:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td>
</tr>
</table>
<p style="margin:16px 0 0 0;font-family:${FONT_UI};font-size:14px;line-height:20px;color:${MUTED};">If you did not ask for this, you can ignore this email. Your password stays the same until you use the link.</p>
</td>
</tr>
<tr>
<td style="padding:24px 4px 0 4px;font-family:${FONT_UI};font-size:12px;line-height:18px;color:${MUTED};">
<p style="margin:0 0 4px 0;">OpenPRA · <a href="${SITE_URL}" style="color:${VIOLET_TEXT};text-decoration:none;">openpra.org</a></p>
<p style="margin:0;">This address does not accept replies. For help, write to <a href="mailto:${HELP_ADDRESS}" style="color:${VIOLET_TEXT};text-decoration:none;">${HELP_ADDRESS}</a>.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

  return { subject: SUBJECT, text, html };
}
