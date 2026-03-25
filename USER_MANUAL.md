# Chair Rental Platform — User Manual

> **Platform:** RentalBasic (rentalbasic.com)
> **Apps:** Customer App (`app.rentalbasic.com`) · Vendor/Staff App (`vendor.rentalbasic.com`)
> **Last Updated:** March 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Customer Side](#2-customer-side)
   - 2.1 [Getting Started — Login](#21-getting-started--login)
   - 2.2 [Searching for Vendors](#22-searching-for-vendors)
   - 2.3 [Exploring Search Results on the Map](#23-exploring-search-results-on-the-map)
   - 2.4 [Viewing a Vendor's Public Shop](#24-viewing-a-vendors-public-shop)
   - 2.5 [Creating a Booking (Checkout Flow)](#25-creating-a-booking-checkout-flow)
   - 2.6 [Paying for a Booking](#26-paying-for-a-booking)
   - 2.7 [Managing Your Bookings](#27-managing-your-bookings)
   - 2.8 [Confirming Delivery](#28-confirming-delivery)
   - 2.9 [Cancelling a Booking](#29-cancelling-a-booking)
   - 2.10 [Rating a Vendor](#210-rating-a-vendor)
   - 2.11 [Opening a Dispute](#211-opening-a-dispute)
   - 2.12 [Downloading Documents (Contract & Receipt)](#212-downloading-documents-contract--receipt)
   - 2.13 [Chatting with a Vendor](#213-chatting-with-a-vendor)
   - 2.14 [Applying to Become a Vendor](#214-applying-to-become-a-vendor)
3. [Vendor Side](#3-vendor-side)
   - 3.1 [Logging In to the Vendor Portal](#31-logging-in-to-the-vendor-portal)
   - 3.2 [Vendor Dashboard Overview](#32-vendor-dashboard-overview)
   - 3.3 [Managing Your Shop Profile](#33-managing-your-shop-profile)
   - 3.4 [Managing Inventory](#34-managing-inventory)
   - 3.5 [Managing Inventory Photo Gallery](#35-managing-inventory-photo-gallery)
   - 3.6 [Setting Up Delivery Vehicle List](#36-setting-up-delivery-vehicle-list)
   - 3.7 [Setting Up Pricing — Distance Tiers](#37-setting-up-pricing--distance-tiers)
   - 3.8 [Setting Up Pricing — Helper Tiers](#38-setting-up-pricing--helper-tiers)
   - 3.9 [Viewing Bookings (List View)](#39-viewing-bookings-list-view)
   - 3.10 [Viewing Bookings (Calendar View)](#310-viewing-bookings-calendar-view)
   - 3.11 [Booking Detail — Actions & Documents](#311-booking-detail--actions--documents)
   - 3.12 [Chatting with a Customer](#312-chatting-with-a-customer)
   - 3.13 [Uploading Delivery Proof](#313-uploading-delivery-proof)
   - 3.14 [Writing a Review for a Customer](#314-writing-a-review-for-a-customer)
   - 3.15 [Opening a Dispute (Vendor side)](#315-opening-a-dispute-vendor-side)
   - 3.16 [Viewing Payments & Payouts](#316-viewing-payments--payouts)
4. [Admin Side](#4-admin-side)
   - 4.1 [Logging In to the Admin Portal](#41-logging-in-to-the-admin-portal)
   - 4.2 [Admin Dashboard Overview](#42-admin-dashboard-overview)
   - 4.3 [Managing Customers](#43-managing-customers)
   - 4.4 [Managing Vendors (Active List)](#44-managing-vendors-active-list)
   - 4.5 [Reviewing Vendor Applicants (KYC)](#45-reviewing-vendor-applicants-kyc)
   - 4.6 [Managing Item Types (Equipment Categories)](#46-managing-item-types-equipment-categories)
   - 4.7 [Managing Brands](#47-managing-brands)
   - 4.8 [Payments Overview & Billing](#48-payments-overview--billing)
   - 4.9 [Releasing Vendor Payouts](#49-releasing-vendor-payouts)
   - 4.10 [Managing Disputes](#410-managing-disputes)
   - 4.11 [Fraud Alerts & Risk Monitoring](#411-fraud-alerts--risk-monitoring)
   - 4.12 [Platform Feature Flags & Settings](#412-platform-feature-flags--settings)
   - 4.13 [KYC Onboarding Settings](#413-kyc-onboarding-settings)
5. [Key Concepts & Glossary](#5-key-concepts--glossary)
6. [Booking Status Reference](#6-booking-status-reference)
7. [Payment Status Reference](#7-payment-status-reference)
8. [Cancellation & Refund Policy](#8-cancellation--refund-policy)

---

## 1. Platform Overview

RentalBasic is a marketplace platform that connects **customers** who need event equipment rentals (chairs, tables, tents, audio systems, lighting, etc.) with **vendors** who own and deliver that equipment.

### Three User Roles

| Role | App | Primary Purpose |
|------|-----|-----------------|
| **Customer** | `app.rentalbasic.com` | Discover vendors, book equipment, manage orders |
| **Vendor** | `vendor.rentalbasic.com` | List inventory, manage bookings, receive payouts |
| **Admin** | `vendor.rentalbasic.com` (admin route) | Moderate platform, approve vendors, manage finances |

### How the platform works — end-to-end

```
Customer searches by location & equipment type
        ↓
Customer views nearby vendor map & shop pages
        ↓
Customer creates a booking (selects items, dates, delivery address)
        ↓
Customer pays via PayMongo (online checkout)
        ↓
Vendor confirms, fulfills, and delivers the equipment
        ↓
Vendor marks delivery done → Customer confirms receipt
        ↓
Platform releases vendor payout (escrow released)
        ↓
Both parties can leave reviews / disputes can be opened
```

---

## 2. Customer Side

The customer app is accessed at **`https://app.rentalbasic.com`** (or a vendor subdomain like `store.rentalbasic.com` when browsing a specific vendor's shop directly).

---

### 2.1 Getting Started — Login

**URL:** `/login`

**Purpose:** Authenticate to access bookings, checkout, and vendor application features.

**Steps:**
1. Visit the customer app homepage.
2. Click **Login** (or navigate to `/login`).
3. Click **"Continue with Google"** — you will be redirected to Google's OAuth consent screen.
4. Authorize the app; you will be returned to the app and logged in automatically.

> **Note:** The login page also shows a **"Vendor Portal"** button. Clicking this redirects you to `vendor.rentalbasic.com/login` to access the vendor/admin portal. This is a separate login flow.

**After Login:**
- If you are a **customer**, you land on the home search page.
- If you are a **vendor**, you are redirected to the vendor dashboard.
- If you are an **admin**, you are redirected to the admin dashboard.

---

### 2.2 Searching for Vendors

**URL:** `/` (Home page)

**Purpose:** Find vendors near your event location that have the equipment you need.

**Search Form — How to Fill It:**

| Field | Description |
|-------|-------------|
| **Event type** | Select the type of event (Birthday, Wedding, Debut, Corporate, etc.). This pre-filters the equipment list. |
| **Equipment / Items** | Open the item picker. Check all the types of equipment you need (e.g., Folding Chairs, Tables, Sound System). |
| **Dates** | Set your event start and end dates. The platform will check availability for those dates. |
| **Location** | Type your event venue address, or click the location icon to open a map picker. You can also click **"Find Near Me"** to auto-detect via GPS. |
| **Radius** | Select how far (in km) you are willing to have the vendor travel to deliver (e.g., 5 km, 10 km, 25 km). |
| **Helpers needed** | Enter how many delivery helpers you need. Vendors who provide helpers can be filtered accordingly. |

**Search Actions:**
- **"Find Near Me"** — Uses your device's GPS as the event location and immediately navigates to the results map.
- **"Search from pin"** — Uses the location you picked on the map and navigates to the results map.

**Location Modal:**
- Click on the location area to open a full-screen map modal.
- Type an address in the search box (autocomplete powered by Nominatim geocoding).
- Drag the map pin to fine-tune the exact location.
- Click **"Confirm"** to apply.
- Alternatively, click **"Use my current location"** for automatic GPS detection.

---

### 2.3 Exploring Search Results on the Map

**URL:** `/results`

**Purpose:** See all matching vendors plotted on an interactive map with routes and detailed estimates.

**Layout:**
- **Left sidebar** — filters, stats, and a vendor list (on mobile).
- **Right panel** — full-screen Leaflet map.

**Map Features:**
- **Red dashed circle** — your search radius centered on your event location.
- **Blue marker** — your exact event pin with address popup.
- **Vendor pins** — one per matching vendor. Color/icon indicates the vendor is available for your criteria.

**Interacting with a Vendor Pin:**
1. Click a pin → a route is drawn from the vendor to your event location (via road routing).
2. A popup appears showing:
   - Vendor business name + verification badge
   - Address & distance
   - Estimated delivery charge
   - Number of matching item types
   - **"View Shop"** button
3. Click **"View Shop"** to go to the vendor's public storefront.

**Sidebar Controls:**
- **Radius selector** — change the search radius; the map updates automatically.
- **"Modify Search"** — go back to the home page with all your current search parameters pre-filled for editing.
- **"Open Nearest Shop"** — immediately open the top-ranked vendor's shop page.

**Vendor Ranking (how results are sorted):**
1. Most matched equipment types first
2. Lowest estimated delivery charge second
3. Shortest distance third

---

### 2.4 Viewing a Vendor's Public Shop

**URL:** `/shop/:slug` or `https://vendor-slug.rentalbasic.com`

**Purpose:** Browse a specific vendor's inventory, pricing, and profile before booking.

**Page Sections:**

**Hero — Photo Gallery & Info Card:**
- Browse the vendor's equipment gallery (thumbnail strip on the right, main photo on the left).
- See the vendor's business name, verification badge, address (with Google Maps link), phone, and description.
- View the vendor's delivery vehicles.
- Click **"Book Now"** to start a booking with this vendor.

**Pricing at a Glance:**
- Lowest daily rate available.
- Total units & units currently available.
- Item count.

**Delivery & Service:**
- Starting delivery charge (from pricing tiers).
- Service radius in km.
- Whether helpers are supported.
- If you searched with a location, you will see your personalized estimated delivery charge and distance.

**Equipment Catalog:**
- Grid of all inventory items: image, name, color variant, brand, availability status (color-coded), rate/day, and condition.

**Inventory Status (sidebar):**
- Visual breakdown of total vs. available units grouped by item type.

---

### 2.5 Creating a Booking (Checkout Flow)

**URL:** `/book/:slug`  
**Requires:** Login

**Purpose:** Multi-step wizard to select equipment, dates, delivery details, and confirm the order with the vendor.

---

#### Step 1 — Select Items

- Each inventory item is displayed as a card with image, name, color, rate/day, and available quantity.
- Use the **`−`** and **`+`** buttons (or type directly) to set the quantity you need.
- Items with 0 availability are greyed out and cannot be selected.
- If you arrived with pre-set dates (from the search), live availability is shown per item.
- Click **"Next"** when done.

---

#### Step 2 — Select Dates *(skipped if dates were pre-filled from search)*

- Set the **start date** and **end date** of your rental.
- The day count is automatically computed (e.g., "3 days selected").
- After setting dates, the app checks and shows real-time availability for the items in your cart.

---

#### Step 3 — Delivery Details

| Field | Description |
|-------|-------------|
| **Delivery address** | Type the full address where equipment should be delivered. |
| **Delivery map pin** | A map shows the vendor (V) and your delivery location (D). Drag the D pin or click the map to set the exact drop-off point. |
| **"Use current location"** | Auto-pins the delivery location to your GPS coordinates. |
| **Special instructions** | Optional notes for the vendor (access instructions, fragile items, etc.). |

- As you set the delivery location, the platform shows a **live delivery charge estimate** based on the vendor's distance pricing tiers.

---

#### Step 4 — Review & Confirm

- Full cart summary: items, quantities, subtotals.
- **Pricing breakdown:**
  - Items subtotal
  - Platform fee (commission — may be 0 during launch no-commission period)
  - Delivery charge
  - **Total amount**
- Click **"Confirm Booking"**:
  - If online payment is enabled → you are redirected to **PayMongo** to pay by GCash, credit card, or other supported methods.
  - If payment is optional (admin setting) → the booking is created immediately and you can pay later.

---

### 2.6 Paying for a Booking

**URL:** PayMongo checkout (external) → returns to `/my-bookings?payment=success&bookingId=...`

**Purpose:** Securely pay for your booking online.

**Process:**
1. After confirming your booking, you are redirected to a **PayMongo checkout page**.
2. Select your payment method (GCash, credit/debit card, etc.) and complete the payment.
3. On success, you are returned to the platform and your booking's payment status updates automatically.
4. If the payment window expired or you cancelled, you can re-initiate payment from **My Bookings** → **"Pay Now"**.

> **Note:** The full booking amount is collected upfront (100% deposit). No remaining balance is required after payment.

---

### 2.7 Managing Your Bookings

**URL:** `/my-bookings`  
**Requires:** Login

**Purpose:** View and manage all your bookings in one place.

**Filters:**
- **Search** — filter by vendor name or delivery address.
- **Status** — All / Pending / Confirmed / Completed / Cancelled.
- **Date range** — filter bookings by their start/end dates.

**What each booking card shows:**
- Vendor name, booking date range, delivery address.
- Status badge (color-coded).
- Items list with quantities and subtotals.
- Financial summary (total, paid, outstanding).
- If cancelled: refund amount and refund percentage.

**Booking Actions:**

| Action | When Available | What It Does |
|--------|---------------|--------------|
| **View** | Always | Opens the full booking detail page |
| **Pay Now** | Pending + unpaid | Creates/resumes PayMongo checkout |
| **Confirm Delivery** | After delivery | Marks the delivery as received, releases vendor payout |
| **Cancel** | While pending | Shows refund preview, then cancels and triggers refund |

---

### 2.8 Confirming Delivery

**URL:** `/my-bookings` or `/my-bookings/:bookingId`

**Purpose:** Confirm that you have received the equipment in good condition. This step releases the vendor's payment from escrow.

**Steps:**
1. After your event dates, the booking status will be `confirmed` or `completed`.
2. Click **"Confirm delivery"**.
3. The payment is marked as fully completed and released to the vendor.

> **Important:** Only confirm delivery once you have actually received the equipment and are satisfied. Confirming delivery triggers the payout process.

---

### 2.9 Cancelling a Booking

**URL:** `/my-bookings/:bookingId`

**Purpose:** Cancel a booking you no longer need.

**How to cancel:**
1. Go to **My Bookings** and click **"View"** on the booking you want to cancel.
2. Click the **"Cancel"** button (only visible on `pending` bookings).
3. A confirmation dialog shows you the **cancellation preview**:
   - How many days before the event the cancellation is being made
   - Refund percentage and amount
   - Applicable cancellation policy code
4. Confirm to proceed with the cancellation.

**Refund Policy (Customer-Initiated):**

| Days Before Start Date | Refund |
|------------------------|--------|
| 3 or more days | 100% |
| 1–2 days | 50% |
| Same day / after start | 0% |

> **Note:** Refunds are processed through PayMongo back to your original payment method.

---

### 2.10 Rating a Vendor

**URL:** `/my-bookings/:bookingId`  
**Requires:** Booking status = `completed`

**Purpose:** Leave a star rating and optional comment for the vendor after a completed booking.

**Steps:**
1. Go to the completed booking detail page.
2. Click **"Rate vendor"**.
3. Enter a rating from **1 to 5**.
4. Optionally add a review comment.
5. Submit.

---

### 2.11 Opening a Dispute

**URL:** `/my-bookings/:bookingId`  
**Requires:** Booking status = `confirmed` or `completed`

**Purpose:** Escalate a problem with a booking (e.g., items not delivered, wrong items, damage) to the platform admin for resolution.

**Steps:**
1. Go to the booking detail page.
2. Click **"Open dispute"**.
3. Describe the reason for the dispute.
4. Submit — an admin will review and reach out.

**Dispute Outcomes (decided by admin):**
- Full refund to customer
- Payment released to vendor
- Partial refund

**Adding Evidence:**
- After opening a dispute, you can upload photos or documents as evidence from the booking detail page.

---

### 2.12 Downloading Documents (Contract & Receipt)

**URL:** `/my-bookings/:bookingId`

**Purpose:** Download official booking documents for your records.

**Documents available:**
- **Contract PDF** — the formal rental agreement between you and the vendor.
- **Receipt PDF** — official receipt for the payment made.

**Steps:**
1. Open the booking detail page.
2. Click **"Contract PDF"** or **"Receipt PDF"**.
3. The document is generated (if not yet created) and downloaded automatically.

---

### 2.13 Chatting with a Vendor

**URL:** `/my-bookings/:bookingId`

**Purpose:** Communicate directly with the vendor about your booking.

**How to use:**
- A **chat widget** is embedded at the top of the booking detail page.
- Messages are private per booking. Only you, the vendor, and admins can see the conversation.
- Chat history is preserved as part of the booking record.

> **Note:** All messages are logged and may be reviewed by admins for safety and dispute resolution.

---

### 2.14 Applying to Become a Vendor

**URL:** `/become-vendor`  
**Requires:** Login as a customer (not already a vendor)

**Purpose:** Register to become a vendor on the platform to list your own equipment for rent.

**Pre-conditions:**
- You must be logged in as a customer.
- Vendor registration must be enabled (admin-controlled platform setting).
- If OTP verification is required, your email must be verifiable.

**Application Form Sections:**

1. **Vendor Type** — choose between:
   - `Registered Business` — requires business registration details (DTI/SEC, registration number, optional BIR TIN).
   - `Individual Owner` — personal vendor without formal business registration.

2. **Owner / Personal Info** — your full legal name and government ID number.

3. **Store Web Address** — your custom subdomain (e.g., `my-shop.rentalbasic.com`). Auto-suggested from your name; checked for availability in real time.

4. **Business Address** — your physical business/service location.

5. **Location** — pick your exact coordinates on a map (used for distance calculations and vendor discovery).

6. **Contact Number** — your business phone number.

7. **Payout Method** — bank or e-wallet name, account name, and account number (for receiving payments).

8. **OTP Verification** *(if required by admin)*:
   - Click **"Send Email OTP"** — an OTP code is sent to your registered email.
   - Enter the OTP and click **"Verify OTP"**.

9. **File Uploads:**
   - Government ID photo (required)
   - Selfie photo (required)
   - Mayor's Permit (optional)
   - Barangay Permit (optional)
   - Business Logo (optional)

10. **Optional Fields** — social media link and business description.

**After Submission:**
- Your application is submitted with `pending` status.
- An admin reviews your KYC documents and either **approves** or **declines** your application.
- You will see the review status and any notes on the same page.
- Upon approval, your account role is upgraded from `customer` to `vendor`.

---

## 3. Vendor Side

The vendor portal is accessed at **`https://vendor.rentalbasic.com`**.

---

### 3.1 Logging In to the Vendor Portal

**URL:** `/login` on `vendor.rentalbasic.com`

**Purpose:** Authenticate as a vendor or admin.

**Steps:**
1. Visit `https://vendor.rentalbasic.com/login`.
2. Click **"Continue with Google"** — same Google OAuth flow as the customer app.
3. If your account has the `vendor` role, you are redirected to the vendor dashboard at `/vendor`.
4. If your account has the `admin` role, you are redirected to the admin dashboard at `/admin`.

---

### 3.2 Vendor Dashboard Overview

**URL:** `/vendor`

**Purpose:** At-a-glance summary of your shop's activity, inventory, and any outstanding issues.

**Alerts (shown at the top):**
- **Warning alert** (red) — if you have active warnings from the admin. 3 warnings = 7-day suspension.
- **Overdue payment** (orange) — if you have any platform billing records past due.

**Summary Stats:**
| Card | What It Shows |
|------|---------------|
| **Today's Active Bookings** | Confirmed bookings where today falls within the rental period |
| **Total Bookings** | Lifetime booking count |
| **Warnings** | Your current warning count (out of 3) |

**Shop Info:**
- Your public storefront URL (click to view it as customers see it).
- Your business address.

**Equipment Breakdown:**
- Visual grid of all your inventory with color-coded squares showing available vs. reserved units per item type.

---

### 3.3 Managing Your Shop Profile

**URL:** `/vendor/shop`

**Purpose:** Update your public-facing shop information and payout details.

**Editable Fields:**

| Field | Description |
|-------|-------------|
| **Business Name** | Your shop's display name |
| **Address** | Physical address shown on your shop page |
| **Phone Number** | Contact number shown to customers |
| **Payout Method** | Bank or e-wallet name (e.g., GCash, BDO) |
| **Payout Account Name** | Account holder name |
| **Payout Account Number** | Account number (leave blank to keep existing; existing is masked) |
| **Description** | About your shop (shown on public storefront) |
| **Location** | Click on the Leaflet map to pin your exact coordinates, or click "Use Current Location" for GPS |

**Your Shop URL:**
- After saving, your public storefront is at `{slug}.rentalbasic.com` — shown as a clickable link.

**Saving:** Click **"Save Changes"**. Changes are applied immediately.

---

### 3.4 Managing Inventory

**URL:** `/vendor/inventory`

**Purpose:** Add, edit, and remove the equipment items you offer for rent.

**Inventory Card Grid:**  
Each inventory record shows: item image, item type, brand, color, total/available quantity, rate/day, gallery count, and condition.

**Adding an Item:**
1. Click **"Add Item"**.
2. Search and select the **item type** (e.g., "Folding Chairs", "Sound System") from the searchable dropdown.
3. Optionally select the **brand**.
4. Enter the **quantity** (how many units you own).
5. Optionally set a **custom daily rate** (overrides the platform default; leave blank to use default).
6. Optionally specify a **color** (if you maintain per-color stock separately).
7. Optionally add a **condition** note (e.g., "Good condition, minor scratches").
8. Click **"Add Item"**.

**Editing an Item:**
1. Click **"Edit"** on any inventory card.
2. Modify any fields.
3. Click **"Save Item"**.

**Removing an Item:**
1. Click **"Remove"** on an inventory card.
2. The item is deleted immediately (no confirmation prompt — use caution).

> **Note:** An item type must be enabled by the admin before it can be added to inventory. Disabled item types are hidden from the picker.

---

### 3.5 Managing Inventory Photo Gallery

**URL:** `/vendor/inventory` (via "Manage Photos" button)

**Purpose:** Upload up to 10 photos per inventory item for display on your public shop page.

**Steps:**
1. Click **"Manage Photos"** on an inventory item card.
2. The gallery modal shows current photos and a counter (e.g., "3 / 10").
3. Click **"Upload Photos"** and select one or more image files from your device.
4. Uploaded photos appear in the gallery grid immediately.
5. To remove a photo, click the **"Remove"** button on the photo thumbnail.

> **Note:** A maximum of 10 gallery photos per item is enforced. Additional uploads beyond 10 are rejected.

---

### 3.6 Setting Up Delivery Vehicle List

**URL:** `/vendor/vehicles`

**Purpose:** List the vehicles you use for deliveries. This information is shown to customers on your shop page to help them trust your delivery capability.

**Adding a Vehicle:**
1. Select the **vehicle type** (Van, Truck, Pickup Truck, Car, Motorcycle, Bicycle, Walking Service, Other).
2. Add an optional **description** (e.g., "2-ton capacity", "covered van").
3. Click **"+ Add Vehicle"**.

**Editing / Deleting:** Use the Edit and Delete buttons in the vehicle table. Changes update your profile immediately.

---

### 3.7 Setting Up Pricing — Distance Tiers

**URL:** `/vendor/pricing/distance`

**Purpose:** Configure how much you charge for delivery based on how far the customer's location is from your shop.

**How it works:**
- You define distance tiers (in km). Each tier has a maximum distance and a delivery charge.
- When a customer requests a booking, the platform calculates the distance and picks the matching tier to quote them.

**Adding a Distance Tier:**
1. Enter the **distance in km** (e.g., `10` means "up to 10 km").
2. Enter the **delivery charge** in ₱.
3. Click **"+ Add Tier"**.

**Example Setup:**

| Up to (km) | Delivery Charge |
|------------|-----------------|
| 5 | ₱0 (free) |
| 15 | ₱150 |
| 30 | ₱350 |
| 50 | ₱600 |

**Editing / Deleting:** Use the Edit/Delete buttons per row. Changes take effect for new bookings immediately.

---

### 3.8 Setting Up Pricing — Helper Tiers

**URL:** `/vendor/pricing/helpers`

**Purpose:** Configure the additional charge for providing helpers during delivery. Customers can request helpers in the booking form.

**Adding a Helper Tier:**
1. Enter the **number of helpers** (e.g., `1`, `2`, `3`).
2. Enter the **helper charge** in ₱.
3. Click **"+ Add Tier"**.

**Example Setup:**

| Helpers | Helper Charge |
|---------|--------------|
| 1 | ₱500 |
| 2 | ₱900 |
| 3 | ₱1,300 |

> **Note:** Helper pricing is optional. If you do not set any helper tiers, customers cannot request helpers from your shop.

---

### 3.9 Viewing Bookings (List View)

**URL:** `/vendor/bookings`

**Purpose:** See all bookings for your shop in a filterable table with quick status actions.

**Table Columns:** Customer | Dates | Items count | Amount | Status | Actions

**Filters:**
- **Search** — by customer name or email.
- **Status** — All / Pending / Confirmed / Completed / Cancelled.
- **Date range** — From / To (by booking start/end date).

**Quick Actions (per row):**

| Action | When Available | What It Does |
|--------|---------------|--------------|
| **View** | Always | Opens the full booking detail page |
| **Confirm** | Pending only | Accepts the booking (customer is notified) |
| **Cancel** | Pending only | Cancels the booking and triggers a full refund to the customer |
| **Complete** | Confirmed only | Marks the booking as completed |

---

### 3.10 Viewing Bookings (Calendar View)

**URL:** `/vendor/bookings/calendar`

**Purpose:** Visualize your bookings across Month, Week, Day, or Agenda views.

**Features:**
- Events span the booking start-to-end date range.
- Event title shows: `{Customer Name} • {Total Amount}`.
- Color coding: Pending = amber, Confirmed = blue, Completed = green, Cancelled = red (faded).
- Hover over an event for a tooltip with full details.
- Click an event to open the booking detail page.
- Same filters as the list view (search, status, date range).

---

### 3.11 Booking Detail — Actions & Documents

**URL:** `/vendor/bookings/:bookingId`

**Purpose:** Full view of a single booking with all details, actions, and history.

**Information displayed:**
- Customer name and email
- Booking dates and delivery address (with coordinates and "Open in Maps" link)
- Items requested: type, brand, quantity, rate, subtotal
- Pricing breakdown: items, delivery charge, service charge, total
- Special instructions (highlighted in yellow if present)
- Current booking status
- All chat messages, reviews, and disputes linked to this booking

**Vendor Actions:**

| Action | When Available | What It Does |
|--------|---------------|--------------|
| **Confirm** | Pending | Accepts the booking |
| **Cancel** | Pending | Cancels and refunds (100%) customer |
| **Complete** | Confirmed | Marks job as done |
| **Upload Proof** | Any active | Upload a delivery proof photo/URL |
| **Write Review** | After booking | Rate the customer (1–5 stars + comment) |
| **Open Dispute** | Active booking | Open a dispute for admin resolution |
| **Contract PDF** | Always | Download the vendor-addressed contract |
| **Receipt PDF** | Always | Download the vendor-addressed receipt |

---

### 3.12 Chatting with a Customer

**Purpose:** Communicate with a customer about a specific booking.

**How to use:**
- A chat widget is shown at the top of every booking detail page.
- It is pre-opened by default.
- Messages are booking-scoped (only this booking's conversation).
- Messages are reviewed by admins for safety; flagged messages are noted.

---

### 3.13 Uploading Delivery Proof

**URL:** `/vendor/bookings/:bookingId` → "Upload Proof" button

**Purpose:** Provide photographic or documentary evidence of successful delivery for your records and dispute protection.

**Steps:**
1. Click **"Upload Proof"**.
2. Enter the photo URL or upload the image.
3. The proof is attached to the booking and visible to both the customer and admin.

---

### 3.14 Writing a Review for a Customer

**URL:** `/vendor/bookings/:bookingId` → "Write Review" button

**Purpose:** Rate and review the customer after a booking.

**Steps:**
1. Click **"Write Review"**.
2. Enter a rating from **1 to 5**.
3. Optionally add a comment.
4. Submit.

---

### 3.15 Opening a Dispute (Vendor side)

**URL:** `/vendor/bookings/:bookingId` → "Open Dispute" button

**Purpose:** Escalate an unresolved issue with a booking to platform admin.

**Steps:**
1. Click **"Open Dispute"**.
2. Enter the reason for the dispute.
3. Submit — admin will review and decide the outcome.

You can add supporting evidence (photos, documents) after the dispute is open.

---

### 3.16 Viewing Payments & Payouts

**URL:** `/vendor/payments`

**Purpose:** Track your platform billing records and payout queue.

**Payments Table (what you owe the platform):**

| Column | Description |
|--------|-------------|
| Period | Billing period |
| Amount | Amount billed |
| Due Date | Payment deadline |
| Status | Pending / Paid / Overdue |
| Paid At | Date paid |

> If any payment is **Overdue**, a red banner appears at the top. Contact admin to resolve.

**Payouts Table (what the platform owes you):**

| Column | Description |
|--------|-------------|
| Booking | Short booking reference |
| Net Amount | Your payout after platform fee |
| Outstanding | Any outstanding balance deducted |
| Release On | When payout is released ("Immediate" or a date) |
| Status | Held / Ready / Released / Refunded / Disputed |

> **Payout Hold Policy:** For new vendors (fewer than 5 successfully completed orders), payouts are held for 3 days after customer confirms delivery. After 5 completed orders, payouts are released immediately.

---

## 4. Admin Side

The admin portal is accessed at **`https://vendor.rentalbasic.com`** after signing in with an admin-role account. All admin pages are under `/admin`.

---

### 4.1 Logging In to the Admin Portal

Same login process as the vendor portal (Google OAuth). An account with the `admin` role is required.

After login, the admin is redirected to `/admin`.

---

### 4.2 Admin Dashboard Overview

**URL:** `/admin`

**Purpose:** Quick at-a-glance platform health summary.

**Stats shown:**

| Metric | Description |
|--------|-------------|
| Total Vendors | Total number of vendors on the platform |
| Active Vendors | Vendors with `isActive = true` |
| Total Payments | Total number of billing records |
| Overdue Payments | Billing records past their due date |

---

### 4.3 Managing Customers

**URL:** `/admin/customers`

**Purpose:** View all customer accounts and control their access.

**Table Columns:** Name | Email | Status | Actions

**Filters:**
- Search by name or email.
- Filter by account status (All / Active / Inactive).

**Actions per customer:**

| Action | Description |
|--------|-------------|
| **Activate** | Re-enables a deactivated customer account |
| **Deactivate** | Disables a customer account (prevents login and booking) |
| **Impersonate** | Logs into the platform as this customer for support/debugging (grayed out if inactive) |

---

### 4.4 Managing Vendors (Active List)

**URL:** `/admin/vendors`

**Purpose:** Full moderation control over all active vendors on the platform.

**Filters:**
- Search (business name, owner name, email, phone, slug).
- Activity: All / Active / Inactive / Suspended.
- Verification: All / Verified / Unverified / Rejected.
- Risk: All / Flagged / Clean.

**Table Columns:** Business | Owner | Status | Verification | Warnings | Actions

**Admin Actions:**

| Action | Description |
|--------|-------------|
| **Verify** | Marks vendor as platform-verified (shows verification badge on public shop) |
| **Unverify** | Removes verification badge |
| **Warn** | Issues a warning to the vendor (+1 to their warning count; 3 warnings triggers 7-day suspension) |
| **Clear Warnings** | Resets the vendor's warning count to 0 (confirmation required) |
| **Flag as Suspicious** | Marks vendor as suspicious risk with a reason (prompts for reason) |
| **Unflag** | Removes the suspicious flag |
| **Suspend** | Suspends the vendor until a specified date with a required reason |
| **Activate / Deactivate** | Enables or disables the vendor's listing from discovery and booking |
| **Impersonate** | Logs in as the vendor's linked user account |
| **Hard Delete** | Permanently removes the vendor, all bookings, documents, payouts, and demotes the user role back to customer. Requires typing `DELETE` to confirm. ⚠️ **Irreversible** |
| **Create Vendor** | Creates a new vendor account manually (for off-platform onboarding) |

**Quick navigation:**
- Click **"Applicants"** (with pending count badge) to go to the KYC review queue.

---

### 4.5 Reviewing Vendor Applicants (KYC)

**URL:** `/admin/vendors/applicants`  
**Individual review:** `/admin/vendors/applicants/:vendorId`

**Purpose:** Review and approve or reject incoming vendor registration applications (KYC process).

**Applicants List** shows each pending applicant with:
- Business name, owner name, email, address.
- Number of uploaded KYC documents.
- Duplicate risk score (system-computed similarity to existing vendors).
- Registration and KYC status badges.

**Applicant Review Page:**

1. **Applicant Info Card** — business type, owner, email, address, phone, vendor type, duplicate risk score.
2. **Prior Rejection** — if this applicant was previously rejected, the rejection reason is shown.
3. **Documents Grid** — all uploaded documents (government ID, selfie, permits, logo) displayed as images. Non-image documents show a "preview unavailable" card. Click to open in a new tab.
4. **Decision Panel:**
   - **Notes textarea** — admin can add review notes.
   - **"Approve"** button — approves the application:
     - Vendor status changes to `approved` / `verified`.
     - User account is upgraded to `vendor` role.
     - Pricing config is auto-provisioned (delivery tiers, helper tiers).
     - PayMongo merchant account is provisioned (if enabled).
     - Approval email is sent to the vendor.
   - **"Decline"** button — rejects the application (requires notes). Rejection reason is visible to the applicant.

> A read-only message is shown for applicants that already have a final decision (approved or declined).

---

### 4.6 Managing Item Types (Equipment Categories)

**URL:** `/admin/item-types`

**Purpose:** Define and manage the master list of equipment categories that vendors can list in their inventory.

**Item Type Card shows:** image, name, description, default rate/day, active/disabled status.

**Adding an Item Type:**
1. Click **"Add Item Type"**.
2. Fill in: Name, Description, Default Rate Per Day, Active checkbox, and optionally upload a thumbnail image.
3. Save.

**Editing:** Click **"Edit"** on any card → modify fields → Save.

**Enabling / Disabling:**
- Toggle a type to **disabled** to prevent vendors from adding new inventory of this type.
- Already-existing inventory items of a disabled type remain unaffected.
- The public `GET /item-types` endpoint returns only active types. Disabling a type removes it from customer search filters.

**Deleting:** Click **"Delete"** on any card (confirmation prompt required).

---

### 4.7 Managing Brands

**URL:** `/admin/brands`

**Purpose:** Manage product brands associated with item types. Vendors use brands to label their specific inventory (e.g., "Monobloc" under Plastic Chairs, "Yamaha" under Sound Systems).

**Table:** Brand name | Associated Item Type | Actions (Edit, Delete)

**Adding a Brand:**
1. Click **"Add Brand"**.
2. Enter brand name, optional description, and select the associated item type.
3. Save.

**Editing / Deleting:** Use Edit and Delete buttons in the table.

---

### 4.8 Payments Overview & Billing

**URL:** `/admin/payments`

**Purpose:** Platform-wide financial management across four tabs.

---

**Tab: Overview — Key Performance Indicators**

| Metric | Description |
|--------|-------------|
| Platform Accrued Earnings | Total platform fees collected |
| Gross Collected | Total customer payments collected |
| Vendor Pending/Ready/Released Totals | Stage-by-stage payout pipeline |
| Reversed Totals | Refunded amounts |
| Ready/Released Counts | Number of payouts at each stage |

---

**Tab: Vendor Earnings**

Breakdown per vendor:
- Gross collected from their bookings
- Platform fee deducted
- Pending / ready / released / reversed payout balances
- Number of booking records

---

**Tab: Billing Records**

Lists all platform billing records (fees charged to vendors):

| Column | Description |
|--------|-------------|
| Vendor | Vendor name |
| Amount | Billing amount |
| Due Date | Payment deadline |
| Status | Pending / Paid / Overdue |

**Actions:**
- **"Add Payment"** — create a new billing record for a vendor (enter vendor, amount, due date, optional period).
- **Mark as Overdue** — moves a pending record to `overdue` status.
- **Mark as Paid** — records payment (enter transaction reference).

---

**Tab: Payout Queue**

Lists all vendor payout records awaiting release:

| Column | Description |
|--------|-------------|
| Vendor | Vendor name |
| Booking | Booking reference |
| Gross / Fee / Net | Amounts before and after platform fee |
| Outstanding | Any balance deductions |
| Release On | Scheduled release date |
| Payout Destination | Bank/e-wallet and account |
| Status | Pending / Held / Ready / Released / Disputed |

**Action:** **"Release"** — manually releases a payout with an optional admin note (only available when status is `ready`).

---

### 4.9 Releasing Vendor Payouts

**URL:** `/admin/payments` → Payout Queue tab

**Purpose:** Disburse earned money to vendors after bookings are confirmed delivered.

**Process:**
1. Customer confirms delivery → payout status becomes `ready`.
2. New vendors (< 5 completed orders) have a 3-day hold before status becomes `ready`.
3. Admin reviews the payout queue.
4. Click **"Release"** on payouts with status `ready`.
5. Optionally add a note (e.g., transfer reference number).
6. Payout status changes to `released`.

> **Manual step:** The platform tracks payout records, but actual bank/GCash transfers must be made manually outside the system. The "Release" action records that the transfer has been initiated/completed.

---

### 4.10 Managing Disputes

**URL:** `/admin/disputes`

**Purpose:** Review and resolve booking disputes opened by customers or vendors.

**Summary Cards:** Total disputes | Open | Under Review

**Filters:** Status — All / Open / Under Review / Resolved / Rejected

**Dispute Table Columns:** Created date | Booking ID | Opened by | Reason | Status | Outcome

**Resolving a Dispute:**
1. Click **"Resolve"** on an open or under-review dispute.
2. The modal shows booking context and current dispute details.
3. Select an **outcome**:
   - **Release to vendor** — payment goes to the vendor
   - **Refund customer** — enter refund amount; customer is refunded
   - **Partial refund** — enter partial amount
4. Add a **resolution note** (required).
5. Click **"Save"** — dispute status changes to `resolved`.

---

### 4.11 Fraud Alerts & Risk Monitoring

**URL:** `/admin/fraud-alerts`

**Purpose:** Monitor and triage system-generated fraud and risk alerts.

**Summary Cards:** Total | Open | Under Review | High Priority

**Filters:**
- **Status:** All / Open / Under Review / Resolved / Dismissed
- **Type:** booking_risk, off_platform_message, vendor_kyc, dispute, low_rating_vendor, ip_reuse, cancellation_pattern, unusual_booking_frequency

**Alert Table Columns:** Date | Severity | Type | Title | Description | Status | Actions

**Actions:**

| Action | Description |
|--------|-------------|
| **Review** | Moves alert from `open` to `under_review` |
| **Resolve** | Closes alert as resolved; optionally add a note |
| **Dismiss** | Dismisses alert as a false positive; optionally add a note |

**Alert Types Explained:**

| Type | Triggered When |
|------|---------------|
| `booking_risk` | Booking shows unusual payment or behavior patterns |
| `off_platform_message` | Chat message detected attempting to move communication off-platform |
| `vendor_kyc` | KYC submission has risk signals (duplicate ID, unusual match) |
| `dispute` | Dispute opened on a booking |
| `low_rating_vendor` | Vendor's average rating drops below threshold |
| `ip_reuse` | Multiple accounts registering from the same IP address |
| `cancellation_pattern` | Unusual rate of booking cancellations by a user |
| `unusual_booking_frequency` | Customer or vendor booking at an abnormal rate |

---

### 4.12 Platform Feature Flags & Settings

**URL:** `/admin/settings/feature-flags`

**Purpose:** Control platform-wide operational flags, commission rates, deposit rules, and payout policies.

**Section: Launch Controls**

| Setting | Type | Description |
|---------|------|-------------|
| **No-Commission Mode** | Toggle | When ON, platform fee is 0% until the configured end date |
| **Allow Orders Without Payment** | Toggle | When ON, customers can create bookings without immediate payment |
| **Maintenance Mode** | Toggle | When ON, the customer app shows a maintenance screen to all visitors |
| **No-Commission End Date** | Date | Sets when the no-commission window ends (leave blank = indefinite) |
| **Default Platform Commission Rate** | % | Percentage taken from each booking total (0–100%) |
| **Default Deposit Percent** | % | Deposit percentage collected upfront |

**Section: Vendor Risk Controls**

| Setting | Description |
|---------|-------------|
| **New Vendor Order Threshold** | Number of completed orders before a vendor is treated as "established" (default: 5) |
| **New Vendor Max Listings** | Maximum active inventory listings for new vendors |
| **Flagged Vendor Max Listings** | Maximum active listings for vendors flagged as suspicious |
| **Payout Delay for New Vendors** | Days payouts are held after delivery for new vendors (default: 3) |

**Section: Cancellation Policy**

| Setting | Description |
|---------|-------------|
| **Full Refund Minimum Days** | Days before start for 100% refund (default: 3) |
| **Half Refund Minimum Days** | Days before start for partial refund (default: 1) |
| **Half Refund Percent** | Refund percentage for partial refund window (default: 50%) |

**Saving:** Changes must be explicitly saved. A notification is broadcast to the staff app when settings are updated.

---

### 4.13 KYC Onboarding Settings

**URL:** `/admin/settings/kyc`

**Purpose:** Control vendor registration availability and OTP requirements.

| Setting | Type | Description |
|---------|------|-------------|
| **Vendor Registration Enabled** | Checkbox | When unchecked, no new vendor applications can be submitted |
| **Require OTP Before Registration** | Checkbox | When checked, customers must verify their email via OTP before submitting a vendor application |

---

## 5. Key Concepts & Glossary

| Term | Definition |
|------|-----------|
| **KYC** | Know Your Customer — the document verification process vendors go through to be approved |
| **Escrow** | Payment held by the platform until the customer confirms delivery; then released to the vendor |
| **Commission / Platform Fee** | Percentage of the booking total kept by the platform |
| **Payout** | The vendor's net earnings from a completed booking after platform fee deduction |
| **Delivery Charge** | Fee charged to the customer for delivering equipment to their event location |
| **Service Charge** | Fee for helpers and other add-on services |
| **Slug** | The vendor's unique URL identifier (e.g., `my-shop` in `my-shop.rentalbasic.com`) |
| **Verification Badge** | Shown on verified vendors' shop pages; earned after admin review and approval |
| **Warning** | Admin-issued infraction. 3 warnings = 7-day automatic suspension |
| **Impersonate** | Admin/staff ability to log in as another user for troubleshooting/support |
| **Hard Delete** | Permanent, irreversible removal of a vendor and all related data |
| **Fraud Alert** | System-generated risk flag requiring admin review |
| **Dispute** | Formal escalation of a booking issue to platform admin for resolution |
| **Delivery Proof** | Photo or document uploaded by vendor to confirm equipment was successfully delivered |
| **Split Payment** | Automatic splitting of payment at checkout: vendor's cut goes directly to the vendor's PayMongo account, platform fee stays with the platform |
| **PayMongo** | The payment gateway used for online checkout, refunds, and split payments |

---

## 6. Booking Status Reference

| Status | Meaning | Who Can Set It |
|--------|---------|---------------|
| **pending** | Booking created, awaiting vendor confirmation | System (on create) |
| **confirmed** | Vendor accepted the booking | Vendor / Admin |
| **completed** | Booking fully fulfilled | Vendor / Admin |
| **cancelled** | Booking was cancelled | Customer / Vendor / Admin |

---

## 7. Payment Status Reference

| Status | Meaning |
|--------|---------|
| **pending** | Awaiting payment action |
| **unpaid** | No payment has been made |
| **checkout_pending** | Checkout session created, customer on PayMongo page |
| **paid** | Payment received and verified |
| **held** | Payment in escrow (delivery not yet confirmed) |
| **completed** | Payment fully processed; escrow released to vendor |
| **failed** | Payment failed or was not completed |
| **refunded** | Full or partial refund issued |
| **disputed** | Booking under dispute; funds frozen pending resolution |

---

## 8. Cancellation & Refund Policy

### Customer-Initiated Cancellation

| Timing | Refund |
|--------|--------|
| Cancelled **3 or more days** before start date | **100% refund** |
| Cancelled **1–2 days** before start date | **50% refund** (configurable by admin) |
| Cancelled **same day** or after start date | **No refund (0%)** |

### Vendor or Admin-Initiated Cancellation

- Always results in a **100% full refund** to the customer, regardless of timing.

### Refund Processing

- Refunds are issued through PayMongo back to the customer's original payment method.
- Refund amounts reflect the cancellation policy applied at the time of cancellation.
- Dispute resolutions may result in full, partial, or no refund at admin discretion.

---

*End of User Manual*
