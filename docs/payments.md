# Payments and founding-pilot launch checklist

ReplayMint uses Lemon Squeezy hosted checkout as the first global-payment integration to evaluate. Do not enable live checkout until an adult account holder has completed provider approval, the pilot offer and refund terms are clear, and the webhook/fulfillment process has been tested.

## Preview-only configuration

Set these in Vercel **Preview** for `feature/rename-replaymint` only:

- `LEMONSQUEEZY_API_KEY`: private API key for the intended Lemon Squeezy store/mode.
- `LEMONSQUEEZY_STORE_ID`: store ID.
- `LEMONSQUEEZY_VARIANT_ID`: the fixed-price, one-time founding-pilot variant ID.
- `NEXT_PUBLIC_SITE_URL`: the exact HTTPS preview URL used for checkout redirects.
- `LEMONSQUEEZY_CHECKOUT_ENABLED`: keep `false` or unset until all checks below pass.

Never put API keys in source control or client-side variables. Do not use a custom-price checkout for the founding pilot: the price must be explicit in the provider dashboard and visible before payment.

## Before enabling checkout

1. Confirm the account/store is approved for the account holder and eligible for payouts.
2. Publish an exact pilot scope, price, delivery window, cancellation/refund terms, and support contact.
3. Test checkout in the provider's test mode and confirm the displayed product, currency, tax, total, and return URL.
4. Configure a webhook using a strong signing secret and verify its `X-Signature` with HMAC-SHA256 against the raw request body.
5. Persist verified order events and make processing idempotent before using a payment event to grant access or start paid work.
6. Complete an end-to-end test purchase and refund, then confirm the order can be matched to a customer and the team can deliver the agreed pilot.
7. Only then set `LEMONSQUEEZY_CHECKOUT_ENABLED=true` in the intended Preview environment. Do not enable Production without explicit approval.

## Current limitations

- The checkout route creates a hosted checkout only when explicitly enabled and all required configuration is present.
- A successful redirect is not proof of payment; only a verified provider event can confirm payment.
- Automatic fulfillment is not implemented here. Until durable webhook event storage and a reliable delivery workflow are in place, keep checkout disabled and run a manually agreed pilot.
- Never ask a customer to share real production credentials. Use a dedicated demo account and test data.
