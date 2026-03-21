# Multi-Vendor Pricing System Design & Implementation

## 1. DATABASE SCHEMA

### Tables Created

#### `vendor_pricing_configs`
Stores the main pricing configuration for each vendor.

```sql
CREATE TABLE vendor_pricing_configs (
  id VARCHAR(36) PRIMARY KEY,
  vendorId VARCHAR(36) UNIQUE NOT NULL,
  
  -- DELIVERY SETTINGS
  deliveryFreeRadiusKm DECIMAL(5,2) DEFAULT 2,
  deliveryPerKmEnabled BOOLEAN DEFAULT FALSE,
  deliveryPerKmRate DECIMAL(10,2) NULL,
  
  -- HELPER SETTINGS
  helpersEnabled BOOLEAN DEFAULT TRUE,
  helpersPricingMode ENUM('tiered','fixed','hourly') DEFAULT 'tiered',
  helpersFixedPrice DECIMAL(10,2) NULL,
  helpersHourlyRate DECIMAL(10,2) NULL,
  helpersMaxCount INT DEFAULT 3,
  
  -- ADDITIONAL FEES
  waitingFeePerHour DECIMAL(10,2) DEFAULT 100,
  nightSurcharge DECIMAL(10,2) DEFAULT 0,
  minOrderAmount DECIMAL(12,2) DEFAULT 0,
  
  -- STATUS
  isActive BOOLEAN DEFAULT TRUE,
  notes TEXT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (vendorId) REFERENCES vendors(id) ON DELETE CASCADE,
  UNIQUE KEY unique_vendor_pricing(vendorId)
);
```

#### `vendor_delivery_pricing_tiers`
Distance-based delivery pricing tiers for each vendor.

```sql
CREATE TABLE vendor_delivery_pricing_tiers (
  id VARCHAR(36) PRIMARY KEY,
  pricingConfigId VARCHAR(36) NOT NULL,
  minDistanceKm DECIMAL(5,2) NOT NULL,
  maxDistanceKm DECIMAL(5,2) NOT NULL,
  priceAmount DECIMAL(12,2) NOT NULL,
  sortOrder INT DEFAULT 0,
  
  FOREIGN KEY (pricingConfigId) REFERENCES vendor_pricing_configs(id) ON DELETE CASCADE,
  KEY idx_pricing_config(pricingConfigId),
  UNIQUE KEY unique_tier_range(pricingConfigId, minDistanceKm, maxDistanceKm)
);
```

#### `vendor_helper_pricing_tiers`
Helper pricing tiers for each vendor.

```sql
CREATE TABLE vendor_helper_pricing_tiers (
  id VARCHAR(36) PRIMARY KEY,
  pricingConfigId VARCHAR(36) NOT NULL,
  helperCount INT NOT NULL,
  priceAmount DECIMAL(12,2) NOT NULL,
  sortOrder INT DEFAULT 0,
  
  FOREIGN KEY (pricingConfigId) REFERENCES vendor_pricing_configs(id) ON DELETE CASCADE,
  KEY idx_pricing_config(pricingConfigId),
  UNIQUE KEY unique_helper_tier(pricingConfigId, helperCount)
);
```

---

## 2. API ENDPOINTS

### Public Endpoints (No Auth Required)

#### Get Pricing Quote
```
GET /payments/vendors/{vendorId}/pricing-quote
Content-Type: application/json

{
  "baseRentalCost": 5000,
  "distanceKm": 8.5,
  "helperCount": 2,
  "waitingHours": 2,
  "isNightDelivery": false
}

Response:
{
  "baseRentalCost": 5000,
  "deliveryFee": 200,
  "helperFee": 900,
  "waitingFee": 200,
  "nightSurcharge": 0,
  "totalCost": 6300,
  "breakdown": {
    "distance": {
      "km": 8.5,
      "appliedTier": {
        "min": 6,
        "max": 10,
        "price": 200
      }
    },
    "helpers": {
      "count": 2,
      "appliedTier": {
        "count": 2,
        "price": 900
      }
    }
  },
  "notes": [
    "Delivery tier: 6–10km @ ₱200",
    "Helper tier: 2 helpers @ ₱900",
    "Waiting time: ₱100/hour × 2hours"
  ]
}
```

### Vendor Endpoints (JWT Required, Vendor Role)

#### Get My Pricing Config
```
GET /payments/vendors/my/pricing-config
Authorization: Bearer {token}
```

#### Update My Pricing Config
```
PATCH /payments/vendors/my/pricing-config
Authorization: Bearer {token}
Content-Type: application/json

{
  "deliveryFreeRadiusKm": 3,
  "deliveryPerKmEnabled": false,
  "helpersMaxCount": 5,
  "waitingFeePerHour": 150
}
```

#### Create/Update Delivery Tiers
```
POST /payments/vendors/my/pricing-config/delivery-tiers
Authorization: Bearer {token}
Content-Type: application/json

[
  { "minDistanceKm": 3, "maxDistanceKm": 5, "priceAmount": 100 },
  { "minDistanceKm": 6, "maxDistanceKm": 10, "priceAmount": 200 },
  { "minDistanceKm": 11, "maxDistanceKm": 20, "priceAmount": 400 }
]
```

#### Create/Update Helper Tiers
```
POST /payments/vendors/my/pricing-config/helper-tiers
Authorization: Bearer {token}
Content-Type: application/json

[
  { "helperCount": 1, "priceAmount": 500 },
  { "helperCount": 2, "priceAmount": 900 },
  { "helperCount": 3, "priceAmount": 1300 }
]
```

### Admin Endpoints (Admin Role)

#### Get All Vendor Pricing Configs
```
GET /payments/admin/pricing-configs
Authorization: Bearer {token}
```

#### Reset Vendor Pricing to Defaults
```
POST /payments/admin/vendors/{vendorId}/pricing/reset
Authorization: Bearer {token}
```

---

## 3. PRICING CALCULATION PSEUDOCODE

```pseudocode
FUNCTION calculateQuote(
  vendorId,
  baseRentalCost,
  distanceKm,
  helperCount = 0,
  waitingHours = 0,
  isNightDelivery = false
):
  
  // Load vendor's pricing config
  config := loadPricingConfig(vendorId)
  IF config NOT FOUND:
    THROW BadRequestException("Pricing config not found")
  
  notes := []
  deliveryFee := 0
  helperFee := 0
  waitingFee := 0
  nightSurcharge := 0
  
  // ===== DELIVERY FEE CALCULATION =====
  IF distanceKm <= config.deliveryFreeRadiusKm:
    deliveryFee := 0
    APPEND notes: "Free delivery (within {radius}km radius)"
  ELSE:
    // Distance is chargeable beyond free radius
    IF config.deliveryPerKmEnabled AND config.deliveryPerKmRate:
      // Use per-km pricing
      chargeableDistance := distanceKm - config.deliveryFreeRadiusKm
      deliveryFee := chargeableDistance * config.deliveryPerKmRate
      APPEND notes: "Per-km: ₱{rate}/km × {distance}km"
    ELSE:
      // Use tiered pricing
      tier := findDeliveryTier(config.deliveryTiers, distanceKm)
      IF tier EXISTS:
        deliveryFee := tier.priceAmount
        APPEND notes: "Tier {min}–{max}km @ ₱{price}"
      ELSE:
        THROW BadRequestException("Distance exceeds max delivery range")
  
  // ===== HELPER FEE CALCULATION =====
  IF config.helpersEnabled AND helperCount > 0:
    IF helperCount > config.helpersMaxCount:
      THROW BadRequestException("Max {max} helpers allowed")
    
    IF config.helpersPricingMode == 'tiered':
      tier := findHelperTier(config.helperTiers, helperCount)
      IF tier EXISTS:
        helperFee := tier.priceAmount
        APPEND notes: "Helpers {count} @ ₱{price}"
    
    ELSE IF config.helpersPricingMode == 'fixed':
      helperFee := config.helpersFixedPrice * helperCount
      APPEND notes: "Fixed: ₱{price} × {count} helpers"
    
    ELSE IF config.helpersPricingMode == 'hourly':
      hours := waitingHours OR 1
      helperFee := config.helpersHourlyRate * helperCount * hours
      APPEND notes: "Hourly: ₱{rate}/hr × {count} helpers × {hours}h"
  
  ELSE IF helperCount > 0 AND NOT config.helpersEnabled:
    THROW BadRequestException("Helpers not offered by this vendor")
  
  // ===== ADDITIONAL FEES =====
  IF waitingHours > 0 AND config.waitingFeePerHour > 0:
    waitingFee := config.waitingFeePerHour * waitingHours
    APPEND notes: "Waiting: ₱{fee}/hr × {hours}h"
  
  IF isNightDelivery AND config.nightSurcharge > 0:
    nightSurcharge := config.nightSurcharge
    APPEND notes: "Night surcharge: ₱{surcharge}"
  
  // ===== MINIMUM ORDER CHECK =====
  subtotal := baseRentalCost + deliveryFee + helperFee + waitingFee + nightSurcharge
  
  IF subtotal < config.minOrderAmount:
    THROW BadRequestException("Minimum order: ₱{min}, current: ₱{subtotal}")
  
  RETURN {
    baseRentalCost: baseRentalCost,
    deliveryFee: deliveryFee,
    helperFee: helperFee,
    waitingFee: waitingFee,
    nightSurcharge: nightSurcharge,
    totalCost: subtotal,
    breakdown: { distance, helpers },
    notes: notes
  }

// Helper function: Find applicable delivery tier
FUNCTION findDeliveryTier(tiers, distanceKm):
  FOR EACH tier IN sortedTiers(distanceKm ASC):
    IF distanceKm >= tier.minDistanceKm AND distanceKm <= tier.maxDistanceKm:
      RETURN tier
  RETURN NULL

// Helper function: Find applicable helper tier
FUNCTION findHelperTier(tiers, helperCount):
  // Find the tier where helperCount >= tier.count
  // (highest applicable tier)
  FOR EACH tier IN sortedTiers(helperCount DESC):
    IF helperCount >= tier.helperCount:
      RETURN tier
  RETURN NULL
```

---

## 4. ONBOARDING AUTOMATION

### Sequence: KYC Approval → Pricing Bootstrap

When admin approves a vendor's KYC:

```
1. Admin calls: PATCH /vendors/{id}/review
   {
     "decision": "approve",
     "notes": "KYC approved"
   }

2. VendorService.reviewRegistration():
   a. Validate vendor documents
   b. Update vendor status to APPROVED
   c. Update vendor role to VENDOR
   d. Log verification action
   e. Send approval email
   f. Call PricingConfigBootstrapService.bootstrapPricingConfigForVendor(id)
      ↓
      Creates:
      - vendor_pricing_configs row with platform defaults
      - 7 vendor_delivery_pricing_tiers with distance ranges
      - 3 vendor_helper_pricing_tiers with helper counts
   
3. Vendor can now:
   a. Accept bookings immediately (uses default pricing)
   b. Customize pricing at any time via /vendors/my/pricing-config endpoint
```

### Default Pricing Template (Auto-Created)

```json
{
  "deliveryFreeRadiusKm": 2,
  "deliveryPerKmEnabled": false,
  "deliveryPerKmRate": null,
  "helpersEnabled": true,
  "helpersPricingMode": "tiered",
  "helpersFixedPrice": null,
  "helpersHourlyRate": null,
  "helpersMaxCount": 3,
  "waitingFeePerHour": 100,
  "nightSurcharge": 0,
  "minOrderAmount": 0,
  "deliveryTiers": [
    { "minDistanceKm": 3, "maxDistanceKm": 5, "priceAmount": 100 },
    { "minDistanceKm": 6, "maxDistanceKm": 10, "priceAmount": 200 },
    { "minDistanceKm": 11, "maxDistanceKm": 20, "priceAmount": 400 },
    { "minDistanceKm": 21, "maxDistanceKm": 40, "priceAmount": 800 },
    { "minDistanceKm": 41, "maxDistanceKm": 60, "priceAmount": 1200 },
    { "minDistanceKm": 61, "maxDistanceKm": 80, "priceAmount": 1600 },
    { "minDistanceKm": 81, "maxDistanceKm": 100, "priceAmount": 2000 }
  ],
  "helperTiers": [
    { "helperCount": 1, "priceAmount": 500 },
    { "helperCount": 2, "priceAmount": 900 },
    { "helperCount": 3, "priceAmount": 1300 }
  ]
}
```

---

## 5. EXAMPLE COMPUTATIONS

### Example 1: Short Distance, No Helpers

**Scenario:**
- Vendor: AceChairs (vendorId: `ven-001`)
- Item: 50 folding chairs @ ₱100/day × 3 days = ₱15,000 base
- Delivery: 1.5 km away (within 2 km free delivery)
- Helpers: None requested
- Delivery time: Daytime

**Request:**
```http
GET /payments/vendors/ven-001/pricing-quote
{
  "baseRentalCost": 15000,
  "distanceKm": 1.5,
  "helperCount": 0
}
```

**Vendor Config:**
```json
{
  "deliveryFreeRadiusKm": 2,
  "helpersEnabled": true,
  "deliveryTiers": [
    { "minDistanceKm": 3, "maxDistanceKm": 5, "priceAmount": 100 },
    { "minDistanceKm": 6, "maxDistanceKm": 10, "priceAmount": 200 }
  ]
}
```

**Calculation:**
```
baseRentalCost = ₱15,000
deliveryFee = ₱0 (distance 1.5 km ≤ free radius 2 km)
helperFee = ₱0 (helpers count = 0)
waitingFee = ₱0
nightSurcharge = ₱0
─────────────────
TOTAL = ₱15,000

Notes:
- "Free delivery (within 2km radius)"
```

**Response:**
```json
{
  "baseRentalCost": 15000,
  "deliveryFee": 0,
  "helperFee": 0,
  "waitingFee": 0,
  "nightSurcharge": 0,
  "totalCost": 15000,
  "breakdown": {
    "distance": {
      "km": 1.5
    },
    "helpers": {
      "count": 0
    }
  },
  "notes": [
    "Free delivery (within 2km radius)"
  ]
}
```

---

### Example 2: Medium Distance, 2 Helpers, Waiting Time

**Scenario:**
- Vendor: PartyProAY (vendorId: `ven-002`)
- Item: 100 chiavari chairs @ ₱75/day × 2 days = ₱15,000 base
- Delivery: 8 km away (requires delivery fee)
- Helpers: 2 assistants for setup
- Waiting time: 2 hours (setup + takedown)
- Delivery time: Daytime

**Request:**
```http
GET /payments/vendors/ven-002/pricing-quote
{
  "baseRentalCost": 15000,
  "distanceKm": 8,
  "helperCount": 2,
  "waitingHours": 2
}
```

**Vendor Config (Uses Defaults):**
```json
{
  "deliveryFreeRadiusKm": 2,
  "helpersEnabled": true,
  "helpersPricingMode": "tiered",
  "helperTiers": [
    { "helperCount": 1, "priceAmount": 500 },
    { "helperCount": 2, "priceAmount": 900 },
    { "helperCount": 3, "priceAmount": 1300 }
  ],
  "deliveryTiers": [
    { "minDistanceKm": 3, "maxDistanceKm": 5, "priceAmount": 100 },
    { "minDistanceKm": 6, "maxDistanceKm": 10, "priceAmount": 200 },  // ← Matches 8km
    { "minDistanceKm": 11, "maxDistanceKm": 20, "priceAmount": 400 }
  ],
  "waitingFeePerHour": 100
}
```

**Calculation:**
```
baseRentalCost = ₱15,000

Delivery:
  distance 8 km > free radius 2 km → chargeable
  match tier: 6–10 km → ₱200 ✓
  deliveryFee = ₱200

Helpers:
  requested 2, max 3 ✓
  match tier: 2 helpers → ₱900 ✓
  helperFee = ₱900

Waiting:
  2 hours × ₱100/hour = ₱200
  waitingFee = ₱200

Night surcharge:
  daytime delivery = ₱0

─────────────────
TOTAL = ₱15,000 + ₱200 + ₱900 + ₱200 = ₱16,300

Notes:
- "Delivery tier: 6–10km @ ₱200"
- "Helper tier: 2 helpers @ ₱900"
- "Waiting time: ₱100/hour × 2hours"
```

**Response:**
```json
{
  "baseRentalCost": 15000,
  "deliveryFee": 200,
  "helperFee": 900,
  "waitingFee": 200,
  "nightSurcharge": 0,
  "totalCost": 16300,
  "breakdown": {
    "distance": {
      "km": 8,
      "appliedTier": {
        "min": 6,
        "max": 10,
        "price": 200
      }
    },
    "helpers": {
      "count": 2,
      "appliedTier": {
        "count": 2,
        "price": 900
      }
    }
  },
  "notes": [
    "Delivery tier: 6–10km @ ₱200",
    "Helper tier: 2 helpers @ ₱900",
    "Waiting time: ₱100/hour × 2hours"
  ]
}
```

---

### Example 3: Long Distance, 3 Helpers, Night Delivery

**Scenario:**
- Vendor: EventProTO (vendorId: `ven-003`) - Premium vendor with custom pricing
- Item: 200 fancy banquet chairs @ ₱120/day × 2 days = ₱48,000 base
- Delivery: 45 km away (long distance)
- Helpers: 3 assistants for event setup
- Waiting time: 4 hours (full event support)
- Delivery time: Night (after 6 PM)

**Vendor Config (Custom Premium Pricing):**
```json
{
  "deliveryFreeRadiusKm": 2,
  "helpersEnabled": true,
  "helpersPricingMode": "tiered",
  "helperTiers": [
    { "helperCount": 1, "priceAmount": 750 },    // Premium rates
    { "helperCount": 2, "priceAmount": 1400 },
    { "helperCount": 3, "priceAmount": 1900 }
  ],
  "deliveryTiers": [
    { "minDistanceKm": 3, "maxDistanceKm": 5, "priceAmount": 150 },
    { "minDistanceKm": 6, "maxDistanceKm": 10, "priceAmount": 250 },
    { "minDistanceKm": 11, "maxDistanceKm": 20, "priceAmount": 500 },
    { "minDistanceKm": 21, "maxDistanceKm": 40, "priceAmount": 1000 },
    { "minDistanceKm": 41, "maxDistanceKm": 60, "priceAmount": 1500 }  // ← Matches 45km
  ],
  "waitingFeePerHour": 300,
  "nightSurcharge": 500
}
```

**Request:**
```http
GET /payments/vendors/ven-003/pricing-quote
{
  "baseRentalCost": 48000,
  "distanceKm": 45,
  "helperCount": 3,
  "waitingHours": 4,
  "isNightDelivery": true
}
```

**Calculation:**
```
baseRentalCost = ₱48,000

Delivery:
  distance 45 km > free radius 2 km → chargeable
  match tier: 41–60 km → ₱1,500 ✓
  deliveryFee = ₱1,500

Helpers:
  requested 3, max 3 ✓
  match tier: 3 helpers → ₱1,900 ✓
  helperFee = ₱1,900

Waiting:
  4 hours × ₱300/hour = ₱1,200
  waitingFee = ₱1,200

Night surcharge:
  isNightDelivery = true → ₱500
  nightSurcharge = ₱500

─────────────────
TOTAL = ₱48,000 + ₱1,500 + ₱1,900 + ₱1,200 + ₱500 = ₱53,100

Notes:
- "Delivery tier: 41–60km @ ₱1,500"
- "Helper tier: 3 helpers @ ₱1,900"
- "Waiting time: ₱300/hour × 4hours"
- "Night surcharge: ₱500"
```

**Response:**
```json
{
  "baseRentalCost": 48000,
  "deliveryFee": 1500,
  "helperFee": 1900,
  "waitingFee": 1200,
  "nightSurcharge": 500,
  "totalCost": 53100,
  "breakdown": {
    "distance": {
      "km": 45,
      "appliedTier": {
        "min": 41,
        "max": 60,
        "price": 1500
      }
    },
    "helpers": {
      "count": 3,
      "appliedTier": {
        "count": 3,
        "price": 1900
      }
    }
  },
  "notes": [
    "Delivery tier: 41–60km @ ₱1,500",
    "Helper tier: 3 helpers @ ₱1,900",
    "Waiting time: ₱300/hour × 4hours",
    "Night surcharge: ₱500"
  ]
}
```

---

## 6. INTEGRATION POINTS

### Backend Services Implemented

1. **PricingConfigBootstrapService**
   - Called during vendor KYC approval
   - Creates default pricing config with 7 delivery tiers + 3 helper tiers
   - Idempotent (won't recreate if already exists)
   - Can reset to defaults on demand

2. **PricingCalculationService**
   - Real-time quote calculation
   - Validates distance against delivery tiers
   - Validates helper count against max allowed
   - Applies waiting fees and night surcharges
   - Enforces minimum order amounts
   - Returns detailed breakdown and notes

3. **Updated VendorService**
   - Integrated bootstrap call into KYC approval flow
   - Non-blocking (failure to bootstrap won't fail approval)

### Database Migrations
- Migration: `202603211122_add_vendor_pricing_configuration.ts`
- Creates 3 new tables, 4 indexes, 2 unique constraints

### API Endpoints Added
- `GET /payments/vendors/{vendorId}/pricing-quote` - Public quote endpoint
- (Additional CRUD endpoints for vendor config and tier management TBD)

### Frontend Integration Points (Pending)
- Vendor pricing config page (CRUD for delivery/helper tiers)
- Public pricing calculator modal on VendorLanding.tsx
- Booking flow integration (use calculated charges instead of frontend estimate)

---

## 7. KEY DESIGN DECISIONS

1. **Tiered vs Per-KM Pricing**: Both supported
   - Tiers: Discrete pricing bands (simpler for customers, better for most vendors)
   - Per-KM: Continuous pricing (best for very long distances)
   - Toggle: `deliveryPerKmEnabled` allows switch per vendor

2. **Helper Pricing Modes**: Three options
   - **Tiered** (default): Fixed price for N helpers (₱500, ₱900, ₱1,300)
   - **Fixed**: Per-helper rate multiplied by count
   - **Hourly**: Per-helper-per-hour rate

3. **Onboarding Security**:
   - Defaults ensure vendor can operate immediately
   - Bootstrap is idempotent (safe to retry)
   - Non-blocking (approval completes even if bootstrap fails)

4. **Client-Side Trust Elimination**:
   - Public quote endpoint is server-authoritative
   - Frontend estimates are hints only
   - Booking will recalculate server-side (TBD in next phase)

5. **Scalability**:
   - No hardcoded pricing (all per-vendor)
   - Tier counts are flexible (min 1 tier, no max)
   - Supports 100+ vendors independently

---

## 8. NEXT PHASES

- **Phase 2**: Admin endpoints for pricing config audits and resets
- **Phase 3**: Vendor pricing editor UI (CRUD tiers)
- **Phase 4**: Update booking service to recalculate charges server-side
- **Phase 5**: Public pricing calculator modal on customer landing page
