import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || ''

interface NotifyPayload {
  type: 'order_status' | 'debt_reminder' | 'invoice' | 'promotion' | 'system' | 'broadcast'
  customer_b2b_id: number | null
  title: string
  body: string
  data?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let payload: NotifyPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const validTypes = ['order_status', 'debt_reminder', 'invoice', 'promotion', 'system', 'broadcast']
  if (!payload.type || !validTypes.includes(payload.type)) {
    return new Response(JSON.stringify({ error: 'Invalid type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!payload.title || !payload.body) {
    return new Response(JSON.stringify({ error: 'title and body required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Insert notification
  const { data: notification, error: insertErr } = await supabase
    .from('b2b_notifications')
    .insert({
      customer_b2b_id: payload.customer_b2b_id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    })
    .select('id')
    .single()

  if (insertErr) {
    return new Response(JSON.stringify({ error: 'Failed to create notification', details: insertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Get push subscriptions (nếu VAPID keys configured)
  let pushSent = 0

  if (vapidPublicKey && vapidPrivateKey) {
    let portalUserIds: string[] = []

    if (payload.customer_b2b_id !== null) {
      const { data: portalUsers } = await supabase
        .from('portal_users')
        .select('id')
        .eq('customer_b2b_id', payload.customer_b2b_id)

      if (portalUsers && portalUsers.length > 0) {
        portalUserIds = portalUsers.map((u) => u.id)
      }
    }

    let query = supabase
      .from('b2b_push_subscriptions')
      .select('endpoint, p256dh, auth')

    if (portalUserIds.length > 0) {
      query = query.in('portal_user_id', portalUserIds)
    }

    const { data: subscriptions } = await query

    if (subscriptions && subscriptions.length > 0) {
      // Note: web-push library khong tuong thich tot voi Deno Edge Functions.
      // Notification da duoc insert vao DB va se duoc deliver qua
      // Supabase Realtime WebSocket toi connected clients.
      // Web Push co the them sau qua Node.js worker rieng.
      pushSent = 0
    }
  }

  return new Response(JSON.stringify({
    success: true,
    notification_id: notification.id,
    push_sent: pushSent,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
