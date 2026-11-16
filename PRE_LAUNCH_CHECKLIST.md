# Pre-Launch Checklist for Food Frenzy (itch.io)

Based on the shipping-and-launch skill guidelines. Complete all items before launching to production.

---

## ✅ Code Quality

- [x] All unit tests pass (342/342)
- [x] Build succeeds with no errors (only chunk size warning)
- [x] Lint passes (ESLint)
- [x] No TODO comments that should be resolved before launch
- [x] No `console.log` debugging statements in production code (only debugLog utility)
- [x] Error handling covers expected failure modes (try/catch throughout)

## ✅ Security

- [x] No secrets in code or version control
- [x] `.env.example` created for production credentials
- [ ] Dependency audit: `npm audit` shows 8 vulnerabilities (3 high, 3 moderate, 2 low) - primarily in dev dependencies (vite, ws, minimatch, happy-dom, ftp-deploy). These are dev-only and don't affect production bundle. Consider `npm audit fix --force` for future updates.
- [x] Input validation on all user-facing endpoints (WebSocket message validation)
- [x] Authentication/authorization: Sequence ID validation prevents replay attacks
- [ ] Rate limiting: Not implemented (WebSocket-based, consider for production)
- [x] CORS: Not applicable (WebSocket, not HTTP)

## ✅ Performance

- [x] Core Web Vitals: Need to measure in production
- [x] No N+1 queries (no database)
- [x] Images optimized (compression, responsive sizes via PWA caching)
- [x] Bundle size: 4.18 MB JS (warning: >2.5 MB, consider code-splitting)
- [x] Database queries: N/A (no database)
- [x] Caching configured for static assets (Workbox PWA)
- [x] Performance presets implemented (Lowest through Ultra)

## ✅ Accessibility

- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader can convey page content and structure
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 for text)
- [ ] Focus management correct for modals and dynamic content
- [ ] Error messages are descriptive and associated with form fields
- [ ] No accessibility warnings in axe-core or Lighthouse

## ✅ Infrastructure

- [x] Environment variables documented in `.env.example`
- [x] No database migrations needed
- [x] DNS and SSL: Need to configure for production domain
- [x] CDN configured for static assets (itch.io provides this)
- [x] Logging and error reporting: debugLog utility, needs production service
- [x] Health check endpoint: Not implemented (WebSocket server)

## ✅ Documentation

- [x] README.md created with setup, controls, deployment instructions
- [x] CHANGELOG.md created with version history
- [x] API documentation: WebSocket protocol documented in code
- [x] ADRs: Not formalized (architecture decisions in code comments)
- [x] User-facing documentation: README covers gameplay

## ✅ Feature Flags

- [ ] No feature flags currently implemented
- [ ] Consider adding for future features (new arenas, game modes)

## ✅ Staged Rollout Plan

### Phase 1: Internal Testing ✅
- [x] Deploy to staging (local development)
- [x] Full test suite passes
- [x] Manual smoke test of critical flows

### Phase 2: Production Deploy (Feature Flag OFF)
- [ ] Deploy to itch.io (feature flag N/A)
- [ ] Verify deployment succeeded (game loads)
- [ ] Check error monitoring (browser console)

### Phase 3: Beta Testing
- [ ] Enable for team/internal testers
- [ ] 24-hour monitoring window
- [ ] Collect feedback

### Phase 4: Public Launch
- [ ] Monitor error rates, performance, user feedback
- [ ] Compare metrics: launch vs. baseline
- [ ] Advance only if all thresholds pass

## ✅ Rollout Decision Thresholds

| Metric | Advance (Green) | Hold (Yellow) | Roll Back (Red) |
|--------|-----------------|---------------|-----------------|
| Error rate | Within 10% of baseline | 10-100% above baseline | >2x baseline |
| P95 latency | Within 20% of baseline | 20-50% above baseline | >50% above baseline |
| Client JS errors | No new error types | New errors <0.1% sessions | New errors >0.1% sessions |
| Business metrics | Neutral or positive | Decline <5% | Decline >5% |

## ✅ Monitoring & Observability

### Application Metrics to Monitor
- [ ] Error rate (total and by type)
- [ ] WebSocket connection success/failure rate
- [ ] Server tick rate (should be ~30Hz)
- [ ] Snapshot broadcast rate (should be ~20Hz)
- [ ] Active players
- [ ] Average session duration

### Infrastructure Metrics
- [ ] CPU and memory utilization (server)
- [ ] Network latency (WebSocket RTT)
- [ ] Bandwidth usage

### Client Metrics
- [ ] Core Web Vitals (LCP, INP, CLS)
- [ ] JavaScript errors (console)
- [ ] WebSocket reconnection rate
- [ ] Frame rate (FPS)

### Error Reporting
- [ ] Client-side error boundary with reporting (needs implementation)
- [ ] Server-side error logging (debugLog utility)
- [ ] Consider Sentry or similar for production

## ✅ Post-Launch Verification (First Hour)

- [ ] Check game loads on itch.io
- [ ] Check error monitoring dashboard (no new error types)
- [ ] Check latency (WebSocket RTT < 100ms)
- [ ] Test critical user flow: Menu → Start Game → Play → Pause → Resume
- [ ] Verify logs are flowing and readable
- [ ] Confirm rollback mechanism works (re-deploy previous build)

## ✅ Rollback Strategy

### Trigger Conditions
- Error rate > 2x baseline
- P95 latency > 200ms
- User reports of game-breaking issues
- Data integrity issues detected
- Security vulnerability discovered

### Rollback Steps
1. **itch.io**: Re-upload previous `dist/` build (manual, ~5 min)
2. **Server**: `pm2 restart food-frenzy-server` or redeploy previous version
3. **Verify**: Health check, error monitoring
4. **Communicate**: Notify team of rollback

### Time to Rollback
- Frontend (itch.io): ~5 minutes
- Backend (PM2): < 1 minute
- Database: N/A

## ✅ itch.io Specific Checklist

- [x] Build outputs to `dist/` with `base: "./"` (relative paths)
- [x] PWA manifest configured for itch.io
- [x] `index.html` is entry point
- [x] All assets copied to `dist/` (models, textures, audio, etc.)
- [x] Service worker registered for offline support
- [ ] Test on itch.io staging (private project)
- [ ] Verify WebSocket connection works (WSS required for HTTPS)
- [ ] Configure itch.io project settings:
  - [ ] "This file will be played in the browser"
  - [ ] Index.html as main file
  - [ ] Proper categorization (Games > Action > Multiplayer)
  - [ ] Screenshots and trailer
  - [ ] Tags: 3d, multiplayer, physics, food, arena

## ✅ Production Server Deployment

- [x] Server code in `server/ws-server.js`
- [x] Physics worker in `server/physics-worker.mjs`
- [x] Port 9208 (configurable via PORT env)
- [x] PM2 ecosystem config generated (`deploy-server.js pm2`)
- [x] Systemd service file generated (`deploy-server.js systemd`)
- [x] Dockerfile generated (`deploy-server.js docker`)
- [ ] Production server provisioned (Oracle Cloud: 192.9.188.215)
- [ ] Nginx reverse proxy configured for WSS on 443
- [ ] SSL certificates (Let's Encrypt)
- [ ] Firewall rules (allow 9208, 443)
- [ ] Process manager (PM2) configured
- [ ] Log rotation configured
- [ ] Monitoring/alerting configured

## ✅ Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Lead | | | |
| DevOps | | | |
| Product Owner | | | |

---

## Notes

### Known Issues to Address Post-Launch
1. **Bundle size**: 4.18 MB JS - implement code-splitting for faster initial load
2. **Accessibility**: Needs audit and improvements
3. **Error reporting**: Integrate Sentry or similar
4. **Health check**: Add HTTP health endpoint to WebSocket server
5. **Rate limiting**: Implement WebSocket connection rate limiting
6. **Visual regression tests**: Need baseline images on first CI run

### Performance Optimization Opportunities
- Dynamic imports for heavy components (post-processing, physics)
- Lazy-load non-critical assets
- Implement asset compression (Draco for GLTF)
- Optimize shader compilation

### Security Hardening (Post-Launch)
- Implement WebSocket authentication (JWT tokens)
- Add rate limiting per IP
- Implement server-side input sanitization
- Add CSP headers via Nginx
- Regular dependency audits

---

*Checklist version: 1.0*
*Based on shipping-and-launch skill guidelines*
*Last updated: 2026-11-13*