"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "./card";

interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

interface Pagination {
  page: number;
  totalPages: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  searchValue: string;
  onSearchChange: (value: string) => void;

  // Pagination props
  pagination: Pagination;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;

  // Table actions (optional)
  renderActions?: (row: any) => React.ReactNode;
}

export default function DataTable({
  columns,
  data,
  searchValue,
  onSearchChange,
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
  renderActions,
}: DataTableProps) {
  return (
    <Card>
      <CardHeader>
        {/* Search */}
        <div className="flex items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-500">
                {columns.map((col) => (
                  <th key={col.key} className="pb-3 font-medium">
                    {col.label}
                  </th>
                ))}

                {renderActions && <th className="pb-3 font-medium">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  {columns.map((col) => (
                    <td key={col.key} className="py-4 text-sm">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}

                  {renderActions && (
                    <td className="py-4">{renderActions(row)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {data.length === 0 && (
            <div className="py-12 text-center text-gray-500">
              No records found
            </div>
          )}
        </div>

        {/* Pagination */}
        {data.length > 0 && (
          <div className="flex justify-between items-center mt-4">
            {/* Page size */}
            <div className="flex items-center gap-2">
              <span className="text-sm">Rows per page:</span>

              <Select
                defaultValue={pageSize.toString()}
                onValueChange={(v) => onPageSizeChange(Number(v))}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 25].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Page info */}
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} |
              <span className="ml-2">{pagination.total} records</span>
            </p>

            {/* Pagination buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!pagination.hasPreviousPage}
                onClick={() => onPageChange(pagination.page - 1)}
              >
                Previous
              </Button>

              <Button
                variant="outline"
                disabled={!pagination.hasNextPage}
                onClick={() => onPageChange(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
