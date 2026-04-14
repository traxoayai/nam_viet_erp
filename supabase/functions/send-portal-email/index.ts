import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EmailType = 'registration_received' | 'registration_approved' | 'registration_rejected'
  | 'admin_new_registration' | 'admin_new_order' | 'admin_payment_received'

interface EmailPayload {
  type: EmailType
  email: string
  data: {
    business_name?: string
    portal_url?: string
    reason?: string
    contact_name?: string
    contact_email?: string
    contact_phone?: string
    order_code?: string
    customer_name?: string
    total_amount?: number
    amount?: string
    partner_name?: string
    reference?: string
    description?: string
  }
}

function buildHtmlEmail(
  type: EmailType,
  data: EmailPayload['data'],
): { subject: string; html: string } {
  const brandColor = '#0d9488'
  const brandName = 'Nam Vi\u1EC7t'

  const wrapper = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${brandColor};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${brandName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
                &copy; ${new Date().getFullYear()} ${brandName}. T\u1EA5t c\u1EA3 quy\u1EC1n \u0111\u01B0\u1EE3c b\u1EA3o l\u01B0u.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const businessLabel = data.business_name
    ? `<strong>${data.business_name}</strong>`
    : 'Qu\u00FD kh\u00E1ch'

  switch (type) {
    case 'registration_received': {
      const subject = `[${brandName}] \u0110\u00E3 nh\u1EADn \u0111\u01A1n \u0111\u0103ng k\u00FD c\u1EE7a b\u1EA1n`
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">X\u00E1c nh\u1EADn \u0111\u01A1n \u0111\u0103ng k\u00FD</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin ch\u00E0o ${businessLabel},
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Ch\u00FAng t\u00F4i \u0111\u00E3 nh\u1EADn \u0111\u01B0\u1EE3c \u0111\u01A1n \u0111\u0103ng k\u00FD c\u1EE7a b\u1EA1n tr\u00EAn h\u1EC7 th\u1ED1ng <strong>${brandName}</strong>.
          \u0110\u01A1n c\u1EE7a b\u1EA1n \u0111ang \u0111\u01B0\u1EE3c xem x\u00E9t v\u00E0 ch\u00FAng t\u00F4i s\u1EBD th\u00F4ng b\u00E1o k\u1EBFt qu\u1EA3 trong th\u1EDDi gian s\u1EDBm nh\u1EA5t.
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <p style="margin:0;color:#0f766e;font-size:14px;">
            <strong>Tr\u1EA1ng th\u00E1i:</strong> \u0110ang ch\u1EDD duy\u1EC7t
          </p>
        </div>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          N\u1EBFu b\u1EA1n c\u00F3 th\u1EAFc m\u1EAFc, vui l\u00F2ng li\u00EAn h\u1EC7 b\u1ED9 ph\u1EADn h\u1ED7 tr\u1EE3 c\u1EE7a ch\u00FAng t\u00F4i.
        </p>`
      return { subject, html: wrapper(subject, body) }
    }

    case 'registration_approved': {
      const subject = `[${brandName}] T\u00E0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\u00E3 \u0111\u01B0\u1EE3c k\u00EDch ho\u1EA1t`
      const portalUrl = data.portal_url || '#'
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">T\u00E0i kho\u1EA3n \u0111\u00E3 k\u00EDch ho\u1EA1t</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin ch\u00E0o ${businessLabel},
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Ch\u00FAc m\u1EEBng! \u0110\u01A1n \u0111\u0103ng k\u00FD c\u1EE7a b\u1EA1n \u0111\u00E3 \u0111\u01B0\u1EE3c ph\u00EA duy\u1EC7t. T\u00E0i kho\u1EA3n tr\u00EAn h\u1EC7 th\u1ED1ng
          <strong>${brandName}</strong> \u0111\u00E3 s\u1EB5n s\u00E0ng s\u1EED d\u1EE5ng.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${portalUrl}"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            \u0110\u0103ng nh\u1EADp Portal
          </a>
        </div>
        <p style="margin:0 0 12px;color:#6b7280;font-size:13px;text-align:center;">
          Ho\u1EB7c truy c\u1EADp: <a href="${portalUrl}" style="color:${brandColor};">${portalUrl}</a>
        </p>
        <p style="margin:16px 0 0;color:#6b7280;font-size:14px;">
          N\u1EBFu b\u1EA1n c\u00F3 th\u1EAFc m\u1EAFc, vui l\u00F2ng li\u00EAn h\u1EC7 b\u1ED9 ph\u1EADn h\u1ED7 tr\u1EE3 c\u1EE7a ch\u00FAng t\u00F4i.
        </p>`
      return { subject, html: wrapper(subject, body) }
    }

    case 'registration_rejected': {
      const subject = `[${brandName}] Th\u00F4ng b\u00E1o v\u1EC1 \u0111\u01A1n \u0111\u0103ng k\u00FD`
      const reason = data.reason || 'Kh\u00F4ng \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n'
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">K\u1EBFt qu\u1EA3 x\u00E9t duy\u1EC7t</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin ch\u00E0o ${businessLabel},
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Sau khi xem x\u00E9t, ch\u00FAng t\u00F4i r\u1EA5t ti\u1EBFc ph\u1EA3i th\u00F4ng b\u00E1o r\u1EB1ng \u0111\u01A1n \u0111\u0103ng k\u00FD
          c\u1EE7a b\u1EA1n tr\u00EAn h\u1EC7 th\u1ED1ng <strong>${brandName}</strong> ch\u01B0a \u0111\u01B0\u1EE3c ch\u1EA5p thu\u1EADn.
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
          <p style="margin:0;color:#991b1b;font-size:14px;">
            <strong>L\u00FD do:</strong> ${reason}
          </p>
        </div>
        <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
          B\u1EA1n c\u00F3 th\u1EC3 li\u00EAn h\u1EC7 b\u1ED9 ph\u1EADn h\u1ED7 tr\u1EE3 \u0111\u1EC3 \u0111\u01B0\u1EE3c t\u01B0 v\u1EA5n th\u00EAm ho\u1EB7c n\u1ED9p \u0111\u01A1n m\u1EDBi sau khi
          \u0111\u00E3 b\u1ED5 sung \u0111\u1EA7y \u0111\u1EE7 th\u00F4ng tin c\u1EA7n thi\u1EBFt.
        </p>`
      return { subject, html: wrapper(subject, body) }
    }

    case 'admin_new_registration': {
      const bName = data.business_name || 'Kh\u00F4ng r\u00F5'
      const subject = `[${brandName}] \u0110\u0103ng k\u00FD Portal m\u1EDBi: ${bName}`
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">\u0110\u0103ng k\u00FD Portal m\u1EDBi</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          C\u00F3 m\u1ED9t \u0111\u01A1n \u0111\u0103ng k\u00FD Portal m\u1EDBi c\u1EA7n duy\u1EC7t:
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Doanh nghi\u1EC7p:</td>
              <td style="padding:4px 8px;">${bName}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Ng\u01B0\u1EDDi li\u00EAn h\u1EC7:</td>
              <td style="padding:4px 8px;">${data.contact_name || '\u2014'}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Email:</td>
              <td style="padding:4px 8px;">${data.contact_email || '\u2014'}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">\u0110i\u1EC7n tho\u1EA1i:</td>
              <td style="padding:4px 8px;">${data.contact_phone || '\u2014'}</td>
            </tr>
          </table>
        </div>
        <div style="margin:24px 0;text-align:center;">
          <a href="#/portal/registrations"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Xem & Duy\u1EC7t \u0111\u01A1n
          </a>
        </div>`
      return { subject, html: wrapper(subject, body) }
    }

    case 'admin_new_order': {
      const orderCode = data.order_code || 'N/A'
      const custName = data.customer_name || 'Kh\u00E1ch h\u00E0ng'
      const totalAmt = data.total_amount != null
        ? new Intl.NumberFormat('vi-VN').format(data.total_amount) + ' \u0111'
        : '0 \u0111'
      const subject = `[${brandName}] \u0110\u01A1n h\u00E0ng Portal m\u1EDBi: ${orderCode}`
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">\u0110\u01A1n h\u00E0ng Portal m\u1EDBi</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          C\u00F3 \u0111\u01A1n h\u00E0ng m\u1EDBi t\u1EEB Portal c\u1EA7n x\u1EED l\u00FD:
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">M\u00E3 \u0111\u01A1n:</td>
              <td style="padding:4px 8px;">${orderCode}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Kh\u00E1ch h\u00E0ng:</td>
              <td style="padding:4px 8px;">${custName}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">T\u1ED5ng ti\u1EC1n:</td>
              <td style="padding:4px 8px;font-weight:700;color:${brandColor};">${totalAmt}</td>
            </tr>
          </table>
        </div>
        <div style="margin:24px 0;text-align:center;">
          <a href="#/sales/orders"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Xem \u0111\u01A1n h\u00E0ng
          </a>
        </div>`
      return { subject, html: wrapper(subject, body) }
    }

    case 'admin_payment_received': {
      const amt = data.amount || '0 \u0111'
      const partner = data.partner_name || 'Kh\u00F4ng r\u00F5'
      const ref = data.reference || 'N/A'
      const desc = data.description || ''
      const subject = `[${brandName}] Thanh to\u00E1n m\u1EDBi: ${amt}`
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Thanh to\u00E1n m\u1EDBi</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          H\u1EC7 th\u1ED1ng v\u1EEBa ghi nh\u1EADn m\u1ED9t kho\u1EA3n thanh to\u00E1n:
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">S\u1ED1 ti\u1EC1n:</td>
              <td style="padding:4px 8px;font-weight:700;color:${brandColor};">${amt}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">\u0110\u1ED1i t\u00E1c:</td>
              <td style="padding:4px 8px;">${partner}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Tham chi\u1EBFu:</td>
              <td style="padding:4px 8px;">${ref}</td>
            </tr>
            ${desc ? `<tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">M\u00F4 t\u1EA3:</td>
              <td style="padding:4px 8px;">${desc}</td>
            </tr>` : ''}
          </table>
        </div>
        <div style="margin:24px 0;text-align:center;">
          <a href="#/finance"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Xem t\u00E0i ch\u00EDnh
          </a>
        </div>`
      return { subject, html: wrapper(subject, body) }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth: accept service_role key or authenticated admin JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // If not service_role key, verify as JWT
    if (token !== serviceRoleKey) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        serviceRoleKey,
      )
      const { error: authError } = await supabase.auth.getUser(token)
      if (authError) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // Parse & validate input
    const { type, email, data } = (await req.json()) as EmailPayload

    if (!type || !email) {
      return new Response(
        JSON.stringify({ error: 'type and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const validTypes: EmailType[] = [
      'registration_received', 'registration_approved', 'registration_rejected',
      'admin_new_registration', 'admin_new_order', 'admin_payment_received',
    ]
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build email content
    const { subject, html } = buildHtmlEmail(type, data || {})

    // SMTP config
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465', 10)
    const smtpUser = Deno.env.get('SMTP_USER')
    const smtpPass = Deno.env.get('SMTP_PASS')
    const smtpFrom = Deno.env.get('SMTP_FROM')

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      return new Response(
        JSON.stringify({ error: 'SMTP configuration is incomplete' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Send email via SMTP
    const client = new SmtpClient()

    await client.connectTLS({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPass,
    })

    await client.send({
      from: smtpFrom,
      to: email,
      subject,
      content: '',
      html,
    })

    await client.close()

    return new Response(
      JSON.stringify({ success: true, message: `Email "${type}" sent to ${email}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('send-portal-email error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
