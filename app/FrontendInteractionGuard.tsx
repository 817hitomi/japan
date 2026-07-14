"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function FrontendInteractionGuard() {
  const pathname = usePathname();
  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

  useEffect(() => {
    if (isAdminPage) {
      return;
    }

    function preventContextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    document.addEventListener("contextmenu", preventContextMenu);

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, [isAdminPage]);

  return null;
}
