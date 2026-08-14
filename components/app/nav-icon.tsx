import {
  BarChart3,
  Boxes,
  CheckSquare,
  FileText,
  Home,
  MoreHorizontal,
  Package,
  Truck,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { NavItem } from "@/lib/auth/nav";

export function NavIcon({
  icon,
  className,
}: {
  icon: NavItem["icon"];
  className?: string;
}) {
  const props = { className, "aria-hidden": true as const };
  switch (icon) {
    case "home":
      return <Home {...props} />;
    case "people":
      return <Users {...props} />;
    case "quotes":
      return <FileText {...props} />;
    case "orders":
      return <Package {...props} />;
    case "more":
      return <MoreHorizontal {...props} />;
    case "check":
      return <CheckSquare {...props} />;
    case "pay":
      return <Wallet {...props} />;
    case "truck":
      return <Truck {...props} />;
    case "box":
      return <Boxes {...props} />;
    case "users":
      return <UserCog {...props} />;
    case "chart":
      return <BarChart3 {...props} />;
  }
}
