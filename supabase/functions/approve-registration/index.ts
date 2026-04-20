import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { request_id } = await req.json()

    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: regRequest, error: regError } = await supabase
      .from('registration_requests')
      .select('auth_user_id, email, business_name')
      .eq('id', request_id)
      .single()

    if (regError || !regRequest) {
      return new Response(JSON.stringify({ error: 'Registration request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // New flow: auth_user_id đã tồn tại (được tạo khi đăng ký ở Portal)
    if (regRequest.auth_user_id) {
      return new Response(JSON.stringify({
        auth_user_id: regRequest.auth_user_id,
        created: false,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Legacy flow: auth_user_id null → tạo auth user qua invite
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users?.find((u) => u.email === regRequest.email)

    if (existing) {
      return new Response(JSON.stringify({
        auth_user_id: existing.id,
        created: false,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const defaultPortalUrl = Deno.env.get('PORTAL_SITE_URL') ?? 'https://nam-viet-b2b.vercel.app'
    const redirectTo = `${defaultPortalUrl.replace(/\/$/, '')}/auth/callback`

    const { data: newUser, error: createError } = await supabase.auth.admin.inviteUserByEmail(
      regRequest.email,
      {
        data: { display_name: regRequest.business_name || regRequest.email },
        redirectTo,
      },
    )

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      auth_user_id: newUser.user.id,
      created: true,
    }), {
      status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('approve-registration error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
