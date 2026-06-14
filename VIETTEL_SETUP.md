# Viettel Post Shipping Integration Setup

## Configuration

### Environment Variables

Add these to your `.env.local` file for Viettel Post API integration:

```env
# Viettel Post API Configuration
VITE_VIETTEL_API_URL="https://api.viettelpost.vn"  # Staging URL
VITE_VIETTEL_API_KEY="your_api_key_here"           # From Viettel account

# For production, use prod endpoint:
# VITE_VIETTEL_API_URL="https://api-prod.viettelpost.vn"
```

### Supabase Configuration

Add to `supabase/.env.local` for RPC testing:

```env
VIETTEL_API_URL="https://api.viettelpost.vn"
VIETTEL_API_KEY="your_api_key_here"
```

## Getting Viettel API Credentials

1. **Create account** on Viettel Post Developer Portal
2. **Generate API Key** from account settings
3. **Note**: API is currently mocked in RPC functions; real integration pending

## Development Setup

### 1. Database Migrations

Migrations are pre-created and will run on `supabase db push`:

```bash
# File: supabase/migrations/20260614000001_viettel_shipping_cache.sql
# - Creates shipping_rate_cache table
# - Indexes for fast lookups
# - RLS policies

# File: supabase/migrations/20260614000002_viettel_shipping_rate_rpc.sql
# - calculate_shipping_rate() RPC
# - get_cached_shipping_rate() RPC
# - save_shipping_rate_cache() RPC
# - cleanup_expired_shipping_cache() RPC
```

### 2. Test Environment

```bash
# Run unit tests (mocked API)
npm run test:unit

# Run RPC integration tests (requires local Supabase)
npm run test:rpc

# Run all tests
npm run test:all
```

### 3. Usage Examples

#### React Component

```tsx
import { useShippingRate } from '@/features/shipping/hooks/useShippingRate';
import { ShippingRateRequest } from '@/features/shipping/types';

export function ShippingCalculator() {
  const request: ShippingRateRequest = {
    sendProvince: '100',      // Hanoi
    receiveProvince: '300',   // HCMC
    weight: 1000,             // 1kg
    width: 15,
    height: 15,
    length: 15,
    serviceId: 'VTP',         // Standard
  };

  const { data, isLoading, error } = useShippingRate(request);

  if (isLoading) return <div>Calculating...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Shipping Fee: {data?.shippingFee}₫</p>
      <p>Estimated: {data?.estimatedDays} days</p>
    </div>
  );
}
```

#### Direct Service Call

```ts
import { getShippingRate, ShippingRateRequest } from '@/features/shipping';

const request: ShippingRateRequest = {
  sendProvince: '100',
  receiveProvince: '300',
  weight: 2000,
  width: 20,
  height: 20,
  length: 20,
  declaredValue: 5000000, // 5M VND — enables insurance
};

const rate = await getShippingRate(request);
console.log(`Total: ${rate.totalFee}₫ (Ship: ${rate.shippingFee}₫, Insurance: ${rate.insuranceFee}₫)`);
```

## API Endpoints

### Service Types

- **VTP** (Default): Standard shipping, 2-3 days
- **VTX**: Express shipping, 1 day (higher fee)
- **VTL**: Parcel locker, 2 days

### Province Codes

Common codes (Viettel format):

- `100` — Hanoi (Hà Nội)
- `102` — Hai Phong (Hải Phòng)
- `203` — Da Nang (Đà Nẵng)
- `204` — Hue (Huế)
- `300` — Ho Chi Minh City (TP. Hồ Chí Minh)
- `400` — Can Tho (Cần Thơ)

For full list, call `calculate_shipping_rate()` RPC or check Viettel documentation.

## Caching Strategy

### Cache Behavior

- **TTL**: 1 hour (3600 seconds) by default
- **Key**: `(send_province, receive_province, weight, service_id)`
- **Storage**: Supabase `shipping_rate_cache` table
- **Auto-cleanup**: Expired entries removed every 24 hours

### Cache Hit

When a rate request matches cached entry (not expired):

1. RPC returns cached fee immediately (no API call)
2. Response includes `"source": "cache"`
3. Same TTL respected

### Cache Invalidation

Rates expire after configured TTL. To manually clear:

```ts
import { cleanupExpiredCache } from '@/features/shipping/api/viettelService';

const { deleted } = await cleanupExpiredCache();
console.log(`Deleted ${deleted} expired cache entries`);
```

## Error Handling

### Error Types

- `INVALID_PROVINCE` — Province code not found
- `INVALID_WEIGHT` — Weight outside boundaries (100g–30kg)
- `INVALID_DIMENSIONS` — Dimension constraints violated
- `RATE_NOT_AVAILABLE` — No rate available for this route
- `NETWORK_ERROR` — Connection to API failed
- `API_ERROR` — Viettel API returned error
- `CACHE_ERROR` — Database cache operation failed

### Fallback Behavior

When Viettel API unavailable:

1. Check cache first (may return stale rate)
2. If no cache hit, return estimated rate (fee = 0)
3. Response includes `statusCode: 503` and error message
4. Client can decide to show estimated rate or error UI

## Monitoring & Debugging

### Check Cache Status

```sql
-- In Supabase SQL Editor
SELECT COUNT(*) as total_cached,
       COUNT(*) FILTER (WHERE expires_at > now()) as valid,
       COUNT(*) FILTER (WHERE expires_at <= now()) as expired
FROM public.shipping_rate_cache;
```

### Recent Rates

```sql
SELECT send_province, receive_province, weight, shipping_fee,
       estimated_days, expires_at
FROM public.shipping_rate_cache
ORDER BY fetched_at DESC
LIMIT 10;
```

### RPC Testing

```bash
# Via Supabase CLI
supabase functions invoke calculate_shipping_rate \
  --local \
  --header "Authorization: Bearer <token>" \
  --body '{"p_send_province":"100","p_receive_province":"300","p_weight":1000}'
```

## Integration Roadmap

### Phase 1 (Current)

- ✅ Types & constants
- ✅ Database schema (cache table + RPC functions)
- ✅ Service implementation (validation, caching)
- ✅ React hook (useShippingRate)
- ✅ Unit + RPC tests

### Phase 2

- [ ] Real Viettel API HTTP client
- [ ] API webhook for rate updates
- [ ] Customer-specific rate tiers
- [ ] Bulk rate calculation optimization

### Phase 3

- [ ] Machine learning rate prediction
- [ ] A/B testing for different carriers
- [ ] Rate comparison UI component

## References

- [Viettel Post API Docs](https://develop.viettelpost.vn)
- [Architecture Guide](../ARCHITECTURE.md)
- [Business Logic](../BUSINESS_LOGIC.md)

---

**Last Updated**: 2026-06-14
