# How Payments Work

This page explains payment behavior at a business level.

## Payment Options

Rental partners can choose between:
- Full payment
- Downpayment with later balance payment

## Typical Customer Payment Journey

```mermaid
sequenceDiagram
    participant Customer
    participant App
    participant PaymentProvider as Secure Payment Provider
    participant RentalPartner as Rental Partner

    Customer->>App: Place booking and continue to payment
    App->>PaymentProvider: Start secure checkout
    PaymentProvider-->>App: Payment success
    App-->>RentalPartner: Booking is ready for confirmation
    RentalPartner-->>Customer: Confirms booking and prepares delivery
```

## Important Notes

- Customer funds remain protected until delivery is confirmed.
- Payment progress is visible in booking status.
- If downpayment is enabled, the remaining balance must be completed before delivery.
