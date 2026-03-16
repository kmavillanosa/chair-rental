import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FraudAlert,
  FraudAlertSeverity,
  FraudAlertStatus,
  FraudAlertType,
} from './entities/fraud-alert.entity';

type CreateFraudAlertInput = {
  type: FraudAlertType;
  severity?: FraudAlertSeverity;
  title: string;
  description: string;
  userId?: string | null;
  vendorId?: string | null;
  bookingId?: string | null;
  messageId?: string | null;
  disputeId?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class FraudService {
  private readonly paymentBypassPatterns = [
    /\bgcash\b/i,
    /\bpay\s+outside\b/i,
    /\bdirect\s+payment\b/i,
    /\bpayment\s+link\b/i,
    /\bbank\s+transfer\b/i,
    /\bsend\s+(it\s+)?direct\b/i,
  ];

  private readonly phonePattern = /(?:\+?63\s?\d{3}\s?\d{3}\s?\d{4}|\b0\d{10}\b|\b\d{7,}\b)/gi;
  private readonly emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  private readonly urlPattern = /https?:\/\/\S+|www\.\S+/gi;

  constructor(
    @InjectRepository(FraudAlert)
    private readonly alertsRepo: Repository<FraudAlert>,
  ) {}

  async createAlert(input: CreateFraudAlertInput) {
    const alert = this.alertsRepo.create({
      type: input.type,
      severity: input.severity || FraudAlertSeverity.MEDIUM,
      title: input.title,
      description: input.description,
      userId: input.userId || null,
      vendorId: input.vendorId || null,
      bookingId: input.bookingId || null,
      messageId: input.messageId || null,
      disputeId: input.disputeId || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });

    return this.alertsRepo.save(alert);
  }

  listAlerts(status?: FraudAlertStatus, type?: FraudAlertType) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;

    return this.alertsRepo.find({
      where,
      relations: ['user', 'vendor', 'booking'],
      order: { createdAt: 'DESC' },
    });
  }

  async getSummary() {
    const alerts = await this.alertsRepo.find();
    const open = alerts.filter((alert) => alert.status === FraudAlertStatus.OPEN).length;
    const high = alerts.filter(
      (alert) =>
        alert.severity === FraudAlertSeverity.HIGH ||
        alert.severity === FraudAlertSeverity.CRITICAL,
    ).length;

    return {
      total: alerts.length,
      open,
      underReview: alerts.filter((alert) => alert.status === FraudAlertStatus.UNDER_REVIEW).length,
      highPriority: high,
    };
  }

  async reviewAlert(
    id: string,
    status: FraudAlertStatus,
    reviewedByUserId: string,
    resolutionNote?: string,
  ) {
    const alert = await this.alertsRepo.findOne({ where: { id } });
    if (!alert) {
      throw new NotFoundException('Fraud alert not found');
    }

    await this.alertsRepo.update(id, {
      status,
      reviewedByUserId,
      reviewedAt: new Date(),
      resolutionNote: resolutionNote || null,
    });

    return this.alertsRepo.findOne({
      where: { id },
      relations: ['user', 'vendor', 'booking'],
    });
  }

  analyzeMessageContent(contentInput: string) {
    const content = String(contentInput || '').trim();
    const reasons: string[] = [];

    if (this.phonePattern.test(content)) {
      reasons.push('phone_number_detected');
    }
    this.phonePattern.lastIndex = 0;

    if (this.emailPattern.test(content)) {
      reasons.push('email_detected');
    }
    this.emailPattern.lastIndex = 0;

    if (this.urlPattern.test(content)) {
      reasons.push('external_link_detected');
    }
    this.urlPattern.lastIndex = 0;

    if (this.paymentBypassPatterns.some((pattern) => pattern.test(content))) {
      reasons.push('off_platform_payment_language');
    }

    const redactedContent = content
      .replace(this.phonePattern, '[hidden phone]')
      .replace(this.emailPattern, '[hidden email]')
      .replace(this.urlPattern, '[hidden link]');

    return {
      redactedContent,
      isFlagged: reasons.length > 0,
      reasons,
    };
  }
}