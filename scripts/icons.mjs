// Generates all PWA icons from an inline SVG. Run: node scripts/icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
const svg = (pad) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0a0a0b"/>
<g transform="translate(256 256) scale(${pad ? 0.72 : 0.9}) translate(-256 -256)">
<circle cx="256" cy="256" r="150" fill="none" stroke="#f5b83d" stroke-width="28"/>
<circle cx="256" cy="256" r="72" fill="#f5b83d"/>
<path d="M256 60v60M256 392v60M60 256h60M392 256h60" stroke="#fff" stroke-width="22" stroke-linecap="round"/>
</g></svg>`)
mkdirSync('public/icons', { recursive: true })
const out = [['public/icons/icon-192.png',192,false],['public/icons/icon-512.png',512,false],['public/icons/icon-maskable-512.png',512,true],['public/icons/apple-touch-icon.png',180,true],['public/favicon.png',64,false]]
for (const [f, s, p] of out) await sharp(svg(p)).resize(s, s).png().toFile(f)
console.log('icons ok')
