'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Search, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface ActivityLog {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  changes: any;
  created_at: string;
  profiles: {
    full_name: string;
    role: string;
  } | null;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let filtered = logs;

    if (filterAction !== 'all') {
      filtered = filtered.filter((log) => log.action === filterAction);
    }

    if (filterTable !== 'all') {
      filtered = filtered.filter((log) => log.table_name === filterTable);
    }

    if (search) {
      filtered = filtered.filter(
        (log) =>
          log.profiles?.full_name.toLowerCase().includes(search.toLowerCase()) ||
          log.table_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredLogs(filtered);
  }, [search, filterAction, filterTable, logs]);

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select(`
          *,
          profiles (full_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
      setFilteredLogs(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-100 text-green-800';
      case 'read':
        return 'bg-blue-100 text-blue-800';
      case 'update':
        return 'bg-orange-100 text-orange-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const uniqueTables = Array.from(new Set(logs.map((log) => log.table_name))).sort();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-gray-500">Monitor all CRUD operations across the system</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by user or table..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {uniqueTables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                      <span className="font-mono text-sm text-gray-600">{log.table_name}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                      <span className="font-medium">
                        {log.profiles?.full_name || 'Unknown User'}
                      </span>
                      <span>•</span>
                      <span className="capitalize">{log.profiles?.role || 'N/A'}</span>
                      <span>•</span>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-blue-600 hover:underline">
                          View changes
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                          {JSON.stringify(log.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  {log.record_id && (
                    <div className="text-xs text-gray-400 font-mono">
                      ID: {log.record_id.slice(0, 8)}...
                    </div>
                  )}
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="py-12 text-center text-gray-500">No activity logs found</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
