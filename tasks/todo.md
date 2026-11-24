# Under-construction one-pager

- [x] Vendor three.js 0.170.0 and fonts (self-hosted)
- [x] `js/gears.js`: involute profiles, with a Node mesh check
- [x] `index.html`, `styles.css`, `js/main.js`
- [x] Layout checks: 1440x860, 1290x760, 1024x768, 812x375, 375x812, 320x640
- [x] Pointer, keyboard, reduced motion, no JS, no WebGL
- [x] Favicon, share image

## Review

- `node tests/gears.test.js`: no tooth overlap at 595 positions over a full carrier turn; a control case out of phase does collide.
- Holding assembles and settles at 60 rpm in / 17.1 rpm out (3.5:1); releasing takes it apart. No console errors; all requests same-origin.
- Reduced motion switches instantly, with no spin. Without JS or WebGL the name, message and parts list remain.
- Pointer and key holds were tested with synthetic events in Chromium. Not tested: a physical phone, Safari, Firefox.
- Deploy: `npx wrangler deploy` publishes `public/` to Cloudflare Workers (see `wrangler.jsonc`).
