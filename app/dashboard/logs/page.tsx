"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Activity, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DataTable from "@/components/ui/DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: { entity_ids: string[][] } | null;
  created_at: string;
  status: string;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterTable, setFilterTable] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const token = localStorage.getItem("auth_token");

  const baseUrl = process.env.NEXT_PUBLIC_API;

  // For all drivers
  const getlogs = `http://${baseUrl}/api/audit`;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize]);

  useEffect(() => {
    let filtered = logs;

    // if (filterAction !== "all") {
    //   filtered = filtered.filter((log) => log.action === filterAction);
    // }

    // if (filterTable !== "all") {
    //   filtered = filtered.filter((log) => log.table_name === filterTable);
    // }

    // if (search) {
    //   filtered = filtered.filter(
    //     (log) =>
    //       log.profiles?.full_name
    //         .toLowerCase()
    //         .includes(search.toLowerCase()) ||
    //       log.table_name.toLowerCase().includes(search.toLowerCase())
    //   );
    // }

    setFilteredLogs(filtered);
  }, [search, filterAction, filterTable, logs]);

  async function fetchLogs() {
    setLoading(true);
    try {
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${getlogs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          searchTerm: search,
          page: page,
          pageSize: pageSize,
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const res = await response.json();
      setLogs(res.data || []);
      setFilteredLogs(res.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleViewDetails(logs: ActivityLog) {
    setSelectedLog(logs);
    fetchLogs();
    setDetailsOpen(true);
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800";
      case "read":
        return "bg-blue-100 text-blue-800";
      case "update":
        return "bg-orange-100 text-orange-800";
      case "delete":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // const uniqueTables = Array.from(
  //   new Set(logs.map((log) => log.table_name))
  // ).sort();

  const columns = [
    {
      key: "user_id",
      label: "User ID",
    },
    {
      key: "user_name",
      label: "Username",
    },
    {
      key: "user_role",
      label: "User Role",
    },
    {
      key: "action",
      label: "Action",
    },
    {
      key: "created_at",
      label: "Created Date-Time",
    },
    {
      key: "status",
      label: "Status",
      render: (row: ActivityLog) => (
        <Badge variant={row.status === "Success" ? "default" : "secondary"}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-gray-500">
              Monitor all operations across the system
            </p>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={filteredLogs}
          searchValue={search}
          onSearchChange={setSearch}
          pagination={pagination}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          renderActions={(logs: ActivityLog) => (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleViewDetails(logs)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </div>
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Details:{selectedLog?.id}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-500">User ID</Label>
                  <p className="font-medium">{selectedLog.user_id}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Username</Label>
                  <p className="font-medium">{selectedLog.user_name}</p>
                </div>
                <div>
                  <Label className="text-gray-500">User role</Label>
                  <p className="font-medium">{selectedLog.user_role}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Action</Label>
                  <p className="font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <p className="font-medium">{selectedLog.status}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Created Time</Label>
                  <p className="font-medium">{selectedLog.created_at}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
