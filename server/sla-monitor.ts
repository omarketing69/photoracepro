/**
 * SLA MONITORING AND ALERTING SYSTEM
 * Real-time monitoring of 2-hour commercial SLA compliance
 * 
 * Features:
 * - Real-time SLA tracking and progress monitoring
 * - Automated alerts at 60/30/10 minute thresholds  
 * - Completion notifications and reporting
 * - Dashboard data for organizers
 * - Performance analytics and insights
 */

import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { commercialPipeline } from './commercial-pipeline';
import { batchOptimizer } from './batch-optimizer';
import { performanceMonitor } from './performance-monitor';
import { db } from './db';
import { slaAlerts } from '../shared/schema';

interface SLAAlert {
  eventId: number;
  alertType: 'started' | '60_minutes' | '30_minutes' | '10_minutes' | 'breach' | 'completed' | 'warning';
  message: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'critical' | 'success';
  metadata: {
    photosTotal: number;
    photosCompleted: number;
    photosFailed: number;
    remainingTime: number; // minutes
    estimatedCompletion: Date;
    currentThroughput: number; // photos per minute
    slaStatus: 'on_track' | 'at_risk' | 'breached' | 'completed';
  };
}

interface SLADashboard {
  eventId: number;
  eventName?: string;
  slaTarget: Date;
  startTime: Date;
  estimatedCompletion: Date;
  actualCompletion?: Date;
  status: 'on_track' | 'at_risk' | 'breached' | 'completed';
  progress: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    percentage: number;
  };
  performance: {
    currentThroughput: number; // photos per minute
    averageProcessingTime: number; // milliseconds per photo
    estimatedRemainingTime: number; // minutes
    timeElapsed: number; // minutes
    timeRemaining: number; // minutes until SLA breach
  };
  alerts: SLAAlert[];
  lastUpdated: Date;
}

interface CompletionReport {
  eventId: number;
  eventName?: string;
  startTime: Date;
  completionTime: Date;
  slaTarget: Date;
  slaCompliant: boolean;
  summary: {
    totalPhotos: number;
    successfulPhotos: number;
    failedPhotos: number;
    successRate: number;
    actualDuration: number; // minutes
    targetDuration: number; // minutes
    performanceRatio: number; // actual vs target time
  };
  performance: {
    averageThroughput: number;
    peakThroughput: number;
    averageProcessingTime: number;
    bottlenecks: string[];
  };
  recommendations: string[];
}

class SLAMonitor extends EventEmitter {
  private activeSLAs: Map<number, SLADashboard> = new Map();
  private completedSLAs: Map<number, CompletionReport> = new Map();
  private alertHistory: SLAAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Alert thresholds in minutes
  private alertThresholds = [60, 30, 10, 5, 1];
  private sentAlerts: Map<number, Set<number>> = new Map();
  
  constructor() {
    super();
    this.startMonitoring();
    
    // Listen to commercial pipeline events
    commercialPipeline.on('commercialEventAdded', this.handleEventStarted.bind(this));
    commercialPipeline.on('jobCompleted', this.handleJobCompleted.bind(this));
    commercialPipeline.on('slaAlert', this.handlePipelineAlert.bind(this));
    
    console.log('📊 [SLA MONITOR] Initialized with 2-hour commercial SLA tracking');
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkAllSLAs();
    }, 30000); // Check every 30 seconds
    
    console.log('🔄 [SLA MONITOR] Started monitoring loop (30-second intervals)');
  }

  /**
   * Handle new commercial event started
   */
  private handleEventStarted(event: { batchId: string; eventId: number; photoCount: number; slaTarget: Date }): void {
    const dashboard: SLADashboard = {
      eventId: event.eventId,
      slaTarget: event.slaTarget,
      startTime: new Date(),
      estimatedCompletion: event.slaTarget,
      status: 'on_track',
      progress: {
        total: event.photoCount,
        completed: 0,
        failed: 0,
        processing: 0,
        percentage: 0
      },
      performance: {
        currentThroughput: 0,
        averageProcessingTime: 0,
        estimatedRemainingTime: 120, // 2 hours default
        timeElapsed: 0,
        timeRemaining: 120
      },
      alerts: [],
      lastUpdated: new Date()
    };
    
    this.activeSLAs.set(event.eventId, dashboard);
    this.sentAlerts.set(event.eventId, new Set());
    
    // Send start alert
    const startAlert: SLAAlert = {
      eventId: event.eventId,
      alertType: 'started',
      message: `Commercial event processing started: ${event.photoCount} photos, 2-hour SLA`,
      timestamp: new Date(),
      severity: 'info',
      metadata: {
        photosTotal: event.photoCount,
        photosCompleted: 0,
        photosFailed: 0,
        remainingTime: 120,
        estimatedCompletion: event.slaTarget,
        currentThroughput: 0,
        slaStatus: 'on_track'
      }
    };
    
    this.addAlert(startAlert);
    
    console.log(`🎯 [SLA START] Event ${event.eventId}: ${event.photoCount} photos, target: ${event.slaTarget.toISOString()}`);
  }

  /**
   * Handle job completion
   */
  private handleJobCompleted(job: { jobId: string; photoId: number; eventId: number; status: string; duration?: number }): void {
    const dashboard = this.activeSLAs.get(job.eventId);
    if (!dashboard) return;
    
    // Update progress
    if (job.status === 'success') {
      dashboard.progress.completed++;
    } else {
      dashboard.progress.failed++;
    }
    
    dashboard.progress.percentage = Math.round(
      ((dashboard.progress.completed + dashboard.progress.failed) / dashboard.progress.total) * 100
    );
    
    // Update performance metrics
    this.updatePerformanceMetrics(dashboard);
    
    // Check if event is completed
    if (dashboard.progress.completed + dashboard.progress.failed >= dashboard.progress.total) {
      this.handleEventCompleted(dashboard);
    }
    
    dashboard.lastUpdated = new Date();
  }

  /**
   * Handle pipeline alerts
   */
  private handlePipelineAlert(alert: any): void {
    const dashboard = this.activeSLAs.get(alert.eventId);
    if (!dashboard) return;
    
    const slaAlert: SLAAlert = {
      eventId: alert.eventId,
      alertType: alert.alertType,
      message: `Pipeline alert: ${alert.alertType}`,
      timestamp: new Date(),
      severity: this.getSeverityFromAlertType(alert.alertType),
      metadata: {
        photosTotal: dashboard.progress.total,
        photosCompleted: dashboard.progress.completed,
        photosFailed: dashboard.progress.failed,
        remainingTime: dashboard.performance.timeRemaining,
        estimatedCompletion: dashboard.estimatedCompletion,
        currentThroughput: dashboard.performance.currentThroughput,
        slaStatus: dashboard.status
      }
    };
    
    this.addAlert(slaAlert);
  }

  /**
   * Check all active SLAs
   */
  private checkAllSLAs(): void {
    for (const [eventId, dashboard] of this.activeSLAs.entries()) {
      this.updateDashboard(dashboard);
      this.checkAlertThresholds(dashboard);
    }
  }

  /**
   * Update dashboard metrics
   */
  private updateDashboard(dashboard: SLADashboard): void {
    const now = new Date();
    const timeElapsed = (now.getTime() - dashboard.startTime.getTime()) / (1000 * 60); // minutes
    const timeUntilSLA = (dashboard.slaTarget.getTime() - now.getTime()) / (1000 * 60); // minutes
    
    dashboard.performance.timeElapsed = Math.round(timeElapsed);
    dashboard.performance.timeRemaining = Math.round(timeUntilSLA);
    
    // Update performance metrics
    this.updatePerformanceMetrics(dashboard);
    
    // Update status
    this.updateSLAStatus(dashboard);
    
    dashboard.lastUpdated = now;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(dashboard: SLADashboard): void {
    const completed = dashboard.progress.completed;
    const timeElapsed = dashboard.performance.timeElapsed;
    
    if (completed > 0 && timeElapsed > 0) {
      dashboard.performance.currentThroughput = Math.round((completed / timeElapsed) * 100) / 100;
      
      const remaining = dashboard.progress.total - completed - dashboard.progress.failed;
      if (dashboard.performance.currentThroughput > 0) {
        dashboard.performance.estimatedRemainingTime = Math.round(remaining / dashboard.performance.currentThroughput);
        dashboard.estimatedCompletion = new Date(Date.now() + dashboard.performance.estimatedRemainingTime * 60 * 1000);
      }
    }
    
    // Get average processing time from pipeline
    const pipelineStats = commercialPipeline.getPipelineStats();
    dashboard.performance.averageProcessingTime = pipelineStats.averageProcessingTime;
  }

  /**
   * Update SLA status
   */
  private updateSLAStatus(dashboard: SLADashboard): void {
    const timeRemaining = dashboard.performance.timeRemaining;
    const estimatedTime = dashboard.performance.estimatedRemainingTime;
    
    if (dashboard.progress.completed + dashboard.progress.failed >= dashboard.progress.total) {
      dashboard.status = 'completed';
    } else if (timeRemaining <= 0) {
      dashboard.status = 'breached';
    } else if (estimatedTime > timeRemaining) {
      dashboard.status = 'breached';
    } else if (estimatedTime > timeRemaining * 0.8) {
      dashboard.status = 'at_risk';
    } else {
      dashboard.status = 'on_track';
    }
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(dashboard: SLADashboard): void {
    const eventId = dashboard.eventId;
    const timeRemaining = dashboard.performance.timeRemaining;
    const sentAlerts = this.sentAlerts.get(eventId) || new Set();
    
    for (const threshold of this.alertThresholds) {
      if (timeRemaining <= threshold && !sentAlerts.has(threshold)) {
        const alert: SLAAlert = {
          eventId,
          alertType: `${threshold}_minutes` as any,
          message: `SLA Alert: ${threshold} minutes remaining for Event ${eventId}`,
          timestamp: new Date(),
          severity: threshold <= 10 ? 'critical' : threshold <= 30 ? 'warning' : 'info',
          metadata: {
            photosTotal: dashboard.progress.total,
            photosCompleted: dashboard.progress.completed,
            photosFailed: dashboard.progress.failed,
            remainingTime: timeRemaining,
            estimatedCompletion: dashboard.estimatedCompletion,
            currentThroughput: dashboard.performance.currentThroughput,
            slaStatus: dashboard.status
          }
        };
        
        this.addAlert(alert);
        sentAlerts.add(threshold);
        
        console.log(`🚨 [SLA ALERT] Event ${eventId}: ${threshold} minutes remaining`);
      }
    }
    
    // SLA breach alert
    if (dashboard.status === 'breached' && !sentAlerts.has(-1)) {
      const breachAlert: SLAAlert = {
        eventId,
        alertType: 'breach',
        message: `SLA BREACHED: Event ${eventId} has exceeded the 2-hour processing target`,
        timestamp: new Date(),
        severity: 'critical',
        metadata: {
          photosTotal: dashboard.progress.total,
          photosCompleted: dashboard.progress.completed,
          photosFailed: dashboard.progress.failed,
          remainingTime: timeRemaining,
          estimatedCompletion: dashboard.estimatedCompletion,
          currentThroughput: dashboard.performance.currentThroughput,
          slaStatus: dashboard.status
        }
      };
      
      this.addAlert(breachAlert);
      sentAlerts.add(-1);
      
      console.log(`💥 [SLA BREACH] Event ${eventId}: Processing exceeded 2-hour target`);
    }
  }

  /**
   * Handle event completion
   */
  private handleEventCompleted(dashboard: SLADashboard): void {
    const now = new Date();
    dashboard.actualCompletion = now;
    dashboard.status = 'completed';
    
    const slaCompliant = now <= dashboard.slaTarget;
    const actualDuration = (now.getTime() - dashboard.startTime.getTime()) / (1000 * 60); // minutes
    const targetDuration = (dashboard.slaTarget.getTime() - dashboard.startTime.getTime()) / (1000 * 60); // minutes
    
    // Create completion report
    const report: CompletionReport = {
      eventId: dashboard.eventId,
      eventName: dashboard.eventName,
      startTime: dashboard.startTime,
      completionTime: now,
      slaTarget: dashboard.slaTarget,
      slaCompliant,
      summary: {
        totalPhotos: dashboard.progress.total,
        successfulPhotos: dashboard.progress.completed,
        failedPhotos: dashboard.progress.failed,
        successRate: Math.round((dashboard.progress.completed / dashboard.progress.total) * 100),
        actualDuration: Math.round(actualDuration),
        targetDuration: Math.round(targetDuration),
        performanceRatio: actualDuration / targetDuration
      },
      performance: {
        averageThroughput: dashboard.performance.currentThroughput,
        peakThroughput: dashboard.performance.currentThroughput, // Would need tracking for actual peak
        averageProcessingTime: dashboard.performance.averageProcessingTime,
        bottlenecks: this.identifyBottlenecks(dashboard)
      },
      recommendations: this.generateRecommendations(dashboard)
    };
    
    this.completedSLAs.set(dashboard.eventId, report);
    
    // Send completion alert
    const completionAlert: SLAAlert = {
      eventId: dashboard.eventId,
      alertType: 'completed',
      message: `Event ${dashboard.eventId} processing completed ${slaCompliant ? 'WITHIN' : 'BEYOND'} SLA (${Math.round(actualDuration)} minutes)`,
      timestamp: now,
      severity: slaCompliant ? 'success' : 'warning',
      metadata: {
        photosTotal: dashboard.progress.total,
        photosCompleted: dashboard.progress.completed,
        photosFailed: dashboard.progress.failed,
        remainingTime: 0,
        estimatedCompletion: now,
        currentThroughput: dashboard.performance.currentThroughput,
        slaStatus: 'completed'
      }
    };
    
    this.addAlert(completionAlert);
    
    // Remove from active monitoring
    this.activeSLAs.delete(dashboard.eventId);
    this.sentAlerts.delete(dashboard.eventId);
    
    console.log(`✅ [SLA COMPLETE] Event ${dashboard.eventId}: ${slaCompliant ? 'SUCCESS' : 'BREACH'} (${Math.round(actualDuration)}min)`);
    
    // Emit completion event
    this.emit('eventCompleted', report);
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(dashboard: SLADashboard): string[] {
    const bottlenecks: string[] = [];
    
    if (dashboard.performance.currentThroughput < 8.33) { // Target: 8.33 photos/min for 2h SLA
      bottlenecks.push('Low processing throughput');
    }
    
    if (dashboard.performance.averageProcessingTime > 7000) { // Target: 7 seconds per photo
      bottlenecks.push('High per-photo processing time');
    }
    
    if (dashboard.progress.failed > dashboard.progress.total * 0.05) { // >5% failure rate
      bottlenecks.push('High failure rate');
    }
    
    return bottlenecks;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(dashboard: SLADashboard): string[] {
    const recommendations: string[] = [];
    
    if (dashboard.performance.currentThroughput < 8.33) {
      recommendations.push('Increase concurrent processing workers');
      recommendations.push('Optimize batch sizes for better throughput');
    }
    
    if (dashboard.performance.averageProcessingTime > 7000) {
      recommendations.push('Optimize OCR processing speed');
      recommendations.push('Consider image preprocessing to reduce processing time');
    }
    
    if (dashboard.progress.failed > 0) {
      recommendations.push('Investigate and resolve processing failures');
      recommendations.push('Improve error handling and retry logic');
    }
    
    return recommendations;
  }

  /**
   * Add alert to history and trigger external notifications
   */
  private addAlert(alert: SLAAlert): void {
    this.alertHistory.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }
    
    // Add to dashboard
    const dashboard = this.activeSLAs.get(alert.eventId);
    if (dashboard) {
      dashboard.alerts.push(alert);
      
      // Keep only last 20 alerts per event
      if (dashboard.alerts.length > 20) {
        dashboard.alerts.shift();
      }
    }
    
    // CRITICAL: Persist alert to database
    this.persistAlertToDatabase(alert).catch(error => {
      console.error('Failed to persist SLA alert to database:', error);
    });
    
    // CRITICAL: Send external notifications (email/webhook)
    this.sendExternalNotifications(alert).catch(error => {
      console.error('Failed to send external SLA notifications:', error);
    });
    
    // Emit alert event
    this.emit('slaAlert', alert);
  }

  /**
   * Persist alert to database for audit and dashboard display
   */
  private async persistAlertToDatabase(alert: SLAAlert): Promise<void> {
    try {
      await db.insert(slaAlerts).values({
        eventId: alert.eventId,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        metadata: alert.metadata,
        timestamp: alert.timestamp
      });
      
      console.log(`💾 [SLA DB] Alert persisted: Event ${alert.eventId}, Type: ${alert.alertType}`);
    } catch (error) {
      console.error(`❌ [SLA DB] Failed to persist alert for Event ${alert.eventId}:`, error);
      throw error;
    }
  }

  /**
   * CRITICAL: Send external notifications for SLA alerts
   * Supports email notifications and webhook calls
   */
  private async sendExternalNotifications(alert: SLAAlert): Promise<void> {
    const promises: Promise<void>[] = [];
    
    // Only send external notifications for critical alerts (60/30/10 min + breach)
    if (!['60_minutes', '30_minutes', '10_minutes', 'breach', 'completed'].includes(alert.alertType)) {
      return;
    }
    
    console.log(`📧 [SLA NOTIFY] Sending external notifications for Event ${alert.eventId}, Type: ${alert.alertType}`);
    
    // Email notifications
    if (process.env.SLA_EMAIL_ENABLED === 'true' && process.env.SLA_EMAIL_TO) {
      promises.push(this.sendEmailNotification(alert));
    }
    
    // Webhook notifications  
    if (process.env.SLA_WEBHOOK_URL) {
      promises.push(this.sendWebhookNotification(alert));
    }
    
    // Slack notifications
    if (process.env.SLA_SLACK_WEBHOOK_URL) {
      promises.push(this.sendSlackNotification(alert));
    }
    
    // Wait for all notifications (with timeout)
    await Promise.allSettled(promises);
  }

  /**
   * Send email notification for SLA alert
   */
  private async sendEmailNotification(alert: SLAAlert): Promise<void> {
    try {
      const emailEndpoint = process.env.SLA_EMAIL_ENDPOINT;
      const emailTo = process.env.SLA_EMAIL_TO;
      const emailFrom = process.env.SLA_EMAIL_FROM || 'noreply@photorace.system';
      
      if (!emailEndpoint) {
        console.warn(`⚠️ [SLA EMAIL] No email endpoint configured, skipping email for Event ${alert.eventId}`);
        return;
      }
      
      const subject = this.getEmailSubject(alert);
      const body = this.getEmailBody(alert);
      
      const response = await fetch(emailEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLA_EMAIL_TOKEN || ''}`
        },
        body: JSON.stringify({
          from: emailFrom,
          to: emailTo,
          subject,
          html: body,
          text: this.stripHtml(body),
          priority: alert.severity === 'critical' ? 'high' : 'normal'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Email API returned ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ [SLA EMAIL] Sent to ${emailTo} for Event ${alert.eventId}, Type: ${alert.alertType}`);
    } catch (error) {
      console.error(`❌ [SLA EMAIL] Failed to send email for Event ${alert.eventId}:`, error);
      throw error;
    }
  }

  /**
   * Send webhook notification for SLA alert
   */
  private async sendWebhookNotification(alert: SLAAlert): Promise<void> {
    try {
      const webhookUrl = process.env.SLA_WEBHOOK_URL;
      const webhookSecret = process.env.SLA_WEBHOOK_SECRET;
      
      if (!webhookUrl) {
        return;
      }
      
      const payload = {
        event: 'sla_alert',
        timestamp: alert.timestamp.toISOString(),
        alert: {
          eventId: alert.eventId,
          type: alert.alertType,
          severity: alert.severity,
          message: alert.message,
          metadata: alert.metadata
        },
        system: {
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0'
        }
      };
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'PhotoRace-SLA-Monitor/1.0'
      };
      
      if (webhookSecret) {
        headers['Authorization'] = `Bearer ${webhookSecret}`;
      }
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ [SLA WEBHOOK] Sent to ${webhookUrl} for Event ${alert.eventId}, Type: ${alert.alertType}`);
    } catch (error) {
      console.error(`❌ [SLA WEBHOOK] Failed to send webhook for Event ${alert.eventId}:`, error);
      throw error;
    }
  }

  /**
   * Send Slack notification for SLA alert
   */
  private async sendSlackNotification(alert: SLAAlert): Promise<void> {
    try {
      const slackWebhookUrl = process.env.SLA_SLACK_WEBHOOK_URL;
      
      if (!slackWebhookUrl) {
        return;
      }
      
      const color = this.getSlackColor(alert.severity);
      const emoji = this.getSlackEmoji(alert.alertType);
      
      const payload = {
        username: 'PhotoRace SLA Monitor',
        icon_emoji: ':warning:',
        attachments: [{
          color,
          title: `${emoji} SLA Alert - Event ${alert.eventId}`,
          text: alert.message,
          fields: [
            {
              title: 'Alert Type',
              value: alert.alertType,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Photos Progress',
              value: `${alert.metadata.photosCompleted}/${alert.metadata.photosTotal} (${Math.round((alert.metadata.photosCompleted/alert.metadata.photosTotal)*100)}%)`,
              short: true
            },
            {
              title: 'Remaining Time',
              value: `${alert.metadata.remainingTime} minutes`,
              short: true
            },
            {
              title: 'Current Throughput',
              value: `${alert.metadata.currentThroughput.toFixed(1)} photos/min`,
              short: true
            },
            {
              title: 'SLA Status',
              value: alert.metadata.slaStatus.toUpperCase(),
              short: true
            }
          ],
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }]
      };
      
      const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ [SLA SLACK] Sent notification for Event ${alert.eventId}, Type: ${alert.alertType}`);
    } catch (error) {
      console.error(`❌ [SLA SLACK] Failed to send Slack notification for Event ${alert.eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get email subject for alert
   */
  private getEmailSubject(alert: SLAAlert): string {
    const urgency = alert.severity === 'critical' ? '[URGENT] ' : '';
    return `${urgency}SLA Alert: Event ${alert.eventId} - ${alert.alertType}`;
  }

  /**
   * Get email body HTML for alert
   */
  private getEmailBody(alert: SLAAlert): string {
    const urgentStyle = alert.severity === 'critical' ? 'background: #dc3545; color: white;' : '';
    
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
            <div style="text-align: center; padding: 15px; border-radius: 6px; margin-bottom: 20px; ${urgentStyle}">
              <h2 style="margin: 0;">${alert.severity === 'critical' ? '🚨' : '⚠️'} SLA Alert</h2>
            </div>
            
            <h3>Event ${alert.eventId} Processing Alert</h3>
            <p><strong>Alert Type:</strong> ${alert.alertType}</p>
            <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
            <p><strong>Message:</strong> ${alert.message}</p>
            <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
            
            <h4>Processing Status</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>Total Photos</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${alert.metadata.photosTotal}</td></tr>
              <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>Completed</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${alert.metadata.photosCompleted}</td></tr>
              <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>Failed</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${alert.metadata.photosFailed}</td></tr>
              <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>Progress</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${Math.round((alert.metadata.photosCompleted/alert.metadata.photosTotal)*100)}%</td></tr>
              <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>Remaining Time</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${alert.metadata.remainingTime} minutes</td></tr>
              <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>Current Throughput</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${alert.metadata.currentThroughput.toFixed(2)} photos/min</td></tr>
              <tr><td style="border: 1px solid #ddd; padding: 8px;"><strong>SLA Status</strong></td><td style="border: 1px solid #ddd; padding: 8px;">${alert.metadata.slaStatus.toUpperCase()}</td></tr>
            </table>
            
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              This is an automated alert from the PhotoRace SLA Monitoring System.<br>
              Event processing target: 2 hours maximum.
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Strip HTML from text
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Get Slack color for severity
   */
  private getSlackColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'warning': return 'warning';
      case 'success': return 'good';
      default: return '#36a64f';
    }
  }

  /**
   * Get Slack emoji for alert type
   */
  private getSlackEmoji(alertType: string): string {
    switch (alertType) {
      case 'breach': return '💥';
      case '10_minutes': return '🚨';
      case '30_minutes': return '⚠️';
      case '60_minutes': return '⏰';
      case 'completed': return '✅';
      default: return '📊';
    }
  }

  /**
   * Get severity from alert type
   */
  private getSeverityFromAlertType(alertType: string): 'info' | 'warning' | 'critical' | 'success' {
    switch (alertType) {
      case 'started':
      case 'completed':
        return 'success';
      case '60_minutes':
        return 'info';
      case '30_minutes':
      case '10_minutes':
        return 'warning';
      case 'breach':
        return 'critical';
      default:
        return 'info';
    }
  }

  /**
   * Get SLA dashboard for event
   */
  getSLADashboard(eventId: number): SLADashboard | undefined {
    return this.activeSLAs.get(eventId);
  }

  /**
   * Get all active SLA dashboards
   */
  getAllActiveSLAs(): SLADashboard[] {
    return Array.from(this.activeSLAs.values());
  }

  /**
   * Get completion report
   */
  getCompletionReport(eventId: number): CompletionReport | undefined {
    return this.completedSLAs.get(eventId);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): SLAAlert[] {
    return this.alertHistory.slice(-limit).reverse();
  }

  /**
   * Get SLA compliance statistics
   */
  getSLAStats(): {
    totalEvents: number;
    completedEvents: number;
    compliantEvents: number;
    complianceRate: number;
    averageProcessingTime: number;
    averageThroughput: number;
  } {
    const completed = Array.from(this.completedSLAs.values());
    const compliant = completed.filter(report => report.slaCompliant);
    
    const totalProcessingTime = completed.reduce((sum, report) => sum + report.summary.actualDuration, 0);
    const totalThroughput = completed.reduce((sum, report) => sum + report.performance.averageThroughput, 0);
    
    return {
      totalEvents: this.activeSLAs.size + completed.length,
      completedEvents: completed.length,
      compliantEvents: compliant.length,
      complianceRate: completed.length > 0 ? Math.round((compliant.length / completed.length) * 100) : 100,
      averageProcessingTime: completed.length > 0 ? Math.round(totalProcessingTime / completed.length) : 0,
      averageThroughput: completed.length > 0 ? Math.round((totalThroughput / completed.length) * 100) / 100 : 0
    };
  }

  /**
   * Force event completion (for testing or emergency)
   */
  forceCompleteEvent(eventId: number): void {
    const dashboard = this.activeSLAs.get(eventId);
    if (dashboard) {
      console.log(`🔧 [FORCE COMPLETE] Manually completing Event ${eventId}`);
      this.handleEventCompleted(dashboard);
    }
  }

  /**
   * Shutdown monitor
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('🛑 [SLA MONITOR] Shutdown complete');
  }
}

// Export singleton instance
export const slaMonitor = new SLAMonitor();
export type { SLAAlert, SLADashboard, CompletionReport };