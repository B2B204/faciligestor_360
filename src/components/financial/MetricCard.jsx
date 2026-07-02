import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function MetricCard({ title, value, subtitle, icon: Icon, accent = "", children }) {
  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
          {Icon && <Icon className={`w-5 h-5 ${accent}`} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        {children}
      </CardContent>
    </Card>
  );
}