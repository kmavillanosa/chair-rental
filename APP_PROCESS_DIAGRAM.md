# RentalBasic Process Diagram

This document maps the current end-to-end app flow based on inspected code in frontend routes and backend booking/payment services.

## 1) System Context

```mermaid
flowchart LR
    C[Customer App<br/>React Vite PWA] --> API[NestJS API]
    V[Vendor/Staff App<br/>React Vite PWA] --> API
    A[Admin/Staff App<br/>React Vite PWA] --> API

    API --> DB[(MySQL via TypeORM)]
    API --> PM[PayMongo Checkout API]
    API --> RC[Rocket.Chat]
    API --> PN[Push Notifications Service]
    API --> FS[/Uploads Filesystem/]

    FS --> C
    FS --> V
```

## 2) Frontend Route-Level Process Map

```mermaid
flowchart TD
    Start["Open App"] --> Home["/"]
    Home --> Results["/results"]
    Results --> VendorLanding["/shop/:slug"]
    VendorLanding --> BookingFlow["/book/:slug"]
    BookingFlow --> MyBookings["/my-bookings"]
    MyBookings --> MyBookingDetails["/my-bookings/:bookingId"]

    Home --> Login["/login"]
    Login --> AuthCallback["/auth/callback"]

    AuthCallback --> CustomerRoutes[Customer Routes]
    AuthCallback --> VendorRoutes[Vendor Routes]
    AuthCallback --> AdminRoutes[Admin Routes]

    VendorRoutes --> VD["/vendor"]
    VendorRoutes --> VI["/vendor/inventory"]
    VendorRoutes --> VB["/vendor/bookings"]
    VendorRoutes --> VP["/vendor/pricing"]
    VendorRoutes --> VS["/vendor/shop"]
    VendorRoutes --> VPay["/vendor/payments"]

    AdminRoutes --> AD["/admin"]
    AdminRoutes --> AV["/admin/vendors"]
    AdminRoutes --> AI["/admin/item-types"]
    AdminRoutes --> AB["/admin/brands"]
    AdminRoutes --> AP["/admin/payments"]
```

## 3) Customer Booking + Payment Flow

```mermaid
sequenceDiagram
    autonumber
    participant U as Customer
    participant APP as Customer App
    participant API as Bookings API
    participant PR as Pricing Service
    participant PM as PayMongo

    U->>APP: Select vendor and items
    APP->>API: GET /bookings/vendor/:vendorId/availability
    API-->>APP: Available quantities

    U->>APP: Submit booking request
    APP->>API: POST /bookings
    API->>PR: calculateQuote(distance, helpers, surcharges)
    PR-->>API: delivery/helper/waiting/night totals
    API->>API: Create booking + items + payout record

    alt PAYMONGO_ENABLED=true
        API->>PM: Create checkout session
        PM-->>API: checkout_url + session_id
        API-->>APP: booking + paymentCheckoutUrl
        APP->>PM: Redirect customer to checkout

        PM-->>APP: Redirect back with payment status
        APP->>API: POST /bookings/:id/payment/verify
        API->>PM: Verify checkout session status
        PM-->>API: Paid confirmation
        API->>API: Set paymentStatus=held, totalPaidAmount=total
        API-->>APP: Updated booking
    else PAYMONGO_ENABLED=false
        API-->>APP: booking without online checkout
    end
```

## 4) Booking Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: Booking created

    pending --> confirmed: Vendor/Admin confirms
    pending --> cancelled: Customer/Vendor/Admin cancel

    confirmed --> completed: Vendor marks complete + customer confirms delivery
    confirmed --> cancelled: Cancel before completion

    completed --> [*]
    cancelled --> [*]

    note right of pending
      paymentStatus can be:
      unpaid/pending/checkout_pending
    end note

    note right of completed
      paymentStatus typically completed
      payout moves toward ready/released
    end note
```

## 5) Payment and Payout Process

```mermaid
flowchart TD
    B[Booking total computed] --> P{PayMongo enabled?}

    P -->|No| M1[Manual/offline flow]
    P -->|Yes| C1[Create checkout session]

    C1 --> C2[Customer pays in PayMongo]
    C2 --> C3[Verify checkout session]
    C3 --> C4[Booking paymentStatus = held]
    C4 --> C5[escrowHeldAmount = totalPaidAmount]

    C5 --> D1[Vendor uploads delivery proof]
    D1 --> D2[Customer confirms delivery]
    D2 --> D3[Booking paymentStatus = completed]
    D3 --> D4[Vendor payout status = ready]
    D4 --> D5[Admin release payout]
    D5 --> D6[Vendor payout status = released]
```

## 6) Vendor Fulfillment + Post-Booking Process

```mermaid
flowchart TD
    V1[Vendor sees booking list] --> V2[Accept/confirm booking]
    V2 --> V3[Coordinate in booking chat]
    V3 --> V4[Deliver items]
    V4 --> V5[Upload delivery proof]
    V5 --> C1[Customer confirms delivery]
    C1 --> C2[Booking completed]
    C2 --> C3[Customer can submit review]
    C2 --> C4[Signed docs available: contract/receipt]
```

## 7) Dispute and Cancellation Branches

```mermaid
flowchart TD
    X1[Active booking] --> X2{Issue occurs?}
    X2 -->|No| X3[Normal completion path]
    X2 -->|Yes| X4[Open dispute]

    X1 --> X5{Cancellation requested?}
    X5 -->|No| X3
    X5 -->|Yes| X6[Compute refund policy]
    X6 --> X7[Attempt PayMongo refund if applicable]
    X7 --> X8[Booking cancelled]
```

## Notes

- Remaining-balance checkout endpoint exists but currently returns a validation error because full payment at booking checkout is enforced.
- PayMongo success/cancel redirects include booking context and return to booking screens where verification is processed.
- Route and module scopes are role-protected (customer, vendor, admin).
