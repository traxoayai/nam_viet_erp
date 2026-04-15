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
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Parse & validate input
    const { email, display_name } = await req.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Check if auth user already exists for this email
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users?.find((u) => u.email === email)

    if (existing) {
      // Check if this user already has a portal_users record
      const { data: portalUser } = await supabase
        .from('portal_users')
        .select('id')
        .eq('auth_user_id', existing.id)
        .maybeSingle()

      if (portalUser) {
        // Already has portal_users record -> 422 error
        return new Response(
          JSON.stringify({
            error: 'Portal user already exists',
            message: 'Email này đã có tài khoản Portal.',
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // Exists in auth but no portal_users -> return existing id
      return new Response(
        JSON.stringify({
          auth_user_id: existing.id,
          created: false,
          message: 'Auth user đã tồn tại, chưa có portal_users.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const portalUrl = Deno.env.get('PORTAL_SITE_URL') ?? 'https://nam-viet-b2b.vercel.app'
    const redirectTo = `${portalUrl.replace(/\/$/, '')}/auth/callback`

    // User does not exist -> create via inviteUserByEmail (sends invite email automatically)
    const { data: newUser, error: createError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: { display_name: display_name || email },
        redirectTo,
      },
    )

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({
        auth_user_id: newUser.user.id,
        created: true,
        message: 'Tạo user thành công, email mời đã được gửi.',
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('create-portal-user error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
