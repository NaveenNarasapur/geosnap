import type { OverlaySettings, TemplateId } from './types'

export interface OverlayInfo {
  title?: string
  subtitle?: string
  latitude?: number
  longitude?: number
  altitude?: number | null
  accuracy?: number
  date: Date
}

export const TEMPLATES: { id: TemplateId; name: string; hint: string }[] = [
  { id: 'minimal', name: 'Minimal GPS', hint: 'Clean text, no box' },
  { id: 'travel', name: 'Travel Stamp', hint: 'Bordered passport-style stamp' },
  { id: 'maps', name: 'Maps Card', hint: 'White card with pin' },
  { id: 'timestamp', name: 'Camera Timestamp', hint: 'Classic digital date stamp' },
  { id: 'cinematic', name: 'Cinematic', hint: 'Full-width title band' },
]

const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
const SERIF = 'Georgia, "Times New Roman", serif'

const ns = (v: number) => (v >= 0 ? 'N' : 'S')
const ew = (v: number) => (v >= 0 ? 'E' : 'W')

function lines(info: OverlayInfo, s: OverlaySettings) {
  const f = s.fields
  const title = f.place ? (s.customTitle.trim() || info.title || '') : ''
  const coords = f.coords && info.latitude != null && info.longitude != null
    ? `${Math.abs(info.latitude).toFixed(5)}° ${ns(info.latitude)}  ${Math.abs(info.longitude).toFixed(5)}° ${ew(info.longitude)}` : ''
  const date = f.date ? info.date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
  const time = f.time ? info.date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''
  const extra = [
    f.altitude && info.altitude != null ? `Alt ${Math.round(info.altitude)} m` : '',
    f.accuracy && info.accuracy != null ? `±${Math.round(info.accuracy)} m` : '',
  ].filter(Boolean).join('  ·  ')
  const when = [date, time].filter(Boolean).join('  ·  ')
  return { title, subtitle: f.place && !s.customTitle.trim() ? info.subtitle ?? '' : '', coords, when, extra }
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

function anchor(pos: OverlaySettings['position'], W: number, H: number, bw: number, bh: number, m: number) {
  const x = pos.endsWith('left') ? m : pos.endsWith('right') ? W - bw - m : (W - bw) / 2
  const y = pos.startsWith('top') ? m : H - bh - m
  return { x, y }
}

type Row = { text: string; font: string; color: string; size: number }

function drawBox(ctx: CanvasRenderingContext2D, W: number, H: number, rows: Row[], s: OverlaySettings, u: number, style: {
  bg: string; radius: number; pad: number; border?: string; borderW?: number; shadow?: boolean; accentBar?: string; pin?: boolean; dashed?: boolean
}) {
  const maxW = W * 0.86
  const pinW = style.pin ? u * 7 : 0
  let tw = 0
  rows.forEach((r) => { ctx.font = r.font; tw = Math.max(tw, Math.min(ctx.measureText(r.text).width, maxW - style.pad * 2 - pinW)) })
  const gap = u * 0.9
  const th = rows.reduce((a, r) => a + r.size, 0) + gap * (rows.length - 1)
  const bw = tw + style.pad * 2 + pinW + (style.accentBar ? u * 1.2 : 0)
  const bh = th + style.pad * 2
  const { x, y } = anchor(s.position, W, H, bw, bh, u * 4)
  ctx.save()
  if (style.shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = u * 3; ctx.shadowOffsetY = u * 0.8 }
  rrect(ctx, x, y, bw, bh, style.radius)
  ctx.fillStyle = style.bg
  ctx.fill()
  ctx.restore()
  if (style.border) {
    ctx.save()
    ctx.lineWidth = style.borderW ?? u * 0.4
    ctx.strokeStyle = style.border
    if (style.dashed) ctx.setLineDash([u * 1.4, u * 0.8])
    rrect(ctx, x + u * 0.8, y + u * 0.8, bw - u * 1.6, bh - u * 1.6, Math.max(0, style.radius - u * 0.6))
    ctx.stroke()
    ctx.restore()
  }
  let cx = x + style.pad
  if (style.accentBar) { ctx.fillStyle = style.accentBar; rrect(ctx, x + style.pad * 0.55, y + style.pad, u * 0.6, th, u * 0.3); ctx.fill(); cx += u * 1.2 }
  if (style.pin) {
    const px = cx + pinW * 0.38, py = y + bh / 2 - u * 0.6, r = u * 2.2
    ctx.fillStyle = '#ea4335'
    ctx.beginPath(); ctx.arc(px, py - r * 0.3, r, Math.PI, 0); ctx.lineTo(px, py + r * 1.8); ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py - r * 0.3, r * 0.42, 0, Math.PI * 2); ctx.fill()
    cx += pinW
  }
  let cy = y + style.pad
  ctx.textBaseline = 'top'
  for (const r of rows) {
    ctx.font = r.font; ctx.fillStyle = r.color
    ctx.fillText(truncate(ctx, r.text, tw), cx, cy)
    cy += r.size + gap
  }
}

/** Draws the chosen overlay template onto a canvas sized W x H. Shared by live preview and export. */
export function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, info: OverlayInfo, s: OverlaySettings) {
  if (!s.visible) return
  const u = (Math.min(W, H) / 100) * s.scale
  const L = lines(info, s)
  const R = (text: string, size: number, weight: number, color: string, family = SANS, extra = ''): Row =>
    ({ text, size, color, font: `${extra}${weight} ${size}px ${family}` })

  switch (s.template) {
    case 'minimal': {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = u * 1.2; ctx.shadowOffsetY = u * 0.2
      const rows = [L.title && R(L.title, u * 3.6, 600, '#fff'), L.coords && R(L.coords, u * 2.6, 500, 'rgba(255,255,255,.92)', MONO), L.when && R(L.when, u * 2.4, 400, 'rgba(255,255,255,.85)'), L.extra && R(L.extra, u * 2.2, 400, 'rgba(255,255,255,.75)')].filter(Boolean) as Row[]
      if (rows.length) drawBox(ctx, W, H, rows, s, u, { bg: 'rgba(0,0,0,0)', radius: 0, pad: 0 })
      ctx.restore()
      break
    }
    case 'travel': {
      const rows = [L.title && R(L.title.toUpperCase(), u * 3.8, 800, '#f5b83d', SANS), L.subtitle && R(L.subtitle, u * 2.3, 400, 'rgba(255,255,255,.8)'), L.coords && R(L.coords, u * 2.5, 600, '#fff', MONO), L.when && R(L.when.toUpperCase(), u * 2.3, 600, 'rgba(255,255,255,.9)'), L.extra && R(L.extra, u * 2.1, 500, 'rgba(255,255,255,.7)')].filter(Boolean) as Row[]
      if (rows.length) drawBox(ctx, W, H, rows, s, u, { bg: 'rgba(12,12,14,.72)', radius: u * 2, pad: u * 3.4, border: 'rgba(245,184,61,.9)', borderW: u * 0.35, dashed: true, shadow: true })
      break
    }
    case 'maps': {
      const rows = [L.title && R(L.title, u * 3.4, 700, '#202124'), L.subtitle && R(L.subtitle, u * 2.2, 400, '#5f6368'), L.coords && R(L.coords, u * 2.3, 500, '#1a73e8', MONO), [L.when, L.extra].filter(Boolean).join('  ·  ') && R([L.when, L.extra].filter(Boolean).join('  ·  '), u * 2.1, 400, '#5f6368')].filter(Boolean) as Row[]
      if (rows.length) drawBox(ctx, W, H, rows, s, u, { bg: 'rgba(255,255,255,.96)', radius: u * 2.4, pad: u * 2.8, shadow: true, pin: true })
      break
    }
    case 'timestamp': {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = u * 0.8
      const d = info.date, p = (n: number) => String(n).padStart(2, '0')
      const stamp = [s.fields.date ? `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}` : '', s.fields.time ? `${p(d.getHours())}:${p(d.getMinutes())}` : ''].filter(Boolean).join('  ')
      const rows = [stamp && R(stamp, u * 4.2, 700, '#ff9f1a', MONO), L.coords && R(L.coords, u * 2.4, 600, '#ff9f1a', MONO), L.title && R(L.title, u * 2.4, 600, '#ffd28a', MONO), L.extra && R(L.extra, u * 2.1, 500, '#ffd28a', MONO)].filter(Boolean) as Row[]
      if (rows.length) drawBox(ctx, W, H, rows, s, u, { bg: 'rgba(0,0,0,0)', radius: 0, pad: 0 })
      ctx.restore()
      break
    }
    case 'cinematic': {
      const top = s.position.startsWith('top')
      const bh = u * 22
      const y0 = top ? 0 : H - bh
      const g = ctx.createLinearGradient(0, top ? 0 : H, 0, top ? bh : H - bh)
      g.addColorStop(0, 'rgba(0,0,0,.82)'); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, y0, W, bh)
      ctx.textBaseline = 'alphabetic'
      const align: CanvasTextAlign = s.position.endsWith('left') ? 'left' : s.position.endsWith('right') ? 'right' : 'center'
      const x = align === 'left' ? u * 5 : align === 'right' ? W - u * 5 : W / 2
      ctx.textAlign = align
      const titleY = top ? u * 9 : H - u * 9
      if (L.title) {
        ctx.font = `italic 400 ${u * 5.2}px ${SERIF}`; ctx.fillStyle = '#fff'
        ctx.fillText(truncate(ctx, L.title, W * 0.9), x, titleY)
      }
      const det = [L.coords, L.when, L.extra].filter(Boolean).join('   |   ').toUpperCase()
      if (det) {
        ctx.font = `500 ${u * 2}px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,.82)'
        if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${u * 0.3}px`
        ctx.fillText(truncate(ctx, det, W * 0.9), x, titleY + (L.title ? u * 4.6 : 0))
        if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px'
      }
      ctx.textAlign = 'left'
      break
    }
  }
}
