import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  PlayCircle,
  Shield,
  Database,
  Cloud,
  Eye,
  Image,
  Link,
  TrendingUp,
  Activity,
  Settings
} from "lucide-react";
import NavigationHeader from "@/components/navigation-header";
import { useQuery } from "@tanstack/react-query";

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
  executionTime: number;
  timestamp: string;
}

interface PreflightReport {
  eventId: number;
  overallStatus: 'GREEN' | 'YELLOW' | 'RED';
  startTime: string;
  endTime: string;
  totalExecutionTime: number;
  validationResults: ValidationResult[];
  criticalFailures: string[];
  warnings: string[];
  systemInfo: {
    memoryUsage: NodeJS.MemoryUsage;
    nodeVersion: string;
    environment: string;
  };
}

interface PreflightDashboardProps {
  onLogout: () => void;
}

const statusColors = {
  GREEN: "text-green-600 bg-green-100 border-green-200",
  YELLOW: "text-yellow-600 bg-yellow-100 border-yellow-200", 
  RED: "text-red-600 bg-red-100 border-red-200"
};

const statusIcons = {
  PASS: <CheckCircle2 className="w-5 h-5 text-green-600" />,
  WARN: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
  FAIL: <XCircle className="w-5 h-5 text-red-600" />
};

const componentIcons: { [key: string]: any } = {
  'Database Connectivity': <Database className="w-5 h-5" />,
  'Event Configuration': <Settings className="w-5 h-5" />,
  'Google Cloud Storage': <Cloud className="w-5 h-5" />,
  'Google Vision OCR': <Eye className="w-5 h-5" />,
  'PathBuilder Integrity': <Link className="w-5 h-5" />,
  'Image Processing Pipeline': <Image className="w-5 h-5" />,
  'Thumbnail Generation': <Image className="w-5 h-5" />,
  'Signed URL Generation': <Shield className="w-5 h-5" />,
  'Processing Stats Update': <TrendingUp className="w-5 h-5" />,
  'End-to-End Processing': <Activity className="w-5 h-5" />,
  'System Resources': <Activity className="w-5 h-5" />
};

export default function PreflightDashboard({ onLogout }: PreflightDashboardProps) {
  const [selectedEventId, setSelectedEventId] = useState<number>(4); // Default to Carrera ventura 2025
  const [isValidating, setIsValidating] = useState(false);
  const [validationData, setValidationData] = useState<PreflightReport | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Fetch events for selection
  const { data: events = [] } = useQuery({
    queryKey: ['/api/events'],
    select: (data: any[]) => data || []
  });

  // Preflight validation query
  const { 
    data: preflightReport, 
    isLoading: isLoadingPreflight,
    error: preflightError,
    refetch: refetchPreflight,
    isFetching
  } = useQuery<PreflightReport>({
    queryKey: ['/api/events', selectedEventId, 'preflight'],
    enabled: false, // Don't auto-run, only run when manually triggered
    retry: false, // Don't auto-retry failed validations
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds if enabled
  });

  useEffect(() => {
    if (preflightReport) {
      setValidationData(preflightReport);
      setIsValidating(false);
    }
  }, [preflightReport]);

  useEffect(() => {
    if (preflightError) {
      setIsValidating(false);
    }
  }, [preflightError]);

  const runValidation = async () => {
    setIsValidating(true);
    setValidationData(null);
    await refetchPreflight();
  };

  const getStatusBadge = (status: 'GREEN' | 'YELLOW' | 'RED') => {
    const colorClass = statusColors[status];
    return (
      <Badge className={`${colorClass} px-3 py-1 text-sm font-semibold`}>
        {status === 'GREEN' && <CheckCircle2 className="w-4 h-4 mr-1" />}
        {status === 'YELLOW' && <AlertTriangle className="w-4 h-4 mr-1" />}
        {status === 'RED' && <XCircle className="w-4 h-4 mr-1" />}
        {status}
      </Badge>
    );
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatMemoryUsage = (bytes: number) => {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  };

  const getProgressValue = () => {
    if (!validationData || !validationData.validationResults) return 0;
    const total = validationData.validationResults.length;
    const completed = validationData.validationResults.filter(r => 
      r.status === 'PASS' || r.status === 'FAIL' || r.status === 'WARN'
    ).length;
    return (completed / total) * 100;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader 
        onLogout={onLogout}
      />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              🚀 Preflight Validation Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive system validation before event photo uploads
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              value={selectedEventId} 
              onChange={(e) => setSelectedEventId(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              data-testid="select-event"
            >
              {events.map((event: any) => (
                <option key={event.id} value={event.id}>
                  {event.name} (ID: {event.id})
                </option>
              ))}
            </select>
            
            <Button 
              onClick={runValidation}
              disabled={isValidating || isFetching}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-run-validation"
            >
              {isValidating || isFetching ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              {isValidating || isFetching ? 'Running Validation...' : 'Run Validation'}
            </Button>
          </div>
        </div>

        {/* Overall Status Card */}
        {validationData && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Overall System Status</CardTitle>
                {getStatusBadge(validationData.overallStatus)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600" data-testid="text-passed-checks">
                    {validationData.validationResults?.filter(r => r.status === 'PASS').length || 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600" data-testid="text-warnings">
                    {validationData.warnings.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600" data-testid="text-critical-failures">
                    {validationData.criticalFailures.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Critical Failures</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600" data-testid="text-execution-time">
                    {formatExecutionTime(validationData.totalExecutionTime)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Bar */}
        {(isValidating || isFetching) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                <div className="flex-1">
                  <div className="text-sm font-medium mb-1">Running preflight validation...</div>
                  <Progress value={validationData ? getProgressValue() : 0} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {preflightError && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/10">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>Validation Failed:</strong> {preflightError.message || 'Unknown error occurred during validation'}
            </AlertDescription>
          </Alert>
        )}

        {/* Critical Failures Alert */}
        {validationData && validationData.criticalFailures.length > 0 && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-900/10">
            <XCircle className="h-4 w-4" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>🚨 Critical System Failures Detected:</strong>
              <ul className="list-disc ml-6 mt-2">
                {validationData.criticalFailures.map((failure, index) => (
                  <li key={index} className="mt-1">{failure}</li>
                ))}
              </ul>
              <div className="mt-3 p-3 bg-red-100 dark:bg-red-800/20 rounded-md">
                <strong>⛔ UPLOADS BLOCKED:</strong> Photo uploads are disabled until all critical failures are resolved.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Warnings Alert */}
        {validationData && validationData.warnings.length > 0 && validationData.criticalFailures.length === 0 && (
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ System Warnings:</strong>
              <ul className="list-disc ml-6 mt-2">
                {validationData.warnings.map((warning, index) => (
                  <li key={index} className="mt-1">{warning}</li>
                ))}
              </ul>
              <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-800/20 rounded-md">
                <strong>✅ UPLOADS ALLOWED:</strong> System is functional with minor performance issues.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {validationData && validationData.overallStatus === 'GREEN' && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-900/10">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>🎉 All Systems Operational!</strong> Event {selectedEventId} is ready for photo uploads. 
              All critical components are functioning perfectly.
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed Results */}
        {validationData && (
          <Tabs defaultValue="components" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="components" data-testid="tab-components">Component Checks</TabsTrigger>
              <TabsTrigger value="details" data-testid="tab-details">Detailed Results</TabsTrigger>
              <TabsTrigger value="system" data-testid="tab-system">System Information</TabsTrigger>
            </TabsList>
            
            <TabsContent value="components" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {validationData.validationResults?.map((result, index) => (
                  <Card key={index} className="border-l-4" style={{
                    borderLeftColor: result.status === 'PASS' ? '#10b981' : 
                                   result.status === 'WARN' ? '#f59e0b' : '#ef4444'
                  }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {componentIcons[result.component] || <Activity className="w-5 h-5" />}
                          <CardTitle className="text-sm">{result.component}</CardTitle>
                        </div>
                        {statusIcons[result.status]}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {result.message}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>⏱️ {formatExecutionTime(result.executionTime)}</span>
                        <span>🕐 {new Date(result.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="details" className="space-y-4">
              <ScrollArea className="h-96 w-full border rounded-md p-4">
                <div className="space-y-4">
                  {validationData.validationResults?.map((result, index) => (
                    <div key={index} className="border-b pb-4 last:border-b-0">
                      <div className="flex items-center gap-2 mb-2">
                        {statusIcons[result.status]}
                        <h4 className="font-semibold">{result.component}</h4>
                        <Badge variant="outline" className="text-xs">
                          {formatExecutionTime(result.executionTime)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {result.message}
                      </p>
                      {result.details && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md text-xs">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="system" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Memory Usage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">RSS:</span>
                      <span className="text-sm font-mono" data-testid="text-memory-rss">
                        {formatMemoryUsage(validationData.systemInfo.memoryUsage.rss)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Heap Used:</span>
                      <span className="text-sm font-mono" data-testid="text-memory-heap">
                        {formatMemoryUsage(validationData.systemInfo.memoryUsage.heapUsed)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">External:</span>
                      <span className="text-sm font-mono">
                        {formatMemoryUsage(validationData.systemInfo.memoryUsage.external)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">System Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Node Version:</span>
                      <span className="text-sm font-mono" data-testid="text-node-version">
                        {validationData.systemInfo.nodeVersion}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Environment:</span>
                      <span className="text-sm font-mono" data-testid="text-environment">
                        {validationData.systemInfo.environment}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Event ID:</span>
                      <span className="text-sm font-mono" data-testid="text-event-id">
                        {validationData.eventId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Validation Time:</span>
                      <span className="text-sm font-mono">
                        {new Date(validationData.startTime).toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Auto-refresh Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Last validation: {validationData ? 
                    new Date(validationData.endTime).toLocaleString() : 
                    'Never'
                  }
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                    data-testid="checkbox-auto-refresh"
                  />
                  Auto-refresh (30s)
                </label>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetchPreflight()}
                  disabled={isValidating || isFetching}
                  data-testid="button-manual-refresh"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${(isValidating || isFetching) ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}