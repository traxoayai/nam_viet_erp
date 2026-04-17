#!/usr/bin/env node
/**
 * Lay Gmail Refresh Token voi scope gmail.readonly.
 *
 * Cach chay:
 *   node scripts/get-gmail-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>
 *
 * Hoac (tu dong doc tu .env.newaccount):
 *   node scripts/get-gmail-refresh-token.js
 *
 * Yeu cau:
 *   - OAuth Client phai add redirect URI: http://localhost:8765/oauth2callback
 *   - Gmail account phai duoc add vao Test users (neu consent screen = Testing)
 */

import http from 'node:http'
import { URL } from 'node:url'
import { exec } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_FILE = resolve(__dirname, '..', '.env.newaccount')

const REDIRECT_URI = 'http://localhost:8765/oauth2callback'
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const PORT = 8765

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const content = readFileSync(path, 'utf8')
  const env = {}
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

function parseArgs() {
  let [clientId, clientSecret] = process.argv.slice(2)
  if (!clientId || !clientSecret) {
    const env = loadEnvFile(ENV_FILE)
    clientId = clientId || env.GMAIL_CLIENT_ID
    clientSecret = clientSecret || env.GMAIL_CLIENT_SECRET
  }
  if (!clientId || !clientSecret) {
    console.error('❌ Thieu CLIENT_ID hoac CLIENT_SECRET.')
    console.error('Usage: node scripts/get-gmail-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>')
    console.error(`Hoac tao file ${ENV_FILE} voi GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET`)
    process.exit(1)
  }
  return { clientId, clientSecret }
}

function openBrowser(url) {
  const platform = process.platform
  const cmd = platform === 'win32' ? `start "" "${url}"`
            : platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`
  exec(cmd, (err) => {
    if (err) console.log('\n(Khong mo browser tu dong duoc. Copy URL ben tren va mo thu cong.)')
  })
}

async function exchangeCodeForTokens(code, clientId, clientSecret) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`OAuth exchange failed: ${JSON.stringify(json)}`)
  return json
}

function main() {
  const { clientId, clientSecret } = parseArgs()

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPE)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  const urlStr = authUrl.toString()
  console.log('\n🔑 Mo URL sau de authorize (tu dong mo browser):\n')
  console.log(urlStr)
  console.log('')
  openBrowser(urlStr)

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://localhost:${PORT}`)
    if (reqUrl.pathname !== '/oauth2callback') {
      res.writeHead(404).end('Not Found')
      return
    }
    const code = reqUrl.searchParams.get('code')
    const error = reqUrl.searchParams.get('error')

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`OAuth error: ${error}`)
      console.error(`\n❌ OAuth error: ${error}`)
      server.close()
      process.exit(1)
    }

    if (!code) {
      res.writeHead(400).end('Missing code')
      return
    }

    try {
      const tokens = await exchangeCodeForTokens(code, clientId, clientSecret)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <html><body style="font-family: sans-serif; padding: 40px;">
          <h2>✅ Lay token thanh cong</h2>
          <p>Quay lai terminal de xem refresh_token.</p>
        </body></html>
      `)

      console.log('\n═══════════════════════════════════════════════════════')
      console.log('✅ REFRESH TOKEN (copy gia tri duoi day):')
      console.log('═══════════════════════════════════════════════════════\n')
      console.log(tokens.refresh_token)
      console.log('\n═══════════════════════════════════════════════════════')
      if (!tokens.refresh_token) {
        console.warn('\n⚠️  KHONG co refresh_token. Co the do Google da cap truoc do.')
        console.warn('   Vao https://myaccount.google.com/permissions, remove app nay,')
        console.warn('   roi chay lai script.')
      }
      console.log(`\nℹ️  access_token (expires in ${tokens.expires_in}s):`)
      console.log(tokens.access_token)
      console.log('')

      server.close()
      process.exit(0)
    } catch (err) {
      res.writeHead(500).end(String(err.message))
      console.error('\n❌ Exchange failed:', err.message)
      server.close()
      process.exit(1)
    }
  })

  server.listen(PORT, () => {
    console.log(`⏳ Dang cho OAuth callback tai http://localhost:${PORT}/oauth2callback...`)
  })
}

main()
