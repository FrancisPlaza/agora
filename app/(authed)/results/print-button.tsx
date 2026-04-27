"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      kind="ghost"
      size="sm"
      icon="file"
      onClick={() => window.print()}
    >
      Print
    </Button>
  );
}
