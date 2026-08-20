"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function ActivityFilters({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentDept = searchParams.get("department") ?? "all";
  const currentRange = searchParams.get("range") ?? "all";

  const updateFilters = (newDept: string, newRange: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newDept === "all") {
      params.delete("department");
    } else {
      params.set("department", newDept);
    }

    if (newRange === "all") {
      params.delete("range");
    } else {
      params.set("range", newRange);
    }

    // Reset page to 1 when filters change
    params.delete("page");

    router.push(`/dashboard/activity?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm">
      <div className="flex-1 max-w-xs">
        <label htmlFor="department" className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">
          Department
        </label>
        <select
          id="department"
          value={currentDept}
          onChange={(e) => updateFilters(e.target.value, currentRange)}
          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.id} value={dept.name}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 max-w-xs">
        <label htmlFor="range" className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1 uppercase tracking-wider">
          Date Range
        </label>
        <select
          id="range"
          value={currentRange}
          onChange={(e) => updateFilters(currentDept, e.target.value)}
          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 Days</option>
        </select>
      </div>
    </div>
  );
}
