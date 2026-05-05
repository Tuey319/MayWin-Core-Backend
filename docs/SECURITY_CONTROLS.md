# Security Controls — R-19 Interim Mitigation
## Gemini API Usage — PDPA §26/§28

### Current Status
Risk R-19 (Gemini DPA) has been reduced from CRITICAL (score 20) to LOW 
(score 3) through the following implemented controls:

### Controls Implemented

1. **Production environment guard**
   - Gemini is blocked from being called in NODE_ENV=production
   - A structured rule-based fallback parser handles production NLU requests
   - No personal data from nurses reaches Google servers in the production environment
   - Implemented in: src/core/webhook/nlu.service.ts

2. **API key rotation post-INC-2026-001**
   - All four Gemini API keys were rotated following the credential exposure incident
   - Keys now stored in AWS Secrets Manager, not in .env files
   - TruffleHog pre-commit hook prevents future credential commits

3. **Feature flag documentation**
   - Full AI-powered NLU (Gemini) is only active in development and staging environments
   - Production deployment uses the structured fallback parser
   - Full Gemini NLU can be re-enabled in production once a Data Processing Agreement 
     with Google is signed under PDPA §26/§28

### Residual Risk
- Score: Likelihood 1 × Impact 3 = 3 (LOW)
- Gemini cannot be called in production by design
- No personal data transfer to Google occurs in the live hospital environment
- DPA remains a formal pre-production requirement if full AI NLU is ever enabled

### Owner
CTO / Legal — target date for DPA review: before full production go-live
