/**
 * PROGRESS REPORTING SYSTEM
 * Real-time progress reporting for event organizers and administrators
 * 
 * Features:
 * - Real-time processing progress updates
 * - WebSocket-based live notifications
 * - Event organizer dashboard data
 * - Processing status and ETA reporting
 * - Mobile-friendly progress tracking
 */

import { EventEmitter } from 'events';
import { commercialPipeline } from './commercial-pipeline';
import { slaMonitor } from './sla-monitor';
import { batchOptimizer } from './batch-optimizer';

interface ProgressUpdate {
  eventId: number;
  timestamp: Date;
  progress: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    percentage: number;
  };
  performance: {
    currentThroughput: number; // photos per minute
    averageProcessingTime: number; // ms per photo
    estimatedTimeRemaining: number; // minutes
    slaStatus: 'on_track' | 'at_risk' | 'breached' | 'completed';
  };
  recent: {
    lastProcessedPhoto: string;
    recentProcessingTimes: number[]; // Last 10 processing times
    errorRate: number; // Percentage of recent failures
  };
}

interface OrganizerDashboard {
  eventId: number;
  eventName?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  startedAt?: Date;
  estimatedCompletion?: Date;
  actualCompletion?: Date;
  progress: ProgressUpdate;
  alerts: Array<{
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    timestamp: Date;
  }>;
  summary: {
    photosUploaded: number;
    photosProcessed: number;
    dorsalsDetected: number;
    processingQuality: 'excellent' | 'good' | 'fair' | 'poor';
    estimatedDeliveryTime: Date;
  };
}

interface ProcessingNotification {
  eventId: number;
  type: 'started' | 'milestone' | 'warning' | 'completed' | 'failed';
  title: string;
  message: string;
  timestamp: Date;
  data?: any;
}

class ProgressReporter extends EventEmitter {
  private eventDashboards: Map<number, OrganizerDashboard> = new Map();
  private progressUpdates: Map<number, ProgressUpdate[]> = new Map();
  private notifications: ProcessingNotification[] = [];
  private updateInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    
    // Listen to commercial pipeline events
    commercialPipeline.on('commercialEventAdded', this.handleEventStarted.bind(this));
    commercialPipeline.on('jobCompleted', this.handleJobCompleted.bind(this));
    commercialPipeline.on('jobFailed', this.handleJobFailed.bind(this));
    
    // Listen to SLA monitor events
    slaMonitor.on('slaAlert', this.handleSLAAlert.bind(this));
    slaMonitor.on('eventCompleted', this.handleEventCompleted.bind(this));
    
    // Start progress update loop
    this.startProgressUpdates();
    
    console.log('📊 [PROGRESS REPORTER] Initialized with real-time updates');
  }

  /**
   * Start progress update loop
   */
  private startProgressUpdates(): void {
    this.updateInterval = setInterval(() => {
      this.updateAllEventProgress();
    }, 10000); // Update every 10 seconds
    
    console.log('🔄 [PROGRESS] Started real-time update loop (10-second intervals)');
  }

  /**
   * Handle new event started
   */
  private handleEventStarted(event: { batchId: string; eventId: number; photoCount: number; slaTarget: Date }): void {
    const dashboard: OrganizerDashboard = {
      eventId: event.eventId,
      status: 'processing',
      startedAt: new Date(),
      estimatedCompletion: event.slaTarget,
      progress: {
        eventId: event.eventId,
        timestamp: new Date(),
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
          estimatedTimeRemaining: 120, // 2 hours
          slaStatus: 'on_track'
        },
        recent: {
          lastProcessedPhoto: '',
          recentProcessingTimes: [],
          errorRate: 0
        }
      },
      alerts: [],
      summary: {
        photosUploaded: event.photoCount,
        photosProcessed: 0,
        dorsalsDetected: 0,
        processingQuality: 'good',
        estimatedDeliveryTime: event.slaTarget
      }
    };
    
    this.eventDashboards.set(event.eventId, dashboard);
    this.progressUpdates.set(event.eventId, []);
    
    // Send start notification
    const notification: ProcessingNotification = {
      eventId: event.eventId,
      type: 'started',
      title: 'Processing Started',
      message: `Photo processing has begun for your event. ${event.photoCount} photos are being processed with a 2-hour delivery target.`,
      timestamp: new Date(),
      data: {
        photoCount: event.photoCount,
        estimatedCompletion: event.slaTarget
      }
    };
    
    this.addNotification(notification);
    
    console.log(`📊 [PROGRESS START] Event ${event.eventId}: ${event.photoCount} photos queued for processing`);
  }

  /**
   * Handle job completed
   */
  private handleJobCompleted(job: { jobId: string; photoId: number; eventId: number; status: string; duration?: number }): void {
    const dashboard = this.eventDashboards.get(job.eventId);
    if (!dashboard) return;
    
    // Update progress
    dashboard.progress.progress.completed++;
    dashboard.summary.photosProcessed++;
    
    // Add to recent processing times
    if (job.duration) {
      dashboard.progress.recent.recentProcessingTimes.push(job.duration);
      if (dashboard.progress.recent.recentProcessingTimes.length > 10) {
        dashboard.progress.recent.recentProcessingTimes.shift();
      }
    }
    
    dashboard.progress.recent.lastProcessedPhoto = `Photo ${job.photoId}`;
    
    // Check for milestones
    this.checkMilestones(dashboard);
    
    // Emit progress update
    this.emit('progressUpdate', dashboard.progress);
  }

  /**
   * Handle job failed
   */
  private handleJobFailed(job: { jobId: string; photoId: number; eventId: number; error: string }): void {
    const dashboard = this.eventDashboards.get(job.eventId);
    if (!dashboard) return;
    
    dashboard.progress.progress.failed++;
    
    // Update error rate
    const recentJobs = dashboard.progress.recent.recentProcessingTimes.length + 1;
    dashboard.progress.recent.errorRate = (dashboard.progress.progress.failed / recentJobs) * 100;
    
    // Add alert if error rate is high
    if (dashboard.progress.recent.errorRate > 5) { // >5% failure rate
      dashboard.alerts.push({
        type: 'warning',
        message: `High error rate detected: ${dashboard.progress.recent.errorRate.toFixed(1)}% of recent photos failed`,
        timestamp: new Date()
      });
    }
    
    console.log(`⚠️ [PROGRESS FAIL] Event ${job.eventId}, Photo ${job.photoId}: ${job.error}`);
  }

  /**
   * Handle SLA alerts
   */
  private handleSLAAlert(alert: any): void {
    const dashboard = this.eventDashboards.get(alert.eventId);
    if (!dashboard) return;
    
    const alertType = alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info';
    
    dashboard.alerts.push({
      type: alertType,
      message: alert.message,
      timestamp: alert.timestamp
    });
    
    // Keep only last 10 alerts
    if (dashboard.alerts.length > 10) {
      dashboard.alerts.shift();
    }
    
    // Send notification for critical alerts
    if (alert.severity === 'critical') {
      const notification: ProcessingNotification = {
        eventId: alert.eventId,
        type: 'warning',
        title: 'Processing Alert',
        message: alert.message,
        timestamp: alert.timestamp
      };
      
      this.addNotification(notification);
    }
  }

  /**
   * Handle event completed
   */
  private handleEventCompleted(report: any): void {
    const dashboard = this.eventDashboards.get(report.eventId);
    if (!dashboard) return;
    
    dashboard.status = 'completed';
    dashboard.actualCompletion = report.completionTime;
    dashboard.progress.performance.slaStatus = 'completed';
    
    // Update summary
    dashboard.summary.processingQuality = this.calculateProcessingQuality(report);
    dashboard.summary.dorsalsDetected = report.summary.successfulPhotos; // Approximation
    
    // Send completion notification
    const notification: ProcessingNotification = {
      eventId: report.eventId,
      type: 'completed',
      title: 'Processing Completed',
      message: `All photos have been processed! ${report.summary.successfulPhotos} photos are ready for download. ${report.slaCompliant ? 'Delivered on time!' : 'Delivery was delayed.'}`,
      timestamp: report.completionTime,
      data: {
        summary: report.summary,
        slaCompliant: report.slaCompliant
      }
    };
    
    this.addNotification(notification);
    
    console.log(`✅ [PROGRESS COMPLETE] Event ${report.eventId}: ${report.summary.successfulPhotos}/${report.summary.totalPhotos} photos processed`);
  }

  /**
   * Update progress for all active events
   */
  private updateAllEventProgress(): void {
    for (const [eventId, dashboard] of this.eventDashboards.entries()) {
      if (dashboard.status === 'processing') {
        this.updateEventProgress(dashboard);
      }
    }
  }

  /**
   * Update progress for specific event
   */
  private updateEventProgress(dashboard: OrganizerDashboard): void {
    const now = new Date();
    
    // Get current stats from pipeline
    const queueStats = commercialPipeline.getQueueStatus();
    const slaData = slaMonitor.getSLADashboard(dashboard.eventId);
    
    if (slaData) {
      dashboard.progress.progress = slaData.progress;
      dashboard.progress.performance = slaData.performance;
      dashboard.progress.performance.slaStatus = slaData.status;
      dashboard.estimatedCompletion = slaData.estimatedCompletion;
    }
    
    dashboard.progress.timestamp = now;
    
    // Calculate processing quality
    const total = dashboard.progress.progress.total;
    const completed = dashboard.progress.progress.completed;
    const failed = dashboard.progress.progress.failed;
    
    if (total > 0) {
      const successRate = (completed / (completed + failed)) * 100;
      dashboard.summary.processingQuality = 
        successRate >= 98 ? 'excellent' :
        successRate >= 95 ? 'good' :
        successRate >= 90 ? 'fair' : 'poor';
    }
    
    // Store progress update
    const updates = this.progressUpdates.get(dashboard.eventId) || [];
    updates.push(JSON.parse(JSON.stringify(dashboard.progress))); // Deep copy
    
    // Keep only last 100 updates
    if (updates.length > 100) {
      updates.shift();
    }
    
    this.progressUpdates.set(dashboard.eventId, updates);
    
    // Emit update
    this.emit('progressUpdate', dashboard.progress);
  }

  /**
   * Check for processing milestones
   */
  private checkMilestones(dashboard: OrganizerDashboard): void {
    const completed = dashboard.progress.progress.completed;
    const total = dashboard.progress.progress.total;
    const percentage = (completed / total) * 100;
    
    // Milestone notifications at 25%, 50%, 75%
    const milestones = [25, 50, 75];
    
    for (const milestone of milestones) {
      if (percentage >= milestone && !this.hasSentMilestone(dashboard.eventId, milestone)) {
        const notification: ProcessingNotification = {
          eventId: dashboard.eventId,
          type: 'milestone',
          title: `${milestone}% Complete`,
          message: `Processing is ${milestone}% complete. ${completed} of ${total} photos have been processed.`,
          timestamp: new Date(),
          data: { milestone, completed, total, percentage }
        };
        
        this.addNotification(notification);
        this.markMilestoneSent(dashboard.eventId, milestone);
      }
    }
  }

  /**
   * Check if milestone notification was sent
   */
  private hasSentMilestone(eventId: number, milestone: number): boolean {
    return this.notifications.some(n => 
      n.eventId === eventId && 
      n.type === 'milestone' && 
      n.data?.milestone === milestone
    );
  }

  /**
   * Mark milestone as sent
   */
  private markMilestoneSent(eventId: number, milestone: number): void {
    // Already stored in notifications array
  }

  /**
   * Calculate processing quality
   */
  private calculateProcessingQuality(report: any): 'excellent' | 'good' | 'fair' | 'poor' {
    const successRate = report.summary.successRate;
    const slaCompliant = report.slaCompliant;
    
    if (successRate >= 98 && slaCompliant) return 'excellent';
    if (successRate >= 95 && slaCompliant) return 'good';
    if (successRate >= 90) return 'fair';
    return 'poor';
  }

  /**
   * Add notification
   */
  private addNotification(notification: ProcessingNotification): void {
    this.notifications.push(notification);
    
    // Keep only last 1000 notifications
    if (this.notifications.length > 1000) {
      this.notifications.shift();
    }
    
    // Emit notification
    this.emit('notification', notification);
    
    console.log(`📢 [NOTIFICATION] Event ${notification.eventId}: ${notification.title} - ${notification.message}`);
  }

  /**
   * Get organizer dashboard for event
   */
  getOrganizerDashboard(eventId: number): OrganizerDashboard | undefined {
    return this.eventDashboards.get(eventId);
  }

  /**
   * Get progress history for event
   */
  getProgressHistory(eventId: number): ProgressUpdate[] {
    return this.progressUpdates.get(eventId) || [];
  }

  /**
   * Get recent notifications for event
   */
  getEventNotifications(eventId: number, limit: number = 20): ProcessingNotification[] {
    return this.notifications
      .filter(n => n.eventId === eventId)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get all notifications
   */
  getAllNotifications(limit: number = 50): ProcessingNotification[] {
    return this.notifications.slice(-limit).reverse();
  }

  /**
   * Get processing summary for all events
   */
  getProcessingSummary(): {
    activeEvents: number;
    completedEvents: number;
    totalPhotosProcessing: number;
    totalPhotosCompleted: number;
    averageThroughput: number;
    systemStatus: 'optimal' | 'busy' | 'overloaded';
  } {
    const activeEvents = Array.from(this.eventDashboards.values()).filter(d => d.status === 'processing');
    const completedEvents = Array.from(this.eventDashboards.values()).filter(d => d.status === 'completed');
    
    const totalProcessing = activeEvents.reduce((sum, e) => sum + e.progress.progress.total, 0);
    const totalCompleted = completedEvents.reduce((sum, e) => sum + e.summary.photosProcessed, 0);
    const totalThroughput = activeEvents.reduce((sum, e) => sum + e.progress.performance.currentThroughput, 0);
    
    let systemStatus: 'optimal' | 'busy' | 'overloaded' = 'optimal';
    if (activeEvents.length > 3) {
      systemStatus = 'overloaded';
    } else if (activeEvents.length > 1) {
      systemStatus = 'busy';
    }
    
    return {
      activeEvents: activeEvents.length,
      completedEvents: completedEvents.length,
      totalPhotosProcessing: totalProcessing,
      totalPhotosCompleted: totalCompleted,
      averageThroughput: totalThroughput,
      systemStatus
    };
  }

  /**
   * Shutdown reporter
   */
  shutdown(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    console.log('🛑 [PROGRESS REPORTER] Shutdown complete');
  }
}

// Export singleton instance
export const progressReporter = new ProgressReporter();
export type { ProgressUpdate, OrganizerDashboard, ProcessingNotification };