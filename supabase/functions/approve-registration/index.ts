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
    // Verify caller is authenticated ERP admin
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

    // Verify JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { request_id, email, business_name, portal_url } = await req.json()

    if (!request_id) {
      return new Response(JSON.stringify({ error: 'request_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Read registration_requests to check auth_user_id
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

    // Use request data as fallback for email/business_name
    const resolvedEmail = email || regRequest.email
    const resolvedBusinessName = business_name || regRequest.business_name

    if (!resolvedEmail) {
      return new Response(JSON.stringify({ error: 'Email is required (not found in request or input)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // New flow: auth_user_id already exists on the registration request
    if (regRequest.auth_user_id) {
      // Send approval email via send-portal-email
      const emailRes = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-portal-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            type: 'registration_approved',
            email: resolvedEmail,
            data: {
              business_name: resolvedBusinessName,
              portal_url: portal_url || undefined,
            },
          }),
        },
      )

      if (!emailRes.ok) {
        const emailErr = await emailRes.json().catch(() => ({ error: 'Unknown email error' }))
        console.error('send-portal-email failed:', emailErr)
        // Non-blocking: log but don't fail the approval
      }

      return new Response(JSON.stringify({
        auth_user_id: regRequest.auth_user_id,
        created: false,
        message: 'Auth user already exists, approval email sent.',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Legacy flow: auth_user_id is null -> create via inviteUserByEmail
    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users?.find((u) => u.email === resolvedEmail)

    if (existing) {
      return new Response(JSON.stringify({
        auth_user_id: existing.id,
        created: false,
        message: 'Auth user already exists (legacy flow)',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const defaultPortalUrl = Deno.env.get('PORTAL_SITE_URL') ?? 'https://nam-viet-b2b.vercel.app'
    const redirectTo = `${defaultPortalUrl.replace(/\/$/, '')}/auth/callback`

    // Create auth user with invite (sends email automatically)
    const { data: newUser, error: createError } = await supabase.auth.admin.inviteUserByEmail(
      resolvedEmail,
      {
        data: { display_name: resolvedBusinessName || resolvedEmail },
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
      message: 'User created, invite email sent (legacy flow)',
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
