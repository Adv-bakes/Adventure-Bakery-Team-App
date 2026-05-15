import { ReactNode } from "react";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Wrap any element that contains $ amounts, margins, costs, revenue, or pricing.
 * Only the `owner` role sees the children. Staff/admin see the optional fallback.
 */
export const MoneyOnly = ({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => {
  const { role, loading } = useUserRole();
  if (loading) return null;
  if (role !== "owner") return <>{fallback}</>;
  return <>{children}</>;
};

export const useIsOwner = () => {
  const { role, loading } = useUserRole();
  return { isOwner: role === "owner", loading };
};
