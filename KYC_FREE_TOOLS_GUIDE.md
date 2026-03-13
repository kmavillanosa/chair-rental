# KYC System — Complete Free Tools & Integration Guide

All services listed here have **generous free tiers** or are **fully open-source**. No credit card required for most.

---

## 1. SMS/OTP Services (Free)

### **Option A: Twilio (Recommended — Free Trial)**
- **Free credits**: $15.50/month (enough for ~150 SMS in PH)
- **No credit card required for trial**
- Highly reliable, widely used

**Setup:**
```bash
npm install twilio
```

**Integration in `vendors.service.ts`:**
```typescript
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async requestPhoneOtp(phone: string, countryCode = '+63') {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // For free trial, only pre-verified numbers work
  try {
    await twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `${countryCode}${phone.replace(/^0/, '')}`,
      body: `Your RentalBasic verification code is: ${otp}. Valid for 10 minutes.`
    });
    
    // Store OTP in DB as you do now
    const challenge = this.phoneOtpRepo.create({
      phoneNumber: phone,
      otpCode: otp,
      expiresAt: new Date(Date.now() + 10 * 60000),
    });
    return this.phoneOtpRepo.save(challenge);
  } catch (e) {
    // Fallback: log OTP in dev mode
    console.log(`[OTP for ${phone}]: ${otp}`);
    // Still save to DB
    const challenge = this.phoneOtpRepo.create({/*...*/});
    return this.phoneOtpRepo.save(challenge);
  }
}
```

**Env vars:**
```
TWILIO_ACCOUNT_SID=xxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

---

### **Option B: AWS SNS (Free Tier)**
- **Free tier**: 100 SMS/month (first 12 months)
- **After**: ₱0.50/SMS in Thailand region (PH not listed but can route via Singapore)

```bash
npm install aws-sdk
```

**Integration:**
```typescript
import AWS from 'aws-sdk';

const sns = new AWS.SNS({
  region: 'ap-southeast-1',
  credentials: new AWS.Credentials({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  })
});

async requestPhoneOtp(phone: string) {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  try {
    await sns.publish({
      Message: `Your RentalBasic verification code: ${otp}`,
      PhoneNumber: `+63${phone.replace(/^0/, '')}`,
    }).promise();
  } catch (e) {
    console.log(`[OTP Fallback for ${phone}]: ${otp}`);
  }
  
  // Save OTP...
  const challenge = this.phoneOtpRepo.create({/*...*/});
  return this.phoneOtpRepo.save(challenge);
}
```

---

### **Option C: Firebase Cloud Messaging (Completely Free)**
- **Phone authentication**: Free tier
- No SMS costs (works with Firebase Auth)

```bash
npm install firebase-admin
```

**Integration:**
```typescript
import * as admin from 'firebase-admin';

const firebaseApp = admin.initializeApp();
const auth = admin.auth(firebaseApp);

// Send OTP via Firebase Auth (free)
async requestPhoneOtp(phone: string) {
  try {
    const sessionInfo = await auth.createSessionCookie(
      await this.createCustomToken(phone),
      { expiresIn: 60 * 60 * 24 }
    );
    
    // For Firebase Phone Auth:
    const link = await auth.generateSignInWithEmailLink(
      phone + '@temp.rentalbasic.local',
      { url: 'https://yourapp.com/phone-verify' }
    );
    
    console.log(`[Firebase OTP Link]: ${link}`);
    // Or: Send link via Nodemailer instead
    
  } catch (e) {
    console.error('Firebase OTP error:', e);
  }
}
```

**Status**: Recommended if you want **zero costs** (Firebase free tier includes auth).

---

## 2. Face Recognition / Selfie Verification (Free & Open-Source)

### **Option A: face-api.js (Client-side, Free)**
- **Works in browser** — no server cost
- Uses TensorFlow.js under the hood
- Detects face, can compare selfie to ID photo

**Install:**
```bash
npm install face-api.js @tensorflow/tfjs @tensorflow/tfjs-core
```

**Frontend Integration (BecomeVendor.tsx):**
```typescript
import * as faceapi from 'face-api.js';

const LoadModels = async () => {
  const MODEL_URL = '/models'; // Download from https://github.com/vladmandic/face-api/tree/master/model
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
};

const CaptureSelfie = async (videoElement: HTMLVideoElement) => {
  const detection = await faceapi.detectSingleFace(
    videoElement,
    new faceapi.TinyFaceDetectorOptions()
  ).withFaceLandmarks().withFaceDescriptors();
  
  if (!detection) {
    toast.error('No face detected. Please try again.');
    return null;
  }
  
  // Get canvas image
  const canvas = faceapi.createCanvasFromMedia(videoElement);
  const ctx = canvas.getContext('2d');
  return {
    canvasDataUrl: canvas.toDataURL('image/jpeg'),
    faceDescriptor: detection.descriptor, // Can send to backend for comparison
  };
};

// Later when uploading gov ID + selfie:
const CompareIdAndSelfie = async (
  govIdImage: HTMLImageElement,
  selfieImage: HTMLImageElement
) => {
  const idDetection = await faceapi
    .detectSingleFace(govIdImage)
    .withFaceLandmarks()
    .withFaceDescriptors();
    
  const selfieDetection = await faceapi
    .detectSingleFace(selfieImage)
    .withFaceLandmarks()
    .withFaceDescriptors();
    
  if (!idDetection || !selfieDetection) return null;
  
  // Compare face descriptors (0 = identical, 1 = completely different)
  const distance = faceapi.euclideanDistance(
    idDetection.descriptor,
    selfieDetection.descriptor
  );
  
  return {
    matchScore: Math.max(0, 1 - distance),  // 0-1 scale
    isLikelyMatch: distance < 0.6,          // Threshold
    distance,
  };
};
```

**Backend (Optional Storage):**
```typescript
async submitFaceVerification(
  vendorId: string,
  faceDescriptorJson: string, // Array of 128 numbers, stringified
  matchScore: number,
) {
  const vendor = await this.vendorRepo.findOne(vendorId);
  
  if (matchScore < 0.6) {
    vendor.faceMatchStatus = 'rejected';
    vendor.faceMatchScore = matchScore;
  } else {
    vendor.faceMatchStatus = 'approved';
    vendor.faceMatchScore = matchScore;
  }
  
  vendor.faceDescriptorJson = faceDescriptorJson; // For future comparisons
  
  await this.vendorRepo.save(vendor);
  return { status: 'stored', matchScore };
}
```

**Model Download:**
```bash
# Download models from face-api repo and place in public/models/
# https://github.com/vladmandic/face-api/tree/master/model
```

---

### **Option B: tracking.js (Lightweight Alternative)**
- **Smaller than face-api.js**
- Works client-side in any browser
- No backend costs

```bash
npm install tracking tracking-face-detector
```

```typescript
import * as tracking from 'tracking';
import 'tracking/data/face';

const DetectFace = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  const tracker = new tracking.ObjectTracker('face');
  tracker.setInitialScale(4);
  tracker.setStepSize(2);
  tracker.setEdgesDensity(0.1);
  
  tracking.track(canvas, tracker);
  
  tracker.on('track', function(event) {
    if (event.data.length === 0) {
      console.log('No face detected');
      return;
    }
    
    // Faces detected
    event.data.forEach(function(rect) {
      console.log(`Face at (${rect.x}, ${rect.y}) size: ${rect.width}x${rect.height}`);
    });
  });
};
```

---

## 3. Document Upload & Storage (Free & Self-Hosted)

### **Option A: Local Disk Storage (Existing in Your Code)**
✅ **You already have this!** Multer saves to `/uploads/` directory.

**Keep as-is:**
```typescript
// vendors.controller.ts already uses this
@Post('my/documents')
@UseInterceptors(
  FileInterceptor('document', {
    storage: diskStorage({
      destination: (req, file, cb) => cb(null, './uploads/vendor-docs'),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
    fileFilter: (req, file, cb) => {
      const allowed = /\.(jpg|jpeg|png|pdf)$/i;
      cb(null, allowed.test(file.originalname));
    },
  })
)
async uploadDocument(
  @Req() req: any,
  @UploadedFile() file: Express.Multer.File
) {
  // Save file path to DB
  const doc = this.documentRepo.create({
    vendorId: req.user.vendorId,
    fileUrl: `/uploads/vendor-docs/${file.filename}`,
    documentType: req.body.documentType,
  });
  return this.documentRepo.save(doc);
}
```

**Pros:**
- ✅ Zero cost
- ✅ Full control
- ✅ No vendor lock-in

**Cons:**
- Need backup strategy
- Single server only (use S3-compatible MinIO for multi-server)

---

### **Option B: MinIO (Self-Hosted S3-Compatible, Free)**
- **Docker-based object storage**
- Looks like AWS S3 but runs on your server
- Perfect for multi-server setups

**Setup with Docker:**
```yaml
# docker-compose.yml addition
minio:
  image: minio/minio:latest
  ports:
    - "9000:9000"
    - "9001:9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  volumes:
    - minio_data:/data
  command: minio server /data --console-address ":9001"

volumes:
  minio_data:
```

**Backend Integration:**
```bash
npm install aws-sdk
```

```typescript
import AWS from 'aws-sdk';

const s3 = new AWS.S3({
  endpoint: 'http://minio:9000',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
});

async uploadDocument(
  @Req() req: any,
  @UploadedFile() file: Express.Multer.File
) {
  const bucketName = 'vendor-documents';
  
  // Ensure bucket exists
  await s3.createBucket({ Bucket: bucketName }).promise().catch(() => {});
  
  const params = {
    Bucket: bucketName,
    Key: `${req.user.vendorId}/${Date.now()}-${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  
  const result = await s3.upload(params).promise();
  
  const doc = this.documentRepo.create({
    vendorId: req.user.vendorId,
    fileUrl: `http://minio:9000/${bucketName}/${result.Key}`,
    documentType: req.body.documentType,
  });
  
  return this.documentRepo.save(doc);
}
```

---

### **Option C: Firebase Storage (Free Tier)**
- **5 GB free per month**
- Generous rate limits
- No credit card for free tier

```bash
npm install firebase-admin
```

```typescript
import * as admin from 'firebase-admin';

const bucket = admin.storage().bucket();

async uploadDocument(
  @Req() req: any,
  @UploadedFile() file: Express.Multer.File
) {
  const fileName = `vendor-docs/${req.user.vendorId}/${Date.now()}-${file.originalname}`;
  const fileRef = bucket.file(fileName);
  
  await fileRef.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
  });
  
  const [url] = await fileRef.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
  });
  
  const doc = this.documentRepo.create({
    vendorId: req.user.vendorId,
    fileUrl: url,
    documentType: req.body.documentType,
  });
  
  return this.documentRepo.save(doc);
}
```

**Recommendation**: Use **local disk storage** (you have it) + **MinIO backup** for scalability.

---

## 4. Email Notifications (Free)

### **Option A: Nodemailer + Gmail (Free)**
- **Gmail**: Don't need an app password; use OAuth2
- **SendGrid**: 100 emails/day free (no credit card)

**Gmail Setup:**
```bash
npm install nodemailer
```

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Generate at https://myaccount.google.com/apppasswords
  },
});

async sendApprovalEmail(vendor: Vendor) {
  await transporter.sendMail({
    from: 'noreply@rentalbasic.com',
    to: vendor.user.email,
    subject: '✅ Your RentalBasic Verification is Approved!',
    html: `
      <h2>Welcome to RentalBasic, ${vendor.businessName}!</h2>
      <p>Your vendor account has been verified and is now active.</p>
      <p>Log in now: <a href="https://yourapp.com/vendor/login">RentalBasic</a></p>
      <p>Your badge: <strong>${vendor.verificationBadge}</strong></p>
    `,
  });
}

async sendRejectionEmail(vendor: Vendor, reason: string) {
  await transporter.sendMail({
    from: 'noreply@rentalbasic.com',
    to: vendor.user.email,
    subject: '❌ Verification Update Required',
    html: `
      <h2>Hello ${vendor.businessName},</h2>
      <p>Your vendor verification requires additional information:</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>Please log in and resubmit: <a href="https://yourapp.com/vendor/kyc">KYC Portal</a></p>
    `,
  });
}
```

**Env:**
```
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # From Google 2FA settings
```

---

### **Option B: SendGrid (Free Plan)**
- **100 emails/day free** (no credit card required)
- Professional transactional emails

```bash
npm install @sendgrid/mail
```

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async sendApprovalEmail(vendor: Vendor) {
  await sgMail.send({
    to: vendor.user.email,
    from: 'noreply@rentalbasic.com',
    subject: '✅ Verification Approved!',
    html: `<h2>Congratulations!</h2><p>Your account is verified: <strong>${vendor.verificationBadge}</strong></p>`,
  });
}
```

**Sign up:** https://sendgrid.com (free plan, no card)

---

### **Option C: Resend (New, Generous Free Tier)**
- **3,000 emails/day free**
- Excellent for transactional emails
- Built for developers

```bash
npm install resend
```

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async sendApprovalEmail(vendor: Vendor) {
  await resend.emails.send({
    from: 'RentalBasic <noreply@rentalbasic.com>',
    to: vendor.user.email,
    subject: '✅ Vendor Verification Approved!',
    html: `
      <h1>Welcome, ${vendor.businessName}!</h1>
      <p>Your verification status: <strong>${vendor.verificationBadge}</strong></p>
      <a href="https://yourapp.com/vendor/dashboard">View Dashboard</a>
    `,
  });
}
```

---

## Complete Integration Checklist

### **Recommended Free Stack**
```
┌─────────────────────────────┐
│ SMS/OTP → Twilio (free trial) or Firebase │
│ Face Recognition → face-api.js (client-side, free)
│ Document Storage → Local Disk + MinIO backup
│ Emails → SendGrid or Resend (free tier)
└─────────────────────────────┘
```

### **Zero-Cost Stack** (All self-hosted/client-side)
```
┌─────────────────────────────┐
│ SMS/OTP → Firebase Auth (free) + log in dev
│ Face Recognition → face-api.js (browser, free)
│ Document Storage → Local Disk with backup cron
│ Emails → Nodemailer + Gmail (free)
└─────────────────────────────┘
```

---

## Implementation Priority

**Phase 1 (This week)**: Email notifications
- **Action**: Add Nodemailer to `reviewRegistration()` endpoint
- **Est. time**: 30 mins
- **Cost**: $0

**Phase 2 (Next week)**: SMS/OTP
- **Action**: Swap console.log with Twilio SDK
- **Est. time**: 1 hour
- **Cost**: $0 (5-month free trial)

**Phase 3 (Optional, Later)**: Face Recognition
- **Action**: Add face-api.js to BecomeVendor.tsx
- **Est. time**: 2-3 hours
- **Cost**: $0 (fully client-side)

---

## Quick Start: Add Email Notifications Now

**1. Install Nodemailer:**
```bash
cd api && npm install nodemailer
```

**2. Add to `.env`:**
```
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

**3. Update `reviewRegistration()` in `vendors.service.ts`:**

See next section for code.
