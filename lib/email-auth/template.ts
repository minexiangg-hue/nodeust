const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );

export function authMailContent(purpose: 'verify' | 'reset', link: string) {
  const verify = purpose === 'verify';
  const title = verify ? 'Confirm your email address' : 'Reset your password';
  const intro = verify
    ? 'You requested a NODE account. Confirm your email address to finish signing up.'
    : 'We received a request to reset the password for your NODE account.';
  const action = verify ? 'Confirm email' : 'Reset password';
  const detail = verify
    ? 'This link is valid for 24 hours and can be used once. You will need the password you chose when signing up.'
    : 'This link is valid for 30 minutes and can be used once. After you reset your password, all existing sessions will be signed out.';
  const chinese = verify
    ? '你刚刚申请了 NODE 账号。请打开上方链接，并输入注册时设置的密码完成邮箱验证。链接 24 小时内有效，仅可使用一次。'
    : '我们收到了你的 NODE 账号密码重置请求。请打开上方链接设置新密码。链接 30 分钟内有效，仅可使用一次；重置后，所有已登录设备将退出。';
  const ignore = verify
    ? 'If you did not request this account, you can ignore this email. No account will be activated without verification.'
    : 'If you did not request a password reset, you can ignore this email. Your password will stay unchanged.';
  const footer = 'NODE is an independent campus community, not an official university service.';
  const safeLink = escapeHtml(link);
  return {
    subject: verify ? 'Verify your email for NODE' : 'Reset your NODE password',
    text: `${title}\n\n${intro}\n\n${action}:\n${link}\n\n${detail}\n\n${chinese}\n\n${ignore}\n若非本人操作，请忽略此邮件。请勿向他人转发此链接。\n\n${footer}\nNODE 是独立校园社区，并非学校官方服务。`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:24px 12px;background:#f5f6f5;color:#202a25;font-family:Arial,sans-serif;line-height:1.6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe5e1;border-radius:12px"><tr><td style="padding:28px">
<p style="margin:0 0 24px;font-size:18px;font-weight:bold;letter-spacing:2px;color:#245c43">NODE</p>
<h1 style="font-size:24px;line-height:1.3;margin:0 0 16px">${title}</h1>
<p>${intro}</p>
<p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:#245c43;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">${action}</a></p>
<p style="font-size:14px">${detail}</p>
<p lang="zh-CN" style="font-size:14px">${chinese.replace('上方链接', '上方按钮')}</p>
<p style="font-size:13px;color:#4c5851">If the button does not work, copy this link into your browser:<br><a href="${safeLink}" style="color:#245c43;word-break:break-all">${safeLink}</a></p>
<hr style="border:0;border-top:1px solid #e2e7e4;margin:24px 0">
<p style="font-size:13px;color:#4c5851">${ignore}</p>
<p lang="zh-CN" style="font-size:13px;color:#4c5851">若非本人操作，请忽略此邮件。请勿向他人转发此链接。</p>
<p style="font-size:12px;color:#4c5851;margin:24px 0 0">${footer}<br><span lang="zh-CN">NODE 是独立校园社区，并非学校官方服务。</span></p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
